#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
project_dir="$(dirname "$script_dir")"
state_dir="${project_dir}/state"

if [ -f "${project_dir}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${project_dir}/.env"
  set +a
fi

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_ZONE_NAME:?CLOUDFLARE_ZONE_NAME is required}"
: "${CLOUDFLARE_TUNNEL_NAME:?CLOUDFLARE_TUNNEL_NAME is required}"
: "${CLOUDFLARE_WEB_HOST:?CLOUDFLARE_WEB_HOST is required}"
: "${CLOUDFLARE_WWW_HOST:=www.${CLOUDFLARE_WEB_HOST}}"
: "${CLOUDFLARE_API_HOST:?CLOUDFLARE_API_HOST is required}"
: "${CLOUDFLARE_RTC_HOST:=rtc.${CLOUDFLARE_WEB_HOST}}"
: "${CLOUDFLARE_WEB_ORIGIN_URL:=http://host.docker.internal:3001}"
: "${CLOUDFLARE_API_ORIGIN_URL:=http://host.docker.internal:4000}"
: "${CLOUDFLARE_RTC_ORIGIN_URL:=http://host.docker.internal:7880}"

mkdir -p "${state_dir}"

cf_api() {
  method="$1"
  endpoint="$2"
  data_file="${3:-}"

  if [ -n "${data_file}" ]; then
    curl -fsS -X "${method}" "https://api.cloudflare.com/client/v4${endpoint}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data @"${data_file}"
  else
    curl -fsS -X "${method}" "https://api.cloudflare.com/client/v4${endpoint}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

if [ -n "${CLOUDFLARE_ZONE_ID:-}" ]; then
  zone_id="${CLOUDFLARE_ZONE_ID}"
elif zone_lookup="$(cf_api GET "/zones?name=${CLOUDFLARE_ZONE_NAME}")"; then
  zone_count="$(printf '%s' "${zone_lookup}" | jq '.result | length')"
  if [ "${zone_count}" -eq 0 ]; then
    create_zone_payload="${state_dir}/create-zone.json"
    cat > "${create_zone_payload}" <<EOF
{"name":"${CLOUDFLARE_ZONE_NAME}","type":"full","account":{"id":"${CLOUDFLARE_ACCOUNT_ID}"}}
EOF
    zone_create_response="$(cf_api POST "/zones" "${create_zone_payload}")"
    printf '%s\n' "${zone_create_response}" > "${state_dir}/zone-create-response.json"
    zone_id="$(printf '%s' "${zone_create_response}" | jq -r '.result.id')"
    printf '%s\n' "${zone_create_response}" | jq -r '.result.name_servers[]' > "${state_dir}/cloudflare-nameservers.txt"
  else
    zone_id="$(printf '%s' "${zone_lookup}" | jq -r '.result[0].id')"
    printf '%s\n' "${zone_lookup}" > "${state_dir}/zone-lookup-response.json"
  fi
else
  create_zone_payload="${state_dir}/create-zone.json"
  cat > "${create_zone_payload}" <<EOF
{"name":"${CLOUDFLARE_ZONE_NAME}","type":"full","account":{"id":"${CLOUDFLARE_ACCOUNT_ID}"}}
EOF
  zone_create_response="$(cf_api POST "/zones" "${create_zone_payload}")"
  printf '%s\n' "${zone_create_response}" > "${state_dir}/zone-create-response.json"
  zone_id="$(printf '%s' "${zone_create_response}" | jq -r '.result.id')"
  printf '%s\n' "${zone_create_response}" | jq -r '.result.name_servers[]' > "${state_dir}/cloudflare-nameservers.txt"
fi

create_tunnel_payload="${state_dir}/create-tunnel.json"
cat > "${create_tunnel_payload}" <<EOF
{"name":"${CLOUDFLARE_TUNNEL_NAME}","config_src":"cloudflare"}
EOF

tunnel_response="$(cf_api POST "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel" "${create_tunnel_payload}")"
printf '%s\n' "${tunnel_response}" > "${state_dir}/tunnel-create-response.json"

tunnel_id="$(printf '%s' "${tunnel_response}" | jq -r '.result.id')"
tunnel_token="$(printf '%s' "${tunnel_response}" | jq -r '.result.token')"

sh "${script_dir}/render-remote-config.sh" "${state_dir}/remote-config.json" >/dev/null
config_response="$(cf_api PUT "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${tunnel_id}/configurations" "${state_dir}/remote-config.json")"
printf '%s\n' "${config_response}" > "${state_dir}/tunnel-config-response.json"

upsert_dns_record() {
  host="$1"
  record_name="$2"
  payload="${state_dir}/dns-${record_name}.json"
  lookup_response="$(cf_api GET "/zones/${zone_id}/dns_records?name=${host}")"
  existing_record_id="$(printf '%s' "${lookup_response}" | jq -r '.result[0].id // empty')"

  cat > "${payload}" <<EOF
{"type":"CNAME","name":"${host}","content":"${tunnel_id}.cfargotunnel.com","proxied":true}
EOF

  if [ -n "${existing_record_id}" ]; then
    cf_api PUT "/zones/${zone_id}/dns_records/${existing_record_id}" "${payload}" > "${state_dir}/dns-${record_name}-response.json"
  else
    cf_api POST "/zones/${zone_id}/dns_records" "${payload}" > "${state_dir}/dns-${record_name}-response.json"
  fi
}

upsert_dns_record "${CLOUDFLARE_WEB_HOST}" "web"
upsert_dns_record "${CLOUDFLARE_WWW_HOST}" "www"
upsert_dns_record "${CLOUDFLARE_API_HOST}" "api"
upsert_dns_record "${CLOUDFLARE_RTC_HOST}" "rtc"

runtime_env="${project_dir}/.env.runtime"
cat > "${runtime_env}" <<EOF
CLOUDFLARE_TUNNEL_ID=${tunnel_id}
CLOUDFLARE_TUNNEL_TOKEN=${tunnel_token}
CLOUDFLARE_WEB_HOST=${CLOUDFLARE_WEB_HOST}
CLOUDFLARE_WWW_HOST=${CLOUDFLARE_WWW_HOST}
CLOUDFLARE_API_HOST=${CLOUDFLARE_API_HOST}
CLOUDFLARE_RTC_HOST=${CLOUDFLARE_RTC_HOST}
CLOUDFLARE_WEB_ORIGIN_URL=${CLOUDFLARE_WEB_ORIGIN_URL:-http://host.docker.internal:3001}
CLOUDFLARE_API_ORIGIN_URL=${CLOUDFLARE_API_ORIGIN_URL:-http://host.docker.internal:4000}
CLOUDFLARE_RTC_ORIGIN_URL=${CLOUDFLARE_RTC_ORIGIN_URL:-http://host.docker.internal:7880}
TUNNEL_METRICS=${TUNNEL_METRICS:-0.0.0.0:2000}
EOF

printf 'Tunnel ID: %s\n' "${tunnel_id}"
printf 'Runtime env written to %s\n' "${runtime_env}"
if [ -f "${state_dir}/cloudflare-nameservers.txt" ]; then
  printf 'Zone created in Cloudflare. Update registrar nameservers to:\n'
  sed -n '1,20p' "${state_dir}/cloudflare-nameservers.txt"
fi
