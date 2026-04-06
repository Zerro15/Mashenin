# Architecture

## Requirements

- support access with or without VPN
- single VPS friendly
- low ops overhead
- voice reliability over mixed home/mobile networks

## Core Components

- `web` for UI
- `api` for auth, presence, rooms, chat, and token issuance
- `postgres` for persistent data
- `redis` for presence and ephemeral state
- `livekit` for WebRTC media
- `coturn` for NAT traversal fallback

## Networking Model

- normal use goes through public HTTPS and WSS
- VPN is optional and may be used for admin access
- TURN is required for voice reliability outside friendly networks

## Suggested Domains

- `app.example.com` for web and API via reverse proxy
- `rtc.example.com` for LiveKit
- `turn.example.com` for TURN

## Growth Path

1. start on a single VPS with Docker Compose
2. add reverse proxy and TLS
3. add object storage for media if chat usage grows
