# BACKLOG

## Как читать этот файл

- `Now` — ближайшие рабочие slice.
- `Next` — логичные следующие шаги после `Now`.
- `Later` — важные, но не срочные направления.
- `Frozen` — сознательно не трогаем без отдельного решения.
- `Tech Debt` — долги, которые стоит закрывать только в нужном контексте.

## Now

- `test/text-mvp-regression`
  Удержать стабильную проверку active text flow в browser/API сценариях.
  Проверка: login -> room -> history -> send -> refresh -> logout.

- `refactor/room-page-boundaries`
  Снизить хаотичность `apps/web/pages/room/[roomId].tsx` только настолько, насколько это помогает active text flow.
  Проверка: без затрагивания voice/friends/events без прямой причины.

- `docs/archive-stale-context`
  После стабилизации нового source-of-truth слоя пометить или урезать устаревшие docs, которые спорят с текущим курсом.
  Проверка: `README.md`, `CLAUDE.md`, `GITHUB_SETUP.md`, `docs/*` больше не вводят в заблуждение.

## Next

- `fix/realtime-contract`
  Ясно развести роли HTTP polling и WS в active chat flow.

- `test/browser-text-mvp`
  Закрепить один надежный browser-level сценарий поверх active runtime.

- `fix/sql-file-parity`
  Снизить расхождения между `sql` и `file` provider там, где это влияет на MVP.

## Later

- `voice/livekit`
  Вернуться к voice только после удержания текстового MVP.

- `invite/onboarding`
  Довести invite flow до продуктово завершенного состояния.

- `search/messages`
  Поиск по сообщениям после стабилизации базового контура.

- `attachments`
  Прикрепление файлов к сообщениям после MVP.

## Frozen

- `friends`
- `events`
- `communities`
- большой cleanup legacy-кода
- крупный frontend refactor
- крупный backend refactor
- инфраструктурные изменения без прямой задачи

## Tech Debt

- Active runtime и reference-слой живут рядом и создают риск ошибочных правок.
- Документация частично устарела относительно фактического курса проекта.
- Контракты auth/session и chat еще не выглядят полностью унифицированными.
- В репозитории легко накопить generated и temp-файлы, если не держать git hygiene.
- Нужны стабильные проверки именно для active `Next.js + Fastify` стека.

## Done Recently

- `fix/auth-contract`
  Canonical HTTP auth contract выровнен вокруг `Authorization: Bearer <token>`.
  Default auth redirect переведен на `/rooms`.
  Для expired session в `room/[roomId]` send path теперь используется `clearSessionToken()` + redirect на `/login?next=/room/<roomId>`.
