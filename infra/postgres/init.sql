CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_presence AS ENUM ('offline', 'online', 'away', 'in_voice');
CREATE TYPE room_kind AS ENUM ('persistent', 'temporary');
CREATE TYPE room_member_role AS ENUM ('owner', 'moderator', 'member');
CREATE TYPE invite_status AS ENUM ('active', 'disabled', 'exhausted');
CREATE TYPE event_rsvp AS ENUM ('going', 'maybe', 'declined');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  about_text TEXT NOT NULL DEFAULT '',
  presence user_presence NOT NULL DEFAULT 'offline',
  status_note TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS about_text TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  room_id UUID,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status invite_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind room_kind NOT NULL,
  topic TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_memberships (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role room_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS room_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invite_codes_room_id_fkey'
  ) THEN
    ALTER TABLE invite_codes
      ADD CONSTRAINT invite_codes_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  livekit_room_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  is_deafened BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response event_rsvp NOT NULL DEFAULT 'maybe',
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_presence ON users (presence);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_rooms_kind ON rooms (kind);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_room_id ON voice_sessions (room_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_invite_codes_room_id ON invite_codes (room_id);

INSERT INTO users (display_name, slug, presence, status_note)
VALUES
  ('Богдан', 'bogdan', 'in_voice', 'уже сидит в общей'),
  ('Илья', 'ilya', 'online', 'сможет зайти через 10 минут'),
  ('Макс', 'maks', 'in_voice', 'играет дуо'),
  ('Саша', 'sasha', 'away', 'вышел пройтись'),
  ('Ника', 'nika', 'online', 'сейчас свободна'),
  ('Рома', 'roma', 'in_voice', 'смотрит стрим')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO rooms (slug, name, kind, topic)
VALUES
  ('general', 'Общая', 'persistent', 'главная комната, чтобы быстро залететь и поболтать'),
  ('games', 'Игры', 'persistent', 'катки, кооп и сборы в пати'),
  ('chill', 'Чилл', 'persistent', 'музыка, ссылки и спокойный разговор'),
  ('movie-night', 'Киноночь', 'temporary', 'смотрим вместе, старт в 22:00')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO room_memberships (room_id, user_id, role)
SELECT r.id, u.id, CASE WHEN u.slug = 'bogdan' THEN 'owner'::room_member_role ELSE 'member'::room_member_role END
FROM rooms r
JOIN users u ON u.slug IN ('bogdan', 'ilya', 'maks', 'nika', 'roma')
WHERE r.slug = 'general'
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO room_memberships (room_id, user_id, role)
SELECT r.id, u.id, 'member'::room_member_role
FROM rooms r
JOIN users u ON u.slug IN ('maks')
WHERE r.slug = 'games'
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO room_memberships (room_id, user_id, role)
SELECT r.id, u.id, 'member'::room_member_role
FROM rooms r
JOIN users u ON u.slug IN ('roma')
WHERE r.slug = 'movie-night'
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO voice_sessions (room_id, user_id, livekit_room_name)
SELECT r.id, u.id, r.slug
FROM rooms r
JOIN users u ON (
  (r.slug = 'general' AND u.slug = 'bogdan') OR
  (r.slug = 'games' AND u.slug = 'maks') OR
  (r.slug = 'movie-night' AND u.slug = 'roma')
)
WHERE NOT EXISTS (
  SELECT 1
  FROM voice_sessions vs
  WHERE vs.room_id = r.id
    AND vs.user_id = u.id
    AND vs.ended_at IS NULL
);

INSERT INTO events (room_id, title, starts_at)
SELECT r.id, 'Пятничный созвон', TIMESTAMPTZ '2026-04-03 20:00:00+05'
FROM rooms r
WHERE r.slug = 'general'
  AND NOT EXISTS (
    SELECT 1 FROM events e WHERE e.title = 'Пятничный созвон'
  );

INSERT INTO events (room_id, title, starts_at)
SELECT r.id, 'Ночная игровая сессия', TIMESTAMPTZ '2026-04-03 23:30:00+05'
FROM rooms r
WHERE r.slug = 'games'
  AND NOT EXISTS (
    SELECT 1 FROM events e WHERE e.title = 'Ночная игровая сессия'
  );

INSERT INTO event_attendees (event_id, user_id, response)
SELECT e.id, u.id, 'going'
FROM events e
JOIN users u ON u.slug IN ('bogdan', 'ilya', 'maks', 'nika')
WHERE e.title = 'Пятничный созвон'
ON CONFLICT (event_id, user_id) DO NOTHING;

INSERT INTO event_attendees (event_id, user_id, response)
SELECT e.id, u.id, 'going'
FROM events e
JOIN users u ON u.slug IN ('maks', 'roma')
WHERE e.title = 'Ночная игровая сессия'
ON CONFLICT (event_id, user_id) DO NOTHING;

INSERT INTO messages (room_id, author_user_id, body, created_at)
SELECT r.id, u.id, 'Я уже в общей, если кто-то хочет залететь.', TIMESTAMPTZ '2026-04-02 20:12:00+05'
FROM rooms r
JOIN users u ON u.slug = 'bogdan'
WHERE r.slug = 'general'
  AND NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.body = 'Я уже в общей, если кто-то хочет залететь.'
  );

INSERT INTO messages (room_id, author_user_id, body, created_at)
SELECT r.id, u.id, 'Зайду после чая.', TIMESTAMPTZ '2026-04-02 20:17:00+05'
FROM rooms r
JOIN users u ON u.slug = 'nika'
WHERE r.slug = 'general'
  AND NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.body = 'Зайду после чая.'
  );

INSERT INTO messages (room_id, author_user_id, body, created_at)
SELECT r.id, u.id, 'Комната для кино уже живая. Берите снеки.', TIMESTAMPTZ '2026-04-02 21:01:00+05'
FROM rooms r
JOIN users u ON u.slug = 'roma'
WHERE r.slug = 'movie-night'
  AND NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.body = 'Комната для кино уже живая. Берите снеки.'
  );

INSERT INTO invite_codes (code, max_uses, status)
VALUES ('mashenin-2026', 1000, 'active')
ON CONFLICT (code) DO NOTHING;
