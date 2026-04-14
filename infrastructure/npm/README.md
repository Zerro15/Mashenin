# Mashenin External Access

This folder contains the smallest self-hosted runtime for exposing Mashenin
through DuckDNS and Nginx Proxy Manager.

## What This Stack Does

- `nginx-proxy-manager` publishes ports `80`, `81`, and `443`
- `duckdns` updates your DuckDNS record to an explicitly configured public IP
- NPM proxies traffic from your DuckDNS hostnames back to the locally running
  Mashenin web and api processes on the host machine

The app itself still runs outside Docker:

- web: `127.0.0.1:3001`
- api: `127.0.0.1:4000`

NPM reaches those host processes through `host.docker.internal`.

## Files To Fill Manually

1. Copy `.env.example` to `.env`
2. Fill at least:
   - `DUCKDNS_SUBDOMAINS`
   - `DUCKDNS_TOKEN`
   - `DUCKDNS_PUBLISH_IP` or `DUCKDNS_PUBLISH_IP_FILE`
   - `MASHENIN_BASE_DOMAIN`
   - `MASHENIN_WEB_FQDN`
   - `MASHENIN_API_PATH`

## Why The Updater Uses Explicit IP

The original LinuxServer DuckDNS image was configured with `UPDATE_IP=ipv4`,
which auto-detects the updater's current public egress IP. That breaks as soon
as the machine's default route moves to a VPN: DuckDNS can then publish the VPN
exit IP instead of your home/router WAN IP.

This stack now avoids auto-detection completely:

- DuckDNS updates always send an explicit `ip=` value
- the IP can come from `.env` via `DUCKDNS_PUBLISH_IP`
- or from `./state/public-ip.txt` mounted into the container as `/state/public-ip.txt`

If both are set, `DUCKDNS_PUBLISH_IP` wins.

This makes the published DNS value predictable and independent from the active
VPN route. If your ISP changes your WAN IP, update the `.env` value or the
`state/public-ip.txt` file with the new public IPv4.

## Start Nginx Proxy Manager

```bash
cd infrastructure/npm
docker compose up -d nginx-proxy-manager
```

Admin UI:

- `http://127.0.0.1:81`

## Start DuckDNS Updater

After `.env` is filled:

```bash
cd infrastructure/npm
docker compose --profile duckdns up -d duckdns
```

To drive the updater from a file instead of hardcoding the IP in `.env`:

```bash
cd infrastructure/npm
printf '%s\n' '203.0.113.10' > state/public-ip.txt
docker compose --profile duckdns up -d duckdns
```

## Recommended Hostname Layout

Preferred setup for the current MVP:

- web: `your-subdomain.duckdns.org`
- api: `your-subdomain.duckdns.org/api`

This works cleanly with the current frontend as long as you run the web process
with:

- `NEXT_PUBLIC_API_URL="https://your-subdomain.duckdns.org"`

The frontend already calls `/api/...`, so a single domain with a custom NPM
location is enough and avoids a second public hostname.

Fallback only if you cannot keep `/api` in NPM:

- web: `your-subdomain.duckdns.org`
- api: `api-your-subdomain.duckdns.org`

## Local Mashenin Runtime

Start the app with the external API URL:

```bash
cd /home/zerro/projects/mashenin/apps/api
HOST=127.0.0.1 PORT=4000 npm run dev
```

```bash
cd /home/zerro/projects/mashenin/apps/web
NEXT_PUBLIC_API_URL="https://your-subdomain.duckdns.org" npm run dev -- --hostname 127.0.0.1 --port 3001
```

## NPM Proxy Hosts To Create

### Single-domain host

- Domain Names: `your-subdomain.duckdns.org`
- Scheme: `http`
- Forward Hostname/IP: `host.docker.internal`
- Forward Port: `3001`
- Enable:
  - `Websockets Support`
  - `Block Common Exploits`

Add one custom location on the same host:

- Location: `/api`
- Scheme: `http`
- Forward Hostname/IP: `host.docker.internal`
- Forward Port: `4000`
- Leave the path as `/api`

Request a Let's Encrypt certificate on this host after your DuckDNS record
resolves to your home/public IP and ports `80` and `443` are forwarded to this
machine.

## Router / ISP Requirements

You must forward these ports from your router to this machine:

- `80/tcp`
- `443/tcp`

Port `81/tcp` is only for local admin access and does not need external
forwarding.

If your ISP gives you CGNAT / gray IP, inbound traffic from the internet will
not reach your router even if DuckDNS updates correctly. In that case this
scheme will not work until you have:

- a real public IPv4, or
- working public IPv6 with matching routing/firewall, or
- a VPS/tunnel alternative

## Current Local Validation

The current repo setup was validated locally through NPM with:

- `Host: mashenin.duckdns.org` -> web on `127.0.0.1:3001`
- `Host: mashenin.duckdns.org` and path `/api/...` -> api on `127.0.0.1:4000`

If the public DuckDNS hostname still does not open from the internet, the proxy
configuration is already correct and the remaining blocker is outside the repo:

- missing router port forwarding for `80/443`, or
- CGNAT / gray IP, or
- wrong explicit WAN IP in DuckDNS
