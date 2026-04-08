# mashenin

Voice-first messenger для постоянных комнат, команд и сообществ.

## Goals

- join voice rooms in one tap
- work with and without VPN
- stay cheap to host on a single VPS
- grow from a small crew to a larger active server without changing product shape

## Monorepo Layout

- `apps/web` - web client
- `apps/api` - backend API
- `packages/shared` - shared types and constants
- `infra` - deployment and local infrastructure
- `docs` - product and technical notes

## MVP Scope

- account auth with invite-gated onboarding
- online presence
- persistent voice rooms
- temporary voice rooms
- room text chat
- events and quick polls

## Local Stack

- web: static starter placeholder for Next.js app
- api: lightweight Node HTTP server placeholder
- postgres
- redis
- livekit
- coturn

## Why This Layout

- keeps product code separate from infra
- leaves room for shared packages
- works well for Docker Compose now and CI later

## Current Backend Capabilities

- invite preview and invite-based session bootstrap
- file-backed runtime state for local dev and SQL-backed mode for growth
- rooms, room messages, presence summary, and events endpoints
- room join flow with per-user status updates
- LiveKit-compatible room token minting endpoint
- pluggable data provider layer with `file` and `sql` modes

## MVP Smoke

Минимальный smoke-тест для основного MVP-контура сейчас живет в `apps/api`.

Что он проверяет:

- `login -> open room -> load message history -> send message -> logout`
- базовый контракт `auth/me` после входа и после logout

Как запускать:

```bash
cd apps/api
npm run test:smoke
```

Когда запускать:

- после правок в `apps/api`, которые затрагивают auth, rooms, messages или logout;
- перед отдельным commit для MVP-контура;
- перед merge изменений, которые могут сломать основной пользовательский путь.

## Database Foundation

- Postgres schema bootstrap in `infra/postgres/init.sql`
- starter seed data for users, rooms, and invite codes
- documented table layout in `docs/database.md`

## Next Build Steps

1. replace web placeholder with real Next.js app
2. replace api placeholder with NestJS or Fastify service
3. add auth, rooms, presence, and chat modules
4. wire LiveKit room tokens from the API
5. add reverse proxy and domain-based deployment
