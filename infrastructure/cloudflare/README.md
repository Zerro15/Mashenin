# Mashenin Cloudflare Tunnel

This folder contains the minimal Cloudflare Tunnel slice for exposing
Mashenin without DuckDNS, router port forwarding, or dependence on the current
home WAN IP.

## Chosen Scheme

- `https://mashenin.site` -> Cloudflare Tunnel -> local web on `127.0.0.1:3001`
- `https://www.mashenin.site` -> Cloudflare Tunnel -> local web on `127.0.0.1:3001`
- `https://api.mashenin.site` -> Cloudflare Tunnel -> local api on `127.0.0.1:4000`
- `wss://rtc.mashenin.site` -> Cloudflare Tunnel -> local LiveKit signalling on `127.0.0.1:7880`

Why this variant:

- the frontend already supports an absolute `NEXT_PUBLIC_API_URL`
- it removes NPM from the main external path
- it avoids path-routing complexity in the tunnel
- it keeps the runtime wiring small and explicit

## Files

- `compose.yaml`: runtime for `cloudflared` using a tunnel token
- `.env.example`: Cloudflare API/runtime variables
- `config.remote.json.example`: example remote-managed tunnel config payload
- `scripts/render-remote-config.sh`: renders the ingress config JSON from `.env`
- `scripts/bootstrap-remote-tunnel.sh`: uses Cloudflare API to create the zone tunnel, put ingress config, and create DNS records

## Terminal-First Flow

1. Copy `.env.example` to `.env`
2. Fill at least:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_ZONE_NAME=mashenin.site`
   - `CLOUDFLARE_TUNNEL_NAME=mashenin`
   - `CLOUDFLARE_WEB_HOST=mashenin.site`
   - `CLOUDFLARE_WWW_HOST=www.mashenin.site`
   - `CLOUDFLARE_API_HOST=api.mashenin.site`
   - `CLOUDFLARE_RTC_HOST=rtc.mashenin.site`
3. Bootstrap Cloudflare resources:

```bash
cd /home/zerro/projects/mashenin/infrastructure/cloudflare
./scripts/bootstrap-remote-tunnel.sh
```

This script:

- looks up or creates the `mashenin.site` zone in Cloudflare
- creates a remotely-managed named tunnel
- stores the API responses under `state/`
- writes the tunnel token and tunnel id into `.env.runtime`
- pushes ingress config for:
  - `mashenin.site` -> `http://host.docker.internal:3001`
  - `www.mashenin.site` -> `http://host.docker.internal:3001`
  - `api.mashenin.site` -> `http://host.docker.internal:4000`
  - `rtc.mashenin.site` -> `http://host.docker.internal:7880`
- creates proxied DNS CNAME records to `<tunnel-id>.cfargotunnel.com`

4. Start the local app runtime:

```bash
cd /home/zerro/projects/mashenin/apps/api
HOST=0.0.0.0 PORT=4000 npm run dev
```

```bash
cd /home/zerro/projects/mashenin/apps/web
NEXT_PUBLIC_API_URL="https://api.mashenin.site" npm run dev -- --hostname 0.0.0.0 --port 3001
```

5. Start the tunnel:

```bash
cd /home/zerro/projects/mashenin/infrastructure/cloudflare
set -a && . ./.env.runtime && set +a
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" compose --profile tunnel -f compose.yaml up -d cloudflared
```

## Token Permissions

The Cloudflare API token should be able to:

- create and edit tunnels on the target account
- read and edit DNS for `mashenin.site`
- create the zone if you want the script to create it automatically

## What Still Requires Account Access

If `mashenin.site` is not already delegated to Cloudflare nameservers, the zone
creation step will return the Cloudflare nameservers that must be set at the
registrar before the public URL can work. That registrar NS change cannot be
finished from this repo alone.

## What Can Be Verified Locally

Without real Cloudflare credentials you can still verify:

- local web: `http://127.0.0.1:3001`
- local api: `http://127.0.0.1:4000/health`
- that `cloudflared` can reach `host.docker.internal:3001` and `:4000`
- Docker Compose syntax for the tunnel runtime
- JSON shape of the remote tunnel config payload
