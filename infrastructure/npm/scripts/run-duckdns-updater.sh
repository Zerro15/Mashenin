#!/bin/sh
set -eu

log() {
  printf '%s %s\n' "$(date -Iseconds)" "$*"
}

trim() {
  printf '%s' "$1" | tr -d ' \t\r\n'
}

read_publish_ip() {
  if [ -n "${DUCKDNS_PUBLISH_IP:-}" ]; then
    trim "${DUCKDNS_PUBLISH_IP}"
    return 0
  fi

  if [ -n "${DUCKDNS_PUBLISH_IP_FILE:-}" ] && [ -f "${DUCKDNS_PUBLISH_IP_FILE}" ]; then
    tr -d ' \t\r\n' < "${DUCKDNS_PUBLISH_IP_FILE}"
    return 0
  fi

  return 1
}

validate_ipv4() {
  awk -F. '
    NF != 4 { exit 1 }
    {
      for (i = 1; i <= 4; i++) {
        if ($i !~ /^[0-9]+$/ || $i < 0 || $i > 255) {
          exit 1
        }
      }
    }
  ' <<EOF
$1
EOF
}

update_duckdns() {
  curl -fsS --get "https://www.duckdns.org/update" \
    --data-urlencode "domains=${DUCKDNS_SUBDOMAINS}" \
    --data-urlencode "token=${DUCKDNS_TOKEN}" \
    --data-urlencode "ip=$1"
}

interval="${DUCKDNS_INTERVAL_SECONDS:-300}"
state_dir="/state"
last_ip_file="${state_dir}/last-published-ip.txt"
last_status_file="${state_dir}/last-update-status.txt"

mkdir -p "${state_dir}"

if [ -z "${DUCKDNS_SUBDOMAINS:-}" ]; then
  log "DUCKDNS_SUBDOMAINS is required"
  exit 1
fi

if [ -z "${DUCKDNS_TOKEN:-}" ]; then
  log "DUCKDNS_TOKEN is required"
  exit 1
fi

log "Starting DuckDNS updater in explicit-IP mode for ${DUCKDNS_SUBDOMAINS}"

while :; do
  if ! publish_ip="$(read_publish_ip)"; then
    log "No explicit publish IP configured. Set DUCKDNS_PUBLISH_IP or provide ${DUCKDNS_PUBLISH_IP_FILE:-/state/public-ip.txt}."
    sleep "${interval}"
    continue
  fi

  if ! validate_ipv4 "${publish_ip}"; then
    log "Configured publish IP is not a valid IPv4 address: ${publish_ip}"
    sleep "${interval}"
    continue
  fi

  if response="$(update_duckdns "${publish_ip}")"; then
    printf '%s\n' "${publish_ip}" > "${last_ip_file}"
    printf '%s\n' "${response}" > "${last_status_file}"
    log "Published DuckDNS IP ${publish_ip} with response ${response}"
  else
    log "DuckDNS update request failed for IP ${publish_ip}"
  fi

  sleep "${interval}"
done
