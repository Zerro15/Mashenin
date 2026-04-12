#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
project_dir="$(dirname "$script_dir")"

if [ -f "${project_dir}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${project_dir}/.env"
  set +a
fi

: "${CLOUDFLARE_WEB_HOST:?CLOUDFLARE_WEB_HOST is required}"
: "${CLOUDFLARE_WWW_HOST:=www.${CLOUDFLARE_WEB_HOST}}"
: "${CLOUDFLARE_API_HOST:?CLOUDFLARE_API_HOST is required}"
: "${CLOUDFLARE_RTC_HOST:=rtc.${CLOUDFLARE_WEB_HOST}}"
: "${CLOUDFLARE_WEB_ORIGIN_URL:=http://host.docker.internal:3001}"
: "${CLOUDFLARE_API_ORIGIN_URL:=http://host.docker.internal:4000}"
: "${CLOUDFLARE_RTC_ORIGIN_URL:=http://host.docker.internal:7880}"

output_path="${1:-${project_dir}/state/remote-config.json}"
mkdir -p "$(dirname "${output_path}")"

cat > "${output_path}" <<EOF
{
  "config": {
    "ingress": [
      {
        "hostname": "${CLOUDFLARE_WEB_HOST}",
        "path": "^/(?:health|api(?:/.*)?)$",
        "service": "${CLOUDFLARE_API_ORIGIN_URL}",
        "originRequest": {
          "httpHostHeader": "${CLOUDFLARE_WEB_HOST}"
        }
      },
      {
        "hostname": "${CLOUDFLARE_WWW_HOST}",
        "path": "^/(?:health|api(?:/.*)?)$",
        "service": "${CLOUDFLARE_API_ORIGIN_URL}",
        "originRequest": {
          "httpHostHeader": "${CLOUDFLARE_WWW_HOST}"
        }
      },
      {
        "hostname": "${CLOUDFLARE_WEB_HOST}",
        "service": "${CLOUDFLARE_WEB_ORIGIN_URL}",
        "originRequest": {
          "httpHostHeader": "${CLOUDFLARE_WEB_HOST}"
        }
      },
      {
        "hostname": "${CLOUDFLARE_WWW_HOST}",
        "service": "${CLOUDFLARE_WEB_ORIGIN_URL}",
        "originRequest": {
          "httpHostHeader": "${CLOUDFLARE_WWW_HOST}"
        }
      },
      {
        "hostname": "${CLOUDFLARE_API_HOST}",
        "service": "${CLOUDFLARE_API_ORIGIN_URL}",
        "originRequest": {
          "httpHostHeader": "${CLOUDFLARE_API_HOST}"
        }
      },
      {
        "hostname": "${CLOUDFLARE_RTC_HOST}",
        "service": "${CLOUDFLARE_RTC_ORIGIN_URL}",
        "originRequest": {
          "httpHostHeader": "${CLOUDFLARE_RTC_HOST}"
        }
      },
      {
        "service": "http_status:404"
      }
    ]
  }
}
EOF

printf 'Wrote %s\n' "${output_path}"
