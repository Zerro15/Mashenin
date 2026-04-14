# PROJECT_STATE

Обновлено: `2026-04-14`

## Current Truth

- Активный runtime: `Next.js` в `apps/web` и `Fastify` в `apps/api`.
- Active product scope: текстовый MVP мессенджера.
- Главный пользовательский путь: `login -> open room -> load message history -> send message`.
- Canonical HTTP auth contract: `Authorization: Bearer <token>`.
- Default auth redirect в active flow: `/rooms`.
- `apps/web/src/*` и `apps/api/src/lib/router.js` считать reference-слоем.

## Что реально есть сейчас

- Web имеет страницы `login`, `register`, `rooms`, `room/[roomId]`, `settings`, а также более широкий surface area вокруг `teams`, `friends`, `dm`, `events`, `invite`.
- API поднимается из `apps/api/src/server.js` и регистрирует `auth`, `rooms`, `ws-chat`, `chat`, `friends`, `dm`, `events`, `teams`, `invites`.
- Store-слой умеет работать как минимум в двух режимах: `sql` и `file`.
- Есть smoke-покрытие active text flow на API: `apps/api/test/mvp-smoke.test.js`.
- Есть web smoke для legacy/reference SSR слоя: `apps/web/test/smoke.test.js`.

## Подтвержденный фокус разработки

- Стабилизировать active runtime, а не reference-слой.
- Не расширять scope в сторону voice-first, пока не удержан текстовый MVP.
- Вести разработку маленькими проверяемыми slice.

## Главные текущие риски

- Документы в репозитории частично описывают старый voice-first контекст.
- В проекте одновременно живут active runtime и reference-реализации.
- В auth/session еще остался временный fallback `x-session-token`, который позже стоит убрать.
- `apps/web/pages/room/[roomId].tsx` и store/auth-слой API остаются зонами высокого риска для конфликтов правок.

## Как читать репозиторий

- За правилами работы идти в `AGENTS.md`.
- За текущим состоянием проекта идти сюда.
- За ближайшими задачами идти в `BACKLOG.md`.
- За картой системы идти в `ARCHITECTURE.md`.
- За уже принятыми решениями идти в `DECISIONS.md`.

## Что не считать source of truth

- `README.md` — обзорный вход, но не главный операционный документ.
- `PRODUCT_VISION.md` — продуктовая рамка, не текущий status snapshot.
- `GIT_WORKFLOW.md` — вспомогательный документ.
- `CLAUDE.md`, `GITHUB_SETUP.md`, `docs/*` — могут содержать исторический или более широкий контекст.
