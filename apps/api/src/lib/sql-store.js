import { getPool } from "./sql.js";
import { hashPassword, normalizeEmail, verifyPassword } from "./auth.js";

function nowPlusSeconds(ttlSeconds) {
  return new Date(Date.now() + ttlSeconds * 1000);
}

function buildSessionToken() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function slugifyDisplayName(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return normalized || `user-${Math.random().toString(36).slice(2, 8)}`;
}

function slugifyRoomName(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return normalized || `room-${Math.random().toString(36).slice(2, 8)}`;
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.display_name,
    status: row.presence,
    note: row.status_note,
    roomId: row.room_slug || null,
    email: row.email || null,
    about: row.about || ""
  };
}

async function getUserBySessionToken(client, token) {
  if (!token) {
    return null;
  }

  const result = await client.query(
    `
      SELECT
        u.id,
        u.display_name,
        u.email,
        u.about_text AS about,
        u.presence,
        u.status_note,
        r.slug AS room_slug,
        s.expires_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN voice_sessions vs ON vs.user_id = u.id AND vs.ended_at IS NULL
      LEFT JOIN rooms r ON r.id = vs.room_id
      WHERE s.session_token = $1
        AND s.expires_at > NOW()
      ORDER BY s.created_at DESC
      LIMIT 1
    `,
    [token]
  );

  return result.rows[0] || null;
}

export async function getSummary() {
  const pool = getPool();
  const [users, rooms] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_friends,
        COUNT(*) FILTER (WHERE presence <> 'away')::int AS online_friends,
        COUNT(*) FILTER (WHERE presence = 'in_voice')::int AS in_voice_friends
      FROM users
    `),
    pool.query(`
      SELECT COUNT(*)::int AS active_rooms
      FROM rooms
      WHERE is_archived = FALSE
        AND EXISTS (
          SELECT 1
          FROM voice_sessions vs
          WHERE vs.room_id = rooms.id
            AND vs.ended_at IS NULL
        )
    `)
  ]);

  return {
    totalFriends: users.rows[0]?.total_friends || 0,
    onlineFriends: users.rows[0]?.online_friends || 0,
    inVoiceFriends: users.rows[0]?.in_voice_friends || 0,
    activeRooms: rooms.rows[0]?.active_rooms || 0
  };
}

export async function getRooms() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT
      r.slug AS id,
      r.name,
      r.kind,
      r.topic,
      COUNT(vs.id) FILTER (WHERE vs.ended_at IS NULL)::int AS members
    FROM rooms r
    LEFT JOIN voice_sessions vs ON vs.room_id = r.id
    WHERE r.is_archived = FALSE
    GROUP BY r.id
    ORDER BY r.created_at ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    topic: row.topic,
    members: row.members
  }));
}

export async function getFriends() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT
      u.id,
      u.display_name,
      u.presence,
      u.status_note,
      r.slug AS room_slug
    FROM users u
    LEFT JOIN voice_sessions vs ON vs.user_id = u.id AND vs.ended_at IS NULL
    LEFT JOIN rooms r ON r.id = vs.room_id
    ORDER BY u.created_at ASC
  `);

  return result.rows.map(mapUser);
}

export async function getEvents() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT
      e.id,
      e.title,
      e.starts_at,
      r.slug AS room_id,
      COUNT(ea.user_id) FILTER (WHERE ea.response = 'going')::int AS attendees
    FROM events e
    LEFT JOIN rooms r ON r.id = e.room_id
    LEFT JOIN event_attendees ea ON ea.event_id = e.id
    GROUP BY e.id, r.slug
    ORDER BY e.starts_at ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    attendees: row.attendees,
    roomId: row.room_id
  }));
}

