# ARCHITECTURE

Обновлено: `2026-04-14`

## Active Runtime

- Web: `apps/web` на `Next.js` Pages Router.
- API: `apps/api` на `Fastify`.
- Data: `sql` или `file` provider через store-слой API.
- Realtime: HTTP + WebSocket вокруг room chat.
- Canonical HTTP auth: `Authorization: Bearer <token>`.
- Временный fallback `x-session-token` пока еще существует только для безопасного перехода.

## Web Map

- Entry: `apps/web/pages/_app.tsx`
- Auth: `apps/web/pages/login.tsx`, `apps/web/pages/register.tsx`
- Rooms: `apps/web/pages/rooms.tsx`, `apps/web/pages/room/[roomId].tsx`
- Session/API: `apps/web/lib/session.ts`, `apps/web/lib/api.ts`
- Realtime hooks: `apps/web/hooks/useChatSocket.ts`, `apps/web/hooks/useUnreadTracker.ts`

## API Map

- Entry: `apps/api/src/server.js`
- Auth: `apps/api/src/routes/auth.js`
- Rooms/messages: `apps/api/src/routes/rooms.js`
- Realtime chat: `apps/api/src/routes/ws-chat.js`, `apps/api/src/routes/chat.js`
- Store/config: `apps/api/src/lib/store.js`, `apps/api/src/lib/file-store.js`, `apps/api/src/lib/sql-store.js`, `apps/api/src/lib/sql.js`, `apps/api/src/lib/config.js`

## Tests

- API smoke: `apps/api/test/mvp-smoke.test.js`
- SQL smoke: `apps/api/test/sql-smoke.test.js`
- Legacy/reference web smoke: `apps/web/test/smoke.test.js`

## Reference Boundary

Эти части не считать основным runtime без прямой задачи:

- `apps/web/src/*`
- `apps/web/src/server.js`
- `apps/api/src/lib/router.js`

## Hotspots для subagents

Один writer-agent за раз:

- `apps/web/pages/room/[roomId].tsx`
- `apps/web/lib/session.ts`
- `apps/api/src/lib/store.js`
- `apps/api/src/routes/auth.js`
- `apps/api/src/routes/rooms.js`

## Практическое правило

- Если задача про active text flow, начинать с `apps/web/pages/login.tsx`, `apps/web/pages/rooms.tsx`, `apps/web/pages/room/[roomId].tsx`, `apps/web/lib/session.ts`, `apps/api/src/routes/auth.js`, `apps/api/src/routes/rooms.js`.
- Если файл лежит в reference-слое, не менять его без отдельного явного решения.
