# Database

## Status

Postgres is now initialized with a first-pass application schema and starter seed data.

## Core Tables

- `users` - member profiles and presence state
- `invite_codes` - invite-only access control
- `user_sessions` - web sessions with expiry
- `rooms` - persistent and temporary voice rooms
- `room_memberships` - room membership and roles
- `voice_sessions` - voice join history and mute/deafen state
- `messages` - room text chat
- `events` - scheduled hangouts or sessions
- `event_attendees` - RSVP state

## Seed Data

Initial setup creates:

- the default invite code `mashenin-2026`
- six starter users
- four starter rooms

## Init Flow

The schema is applied from:

- `infra/postgres/init.sql`

and is mounted into the official Postgres image via:

- `docker-compose.yml`

## Next Migration Steps

1. move API store reads from in-memory mocks to SQL queries
2. write a small migration strategy instead of relying only on init SQL
3. add triggers or application-level updates for `updated_at`
4. add message attachments and polls when the product needs them