export async function getRoomById(roomId) {
  const pool = getPool();
  const roomResult = await pool.query(
    `
      SELECT
        r.id,
        r.slug,
        r.name,
        r.kind,
        r.topic,
        COUNT(vs.id) FILTER (WHERE vs.ended_at IS NULL)::int AS members
      FROM rooms r
      LEFT JOIN voice_sessions vs ON vs.room_id = r.id
      WHERE r.slug = $1
      GROUP BY r.id
    `,
    [roomId]
  );

  const room = roomResult.rows[0];

  if (!room) {
    return null;
  }

  const speakersResult = await pool.query(
    `
      SELECT
        u.id,
        u.display_name,
        u.presence,
        u.status_note
      FROM voice_sessions vs
      JOIN users u ON u.id = vs.user_id
      JOIN rooms r ON r.id = vs.room_id
      WHERE r.slug = $1 AND vs.ended_at IS NULL
      ORDER BY vs.started_at ASC
    `,
    [roomId]
  );

  return {
    id: room.slug,
    name: room.name,
    kind: room.kind,
    topic: room.topic,
    members: room.members,
    speakers: speakersResult.rows.map((row) => ({
      id: row.id,
      name: row.display_name,
      status: row.presence,
      note: row.status_note
    }))
  };
}

export async function getMessagesForRoom(roomId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        m.id,
        r.slug AS room_id,
        u.display_name AS author,
        m.created_at AS sent_at,
        m.body AS text
      FROM messages m
      JOIN rooms r ON r.id = m.room_id
      JOIN users u ON u.id = m.author_user_id
      WHERE r.slug = $1
      ORDER BY m.created_at ASC
    `,
    [roomId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    author: row.author,
    sentAt: row.sent_at,
    text: row.text
  }));
}

export async function getInvitePreview(code) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        code,
        GREATEST(max_uses - used_count, 0)::int AS available_slots
      FROM invite_codes
      WHERE code = $1 AND status = 'active'
    `,
    [code]
  );

  const invite = result.rows[0];
  if (!invite) return null;

  return {
    code: invite.code,
    groupName: "mashenin",
    invitedBy: "Богдан",
    availableSlots: invite.available_slots
  };
}

