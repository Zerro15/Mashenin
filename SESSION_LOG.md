# SESSION_LOG

Append-only журнал значимых slice.

Формат записи:

- дата
- цель slice
- что изменено
- как проверено
- следующий шаг

## 2026-04-14 — docs-only source-of-truth layer

- Цель: собрать минимальную и рабочую систему project memory для Codex CLI и subagents.
- Что изменено: обновлен `AGENTS.md`, созданы `PROJECT_STATE.md`, `SESSION_LOG.md`, `ARCHITECTURE.md`, перестроен `BACKLOG.md`, минимально выровнен `README.md`.
- Как проверено: ручной аудит репозитория, документов и active runtime entry points; код приложения не менялся.
- Следующий шаг: применить новый workflow на одном реальном code slice и затем урезать устаревшие docs, которые конфликтуют с current truth.

## 2026-04-14 — fix/auth-contract

- Цель: выровнять active auth/session contract для пути `login -> /api/auth/me -> rooms -> room/[roomId] -> send message -> refresh -> logout`.
- Что изменено: canonical HTTP auth выровнен вокруг `Authorization: Bearer <token>`, active default redirect переведен на `/rooms`, send path в `room/[roomId]` теперь очищает сессию и редиректит на `login` при `401`.
- Как проверено: `cd apps/api && npm run test:smoke`, browser-level flow на `127.0.0.1:3001` и `127.0.0.1:4000` для сценария `login -> /rooms -> open room -> send message -> refresh -> logout`.
- Следующий шаг: удержать этот путь стабильным отдельным regression slice и затем решить, когда убирать временный fallback `x-session-token`.
