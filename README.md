# mashenin

Voice-first messenger с командами, друзьями и личными сообщениями.

## Quick Start

```bash
git clone https://github.com/Zerro15/Mashenin.git
cd Mashenin
git checkout feat/teams-friends-dm
docker compose up -d
```

Открыть http://127.0.0.1:3001 в браузере.

## Архитектура

- **Web:** Next.js 14 (Pages Router) в `apps/web`
- **API:** Fastify в `apps/api`
- **DB:** PostgreSQL в `infra/postgres`
- **Cache:** Redis
- **Voice:** LiveKit Cloud (опционально)

## Основные возможности

| Фича | Endpoints | Страницы |
|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | `/login`, `/register` |
| Команды | `GET/POST /api/teams`, `GET/POST /api/teams/:id/messages` | `/teams`, `/teams/create`, `/team/:slug` |
| Комнаты | `GET/POST /api/rooms`, `GET/POST/PUT/DELETE /api/rooms/:id/messages` | `/rooms`, `/rooms/create`, `/room/:roomId` |
| Друзья | `GET /api/friends`, `POST /api/friends/request`, `POST /api/friends/accept` | `/friends` |
| Личные сообщения | `GET/POST /api/dm/:userId` | `/dm/:userId` |
| Инвайты | `GET /api/auth/invite/:code`, `POST /api/rooms/:id/invites` | `/invite/:code` |

## Data Mode

Проект работает в **SQL mode** (PostgreSQL) по умолчанию.
File-backed mode доступен для smoke-тестов через `DATA_PROVIDER=file`.

```bash
# SQL mode (production)
DATA_PROVIDER=sql npm run dev

# File mode (testing only)
DATA_PROVIDER=file npm run test:smoke
```

## Тесты

```bash
# MVP smoke test (file mode)
cd apps/api && npm run test:smoke

# SQL smoke test (PostgreSQL)
cd apps/api && npm run test:sql
```

## Конфигурация

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

| Переменная | Описание |
|---|---|
| `POSTGRES_USER` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `POSTGRES_DB` | Имя базы данных |
| `LIVEKIT_API_KEY` | LiveKit Cloud API key (для голосовых звонков) |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret |
| `LIVEKIT_WS_URL` | LiveKit WebSocket URL |

## Database

Миграции применяются автоматически при `docker compose up`:

1. `infra/postgres/init.sql` — базовая схема (users, rooms, messages, events, invite_codes)
2. `infra/postgres/02-teams-friends-dm.sql` — teams, friendships, direct messages, team_messages

## Development

```bash
# Запуск всех сервисов
docker compose up -d

# Логи
docker compose logs -f web api

# Остановка и очистка
docker compose down -v
```

## Branch

Текущая ветка: `feat/teams-friends-dm`