export async function createSession({ code, name, ttlSeconds = 604800 }) {
  const normalizedName = (name || "").trim();

  if (!code || !normalizedName) {
    return null;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inviteResult = await client.query(
      `
        SELECT id, code, max_uses, used_count, status
        FROM invite_codes
        WHERE code = $1
          AND status = 'active'
        FOR UPDATE
      `,
      [code]
    );

    const invite = inviteResult.rows[0];
    if (!invite) {
      await client.query("ROLLBACK");
      return null;
    }

    let userResult = await client.query(
      `
        SELECT id, display_name, presence, status_note
        FROM users
        WHERE lower(display_name) = lower($1)
        LIMIT 1
      `,
      [normalizedName]
    );

    let user = userResult.rows[0];
    const isNewUser = !user;

    if (isNewUser && invite.used_count >= invite.max_uses) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!user) {
      const slugBase = slugifyDisplayName(normalizedName);
      const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

      userResult = await client.query(
        `
          INSERT INTO users (display_name, slug, presence, status_note)
          VALUES ($1, $2, 'online', 'только что зашел в клуб')
          RETURNING id, display_name, presence, status_note
        `,
        [normalizedName, slug]
      );

      user = userResult.rows[0];

      await client.query(
        `
          UPDATE invite_codes
          SET used_count = used_count + 1
          WHERE id = $1
        `,
        [invite.id]
      );
    }

    const sessionToken = buildSessionToken();
    const expiresAt = nowPlusSeconds(ttlSeconds);

    await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [user.id]);
    await client.query(
      `
        INSERT INTO user_sessions (session_token, user_id, expires_at)
        VALUES ($1, $2, $3)
      `,
      [sessionToken, user.id, expiresAt]
    );

    await client.query("COMMIT");

    return {
      token: sessionToken,
      user: {
        id: user.id,
        name: user.display_name,
        status: user.presence,
        note: user.status_note,
        roomId: null
      },
      expiresAt: expiresAt.getTime()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerUser({
  code,
  email,
  password,
  displayName,
  about = "",
  ttlSeconds = 604800
}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(displayName || "").trim();

  if (!code || !normalizedEmail || !password || password.length < 6 || !normalizedName) {
    return null;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inviteResult = await client.query(
      `
        SELECT id, max_uses, used_count, status
        FROM invite_codes
        WHERE code = $1
          AND status = 'active'
        FOR UPDATE
      `,
      [code]
    );
    const invite = inviteResult.rows[0];

    if (!invite || invite.used_count >= invite.max_uses) {
      await client.query("ROLLBACK");
      return null;
    }

    const existingUser = await client.query(
      `
        SELECT id
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (existingUser.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const passwordHash = await hashPassword(password);
    const slug = `${slugifyDisplayName(normalizedName)}-${Math.random().toString(36).slice(2, 6)}`;

    const userResult = await client.query(
      `
        INSERT INTO users (display_name, slug, email, password_hash, about_text, presence, status_note)
        VALUES ($1, $2, $3, $4, $5, 'online', 'только что зарегистрировался')
        RETURNING id, display_name, email, about_text, presence, status_note
      `,
      [normalizedName, slug, normalizedEmail, passwordHash, String(about || "").trim()]
    );
    const user = userResult.rows[0];

    await client.query(`UPDATE invite_codes SET used_count = used_count + 1 WHERE id = $1`, [invite.id]);

    const sessionToken = buildSessionToken();
    const expiresAt = nowPlusSeconds(ttlSeconds);

    await client.query(
      `
        INSERT INTO user_sessions (session_token, user_id, expires_at)
        VALUES ($1, $2, $3)
      `,
      [sessionToken, user.id, expiresAt]
    );

    await client.query("COMMIT");

    return {
      token: sessionToken,
      user: {
        id: user.id,
        name: user.display_name,
        status: user.presence,
        note: user.status_note,
        roomId: null,
        email: user.email,
        about: user.about_text || ""
      },
      expiresAt: expiresAt.getTime()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loginWithPassword({ email, password, ttlSeconds = 604800 }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    return null;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
        SELECT id, display_name, email, about_text, password_hash, presence, status_note
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    if (!user?.password_hash) {
      await client.query("ROLLBACK");
      return null;
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      await client.query("ROLLBACK");
      return null;
    }

    const sessionToken = buildSessionToken();
    const expiresAt = nowPlusSeconds(ttlSeconds);

    await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [user.id]);
    await client.query(
      `
        INSERT INTO user_sessions (session_token, user_id, expires_at)
        VALUES ($1, $2, $3)
      `,
      [sessionToken, user.id, expiresAt]
    );

    await client.query(
      `
        UPDATE users
        SET presence = CASE WHEN presence = 'in_voice' THEN 'in_voice' ELSE 'online' END,
            status_note = CASE WHEN presence = 'in_voice' THEN status_note ELSE 'снова в сети' END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
    );

    await client.query("COMMIT");

    return {
      token: sessionToken,
      user: {
        id: user.id,
        name: user.display_name,
        status: user.presence === "in_voice" ? "in_voice" : "online",
        note: user.presence === "in_voice" ? user.status_note : "снова в сети",
        roomId: null,
        email: user.email,
        about: user.about_text || ""
      },
      expiresAt: expiresAt.getTime()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getSessionUser(token) {
  const pool = getPool();
  const row = await getUserBySessionToken(pool, token);
  return row ? mapUser(row) : null;
}

export async function updateProfile({ token, displayName, about }) {
  const normalizedName = String(displayName || "").trim();
  const normalizedAbout = String(about || "").trim();
  const pool = getPool();
  const client = await pool.connect();

  try {
    const user = await getUserBySessionToken(client, token);
    if (!user) {
      return null;
    }

    const result = await client.query(
      `
        UPDATE users
        SET display_name = COALESCE(NULLIF($2, ''), display_name),
            about_text = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, display_name, email, about_text, presence, status_note
      `,
      [user.id, normalizedName, normalizedAbout]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.display_name,
      status: row.presence,
      note: row.status_note,
      roomId: user.room_slug || null,
      email: row.email || null,
      about: row.about_text || ""
    };
  } finally {
    client.release();
  }
}

export async function clearSession(token) {
  const pool = getPool();
  await pool.query(`DELETE FROM user_sessions WHERE session_token = $1`, [token]);
}

export async function joinRoom({ token, roomId }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserBySessionToken(client, token);
    if (!user) {
      await client.query("ROLLBACK");
      return null;
    }

    const roomResult = await client.query(
      `
        SELECT id, slug, name, kind, topic
        FROM rooms
        WHERE slug = $1 AND is_archived = FALSE
        LIMIT 1
      `,
      [roomId]
    );
    const room = roomResult.rows[0];

    if (!room) {
      await client.query("ROLLBACK");
      return null;
    }

    const currentVoiceResult = await client.query(
      `
        SELECT vs.id, r.slug AS room_slug
        FROM voice_sessions vs
        JOIN rooms r ON r.id = vs.room_id
        WHERE vs.user_id = $1
          AND vs.ended_at IS NULL
        LIMIT 1
      `,
      [user.id]
    );

    const currentVoice = currentVoiceResult.rows[0];

    if (currentVoice?.room_slug !== room.slug) {
      await client.query(
        `
          UPDATE voice_sessions
          SET ended_at = NOW()
          WHERE user_id = $1
            AND ended_at IS NULL
        `,
        [user.id]
      );

      await client.query(
        `
          INSERT INTO voice_sessions (room_id, user_id, livekit_room_name)
          VALUES ($1, $2, $3)
        `,
        [room.id, user.id, room.slug]
      );
    }

    await client.query(
      `
        INSERT INTO room_memberships (room_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (room_id, user_id) DO NOTHING
      `,
      [room.id, user.id]
    );

    await client.query(
      `
        UPDATE users
        SET
          presence = 'in_voice',
          status_note = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [user.id, `в комнате ${room.name}`]
    );

    const membersResult = await client.query(
      `
        SELECT COUNT(*)::int AS members
        FROM voice_sessions
        WHERE room_id = $1
          AND ended_at IS NULL
      `,
      [room.id]
    );

    await client.query("COMMIT");

    return {
      user: {
        id: user.id,
        name: user.display_name,
        status: "in_voice",
        note: `в комнате ${room.name}`,
        roomId: room.slug
      },
      room: {
        id: room.slug,
        name: room.name,
        kind: room.kind,
        topic: room.topic,
        members: membersResult.rows[0]?.members || 0
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createRoomAccess({ token, roomId, ttlSeconds = 3600 }) {
  const user = await getSessionUser(token);
  const room = await getRoomById(roomId);

  if (!user || !room) {
    return null;
  }

  return {
    identity: user.id,
    name: user.name,
    roomName: room.id,
    ttlSeconds
  };
}

export async function getRoomState({ token, roomId }) {
  const room = await getRoomById(roomId);
  if (!room) {
    return null;
  }

  const user = await getSessionUser(token);
  const isAuthenticated = Boolean(user);
  const isInRoom = Boolean(user && user.roomId === roomId);

  return {
    roomId,
    isAuthenticated,
    isInRoom,
    user: user
      ? {
          id: user.id,
          name: user.name,
          status: user.status,
          note: user.note
        }
      : null,
    recommendedAction: !user ? "login" : isInRoom ? "open_voice" : "join_room"
  };
}

export async function getRoomSocial(roomId) {
  const [room, friends] = await Promise.all([getRoomById(roomId), getFriends()]);

  if (!room) {
    return null;
  }

  const availableToInvite = friends
    .filter((friend) => friend.status === "online" && friend.roomId !== roomId)
    .map((friend) => ({
      id: friend.id,
      name: friend.name,
      note: friend.note
    }));

  const activeSpeakers = room.speakers.map((friend, index) => ({
    id: friend.id,
    name: friend.name,
    intensity: index === 0 ? "говорит" : index === 1 ? "слушает и иногда отвечает" : "на фоне"
  }));

  return {
    roomId,
    availableToInvite,
    activeSpeakers
  };
}

export async function createMessage({ token, roomId, body }) {
  const trimmed = (body || "").trim();
  if (!trimmed) {
    return null;
  }

  const pool = getPool();
  const user = await getSessionUser(token);

  if (!user) {
    return null;
  }

  const result = await pool.query(
    `
      INSERT INTO messages (room_id, author_user_id, body)
      SELECT r.id, $2, $3
      FROM rooms r
      WHERE r.slug = $1
      RETURNING id, body, created_at
    `,
    [roomId, user.id, trimmed]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    roomId,
    author: user.name,
    sentAt: row.created_at,
    text: row.body
  };
}

export async function createRoom({ token, name, topic = '' }) {
  const normalizedName = String(name || '').trim();
  const normalizedTopic = String(topic || '').trim();

  if (!token || !normalizedName) {
    return null;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await getUserBySessionToken(client, token);

    if (!user) {
      await client.query('ROLLBACK');
      return null;
    }

    const slugBase = slugifyRoomName(normalizedName);
    const existingRoom = await client.query(
      `
        SELECT slug
        FROM rooms
        WHERE slug = $1
        LIMIT 1
      `,
      [slugBase]
    );

    const slug = existingRoom.rows[0]
      ? `${slugBase}-${Math.random().toString(36).slice(2, 6)}`
      : slugBase;

    const roomResult = await client.query(
      `
        INSERT INTO rooms (slug, name, kind, topic, created_by_user_id)
        VALUES ($1, $2, 'persistent', $3, $4)
        RETURNING id, slug, name, kind, topic, created_at
      `,
      [slug, normalizedName, normalizedTopic || 'новая комната', user.id]
    );

    const room = roomResult.rows[0];

    await client.query(
      `
        INSERT INTO room_memberships (room_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (room_id, user_id) DO NOTHING
      `,
      [room.id, user.id]
    );

    await client.query('COMMIT');

    return {
      id: room.slug,
      name: room.name,
      kind: room.kind,
      topic: room.topic,
      members: 0,
      speakers: []
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createEvent({ token, title, startsAt, roomId = null }) {
  const trimmedTitle = (title || "").trim();
  if (!trimmedTitle || !startsAt) {
    return null;
  }

  const pool = getPool();
  const user = await getSessionUser(token);

  if (!user) {
    return null;
  }

  const roomSlug = roomId || "general";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roomResult = await client.query(`SELECT id, slug FROM rooms WHERE slug = $1 LIMIT 1`, [roomSlug]);
    const room = roomResult.rows[0];
    if (!room) {
      await client.query("ROLLBACK");
      return null;
    }

    const eventResult = await client.query(
      `
        INSERT INTO events (room_id, created_by_user_id, title, starts_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, title, starts_at
      `,
      [room.id, user.id, trimmedTitle, startsAt]
    );

    const event = eventResult.rows[0];

    await client.query(
      `
        INSERT INTO event_attendees (event_id, user_id, response)
        VALUES ($1, $2, 'going')
        ON CONFLICT (event_id, user_id) DO UPDATE SET response = 'going', responded_at = NOW()
      `,
      [event.id, user.id]
    );

    await client.query("COMMIT");

    return {
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      attendees: 1,
      roomId: room.slug
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function respondToEvent({ token, eventId, response }) {
  const allowed = new Set(["going", "maybe", "declined"]);
  if (!allowed.has(response)) {
    return null;
  }

  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) {
    return null;
  }

  await pool.query(
    `
      INSERT INTO event_attendees (event_id, user_id, response)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET response = EXCLUDED.response, responded_at = NOW()
    `,
    [eventId, user.id, response]
  );

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.title,
        e.starts_at,
        r.slug AS room_id,
        COUNT(ea.user_id) FILTER (WHERE ea.response = 'going')::int AS attendees
      FROM events e
      LEFT JOIN rooms r ON r.id = e.room_id
      LEFT JOIN event_attendees ea ON ea.event_id = e.id
      WHERE e.id = $1
      GROUP BY e.id, r.slug
    `,
    [eventId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    attendees: row.attendees,
    roomId: row.room_id
  };
}

// Новые методы для работы с чатом и пользователями

export async function getInvite(code) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        id,
        code,
        created_by_user_id,
        max_uses,
        used_count,
        status,
        expires_at
      FROM invite_codes
      WHERE code = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [code]
  );

  return result.rows[0] || null;
}

export async function useInvite(code) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE invite_codes
      SET used_count = used_count + 1
      WHERE code = $1
    `,
    [code]
  );
}

export async function createUser({ id, username, email, passwordHash, roomId }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Создаем пользователя
    const userResult = await client.query(
      `
        INSERT INTO users (id, display_name, slug, email, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [id, username, slugifyDisplayName(username), email, passwordHash]
    );

    // Добавляем в комнату если указана
    if (roomId) {
      await client.query(
        `
          INSERT INTO room_memberships (room_id, user_id, role)
          SELECT $1, $2, 'member'
          WHERE EXISTS (SELECT 1 FROM rooms WHERE id = $1)
        `,
        [roomId, id]
      );
    }

    await client.query("COMMIT");
    return userResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRoom(roomId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        id,
        slug,
        name,
        kind,
        topic,
        is_archived,
        created_by_user_id,
        created_at,
        updated_at
      FROM rooms
      WHERE id = $1 OR slug = $1
    `,
    [roomId]
  );

  return result.rows[0] || null;
}

export async function getRoomMembers(roomId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.display_name as name,
        u.presence as status,
        u.status_note as note,
        rm.role,
        rm.joined_at
      FROM room_memberships rm
      JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = $1 OR rm.room_id = (SELECT id FROM rooms WHERE slug = $1)
    `,
    [roomId]
  );

  return result.rows;
}

export async function getRoomPresence(roomId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        u.id as user_id,
        u.display_name as name,
        u.presence as status,
        u.status_note as note,
        vs.livekit_room_name as voice_room
      FROM users u
      LEFT JOIN voice_sessions vs ON vs.user_id = u.id AND vs.ended_at IS NULL
      WHERE EXISTS (
        SELECT 1 FROM room_memberships rm
        WHERE rm.user_id = u.id
        AND (rm.room_id = $1 OR rm.room_id = (SELECT id FROM rooms WHERE slug = $1))
      )
    `,
    [roomId]
  );

  return result.rows;
}

export async function updateUserPresence(roomId, userId, status) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET presence = $1::user_presence, updated_at = NOW()
      WHERE id = $2
    `,
    [status, userId]
  );
}

export async function saveMessage(roomId, message) {
  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO messages (id, room_id, author_user_id, body, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [message.id, roomId, message.userId, message.content, message.timestamp]
  );

  return result.rows[0];
}

export async function getMessages(roomId, limit = 50, offset = 0) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        m.id,
        m.author_user_id as "userId",
        u.display_name as "userName",
        m.body as content,
        m.created_at as timestamp,
        m.edited_at as "editedAt"
      FROM messages m
      JOIN users u ON u.id = m.author_user_id
      WHERE m.room_id = $1 OR m.room_id = (SELECT id FROM rooms WHERE slug = $1)
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [roomId, limit, offset]
  );

  return result.rows.reverse(); // Возвращаем в хронологическом порядке
}
