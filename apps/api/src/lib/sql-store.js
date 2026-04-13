import { getPool } from "./sql.js";
import { hashPassword, normalizeEmail, verifyPassword } from "./auth.js";
import crypto from "node:crypto";

function nowPlusSeconds(ttlSeconds) {
  return new Date(Date.now() + ttlSeconds * 1000);
}

function buildSessionToken() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function buildInviteCode() {
  return crypto.randomBytes(4).toString("hex");
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

function buildDirectRoomSlug(userId, peerUserId) {
  const pairKey = [String(userId || ""), String(peerUserId || "")].sort().join(":");
  return `dm-${crypto.createHash("sha1").update(pairKey).digest("hex").slice(0, 12)}`;
}

function buildDirectRoomName(leftName, rightName) {
  const names = [String(leftName || "").trim(), String(rightName || "").trim()].filter(Boolean);
  if (names.length === 0) {
    return "Личный разговор";
  }

  return names
    .sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }))
    .join(" и ");
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

export async function getRooms({ token } = {}) {
  if (!token) {
    return [];
  }

  const pool = getPool();
  const user = await getUserBySessionToken(pool, token);

  if (!user) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        r.slug AS id,
        r.name,
        r.kind,
        r.topic,
        COALESCE(room_counts.members, 0)::int AS members
      FROM room_memberships my_membership
      JOIN rooms r ON r.id = my_membership.room_id
      LEFT JOIN (
        SELECT room_id, COUNT(*)::int AS members
        FROM room_memberships
        GROUP BY room_id
      ) room_counts ON room_counts.room_id = r.id
      WHERE my_membership.user_id = $1
        AND r.is_archived = FALSE
      ORDER BY r.created_at ASC
    `,
    [user.id]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    topic: row.topic,
    members: row.members
  }));
}

// getFriends — see new implementation below (with token parameter)

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
  const [roomResult, speakersResult, participantsResult] = await Promise.all([
    pool.query(
    `
      SELECT
        r.id,
        r.slug,
        r.name,
        r.kind,
        r.topic,
        COUNT(rm.user_id)::int AS members
      FROM rooms r
      LEFT JOIN room_memberships rm ON rm.room_id = r.id
      WHERE r.slug = $1
      GROUP BY r.id
    `,
    [roomId]
    ),
    pool.query(
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
    ),
    pool.query(
      `
        SELECT
          u.id,
          u.display_name
        FROM room_memberships rm
        JOIN rooms r ON r.id = rm.room_id
        JOIN users u ON u.id = rm.user_id
        WHERE r.slug = $1
        ORDER BY lower(u.display_name) ASC
      `,
      [roomId]
    )
  ]);

  const room = roomResult.rows[0];

  if (!room) {
    return null;
  }

  return {
    id: room.slug,
    name: room.name,
    kind: room.kind,
    topic: room.topic,
    members: room.members,
    participants: participantsResult.rows.map((row) => ({
      id: row.id,
      name: row.display_name
    })),
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

export async function getUserById(userId) {
  const pool = getPool();
  const row = await pool.query('SELECT id, display_name, email, presence, status_note, room_slug FROM users WHERE id = $1', [userId]);
  return row.rows[0] ? mapUser(row.rows[0]) : null;
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

export async function leaveRoom({ token, roomId }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await getUserBySessionToken(client, token);
    if (!user) {
      await client.query('ROLLBACK');
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
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        UPDATE voice_sessions
        SET ended_at = NOW()
        WHERE user_id = $1
          AND room_id = $2
          AND ended_at IS NULL
      `,
      [user.id, room.id]
    );

    await client.query(
      `
        UPDATE users
        SET
          presence = 'online',
          status_note = 'снова в сети',
          updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
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

    await client.query('COMMIT');

    return {
      user: {
        id: user.id,
        name: user.display_name,
        status: 'online',
        note: 'снова в сети',
        roomId: null
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
    await client.query('ROLLBACK');
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

    const memberCountResult = await client.query(
      `
        SELECT COUNT(*)::int AS members
        FROM room_memberships
        WHERE room_id = $1
      `,
      [room.id]
    );

    await client.query('COMMIT');

    return {
      id: room.slug,
      name: room.name,
      kind: room.kind,
      topic: room.topic,
      members: memberCountResult.rows[0]?.members || 0,
      speakers: []
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrCreateDirectRoom({ token, peerUserId }) {
  const normalizedPeerUserId = String(peerUserId || "").trim();

  if (!token) {
    return { ok: false, error: "unauthorized" };
  }

  if (!normalizedPeerUserId) {
    return { ok: false, error: "peer_user_required" };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserBySessionToken(client, token);

    if (!user) {
      await client.query("ROLLBACK");
      return { ok: false, error: "unauthorized" };
    }

    if (normalizedPeerUserId === user.id) {
      await client.query("ROLLBACK");
      return { ok: false, error: "self_direct_not_allowed" };
    }

    const peerResult = await client.query(
      `
        SELECT id, display_name
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [normalizedPeerUserId]
    );

    const peer = peerResult.rows[0];

    if (!peer) {
      await client.query("ROLLBACK");
      return { ok: false, error: "user_not_found" };
    }

    const existingResult = await client.query(
      `
        SELECT
          r.id,
          r.slug,
          r.name,
          r.kind,
          r.topic
        FROM rooms r
        JOIN room_memberships my_membership
          ON my_membership.room_id = r.id
         AND my_membership.user_id = $1
        JOIN room_memberships peer_membership
          ON peer_membership.room_id = r.id
         AND peer_membership.user_id = $2
        WHERE r.kind = 'direct'
          AND r.is_archived = FALSE
          AND 2 = (
            SELECT COUNT(*)
            FROM room_memberships exact_membership
            WHERE exact_membership.room_id = r.id
          )
        ORDER BY r.created_at ASC
        LIMIT 1
        FOR UPDATE
      `,
      [user.id, peer.id]
    );

    const existingRoom = existingResult.rows[0];

    if (existingRoom) {
      await client.query("COMMIT");
      return {
        ok: true,
        created: false,
        room: {
          id: existingRoom.slug,
          name: existingRoom.name,
          kind: existingRoom.kind,
          topic: existingRoom.topic,
          members: 2
        }
      };
    }

    const slugBase = buildDirectRoomSlug(user.id, peer.id);
    const existingSlug = await client.query(
      `
        SELECT 1
        FROM rooms
        WHERE slug = $1
        LIMIT 1
      `,
      [slugBase]
    );

    const slug = existingSlug.rows[0]
      ? `${slugBase}-${Math.random().toString(36).slice(2, 6)}`
      : slugBase;

    const roomResult = await client.query(
      `
        INSERT INTO rooms (slug, name, kind, topic, created_by_user_id)
        VALUES ($1, $2, 'direct', $3, $4)
        RETURNING id, slug, name, kind, topic
      `,
      [slug, buildDirectRoomName(user.display_name, peer.display_name), "личный разговор", user.id]
    );

    const room = roomResult.rows[0];

    await client.query(
      `
        INSERT INTO room_memberships (room_id, user_id, role)
        VALUES
          ($1, $2, 'owner'),
          ($1, $3, 'member')
        ON CONFLICT (room_id, user_id) DO NOTHING
      `,
      [room.id, user.id, peer.id]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      created: true,
      room: {
        id: room.slug,
        name: room.name,
        kind: room.kind,
        topic: room.topic,
        members: 2
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createRoomInvite({ token, roomId }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserBySessionToken(client, token);

    if (!user) {
      await client.query("ROLLBACK");
      return { ok: false, error: "unauthorized" };
    }

    const roomResult = await client.query(
      `
        SELECT r.id, r.slug
        FROM rooms r
        WHERE r.slug = $1
        LIMIT 1
      `,
      [roomId]
    );

    const room = roomResult.rows[0];

    if (!room) {
      await client.query("ROLLBACK");
      return { ok: false, error: "room_not_found" };
    }

    const membershipResult = await client.query(
      `
        SELECT 1
        FROM room_memberships
        WHERE room_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [room.id, user.id]
    );

    if (!membershipResult.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "forbidden" };
    }

    let createdInvite = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = buildInviteCode();
      const insertResult = await client.query(
        `
          INSERT INTO invite_codes (code, created_by_user_id, room_id, max_uses, used_count, status)
          VALUES ($1, $2, $3, 1, 0, 'active')
          ON CONFLICT (code) DO NOTHING
          RETURNING code
        `,
        [code, user.id, room.id]
      );

      if (insertResult.rows[0]) {
        createdInvite = {
          code,
          roomId: room.slug,
          path: `/invite/${code}`
        };
        break;
      }
    }

    if (!createdInvite) {
      await client.query("ROLLBACK");
      return { ok: false, error: "invite_create_failed" };
    }

    await client.query("COMMIT");

    return {
      ok: true,
      invite: createdInvite
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRoomInvitePreview(code) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        ic.code,
        r.slug AS room_id,
        r.name AS room_name,
        r.topic AS room_topic,
        u.id AS created_by_id,
        u.display_name AS created_by_name
      FROM invite_codes ic
      JOIN rooms r ON r.id = ic.room_id
      LEFT JOIN users u ON u.id = ic.created_by_user_id
      WHERE ic.code = $1
        AND ic.room_id IS NOT NULL
        AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
        AND ic.status = 'active'
        AND ic.used_count < ic.max_uses
      LIMIT 1
    `,
    [code]
  );

  const invite = result.rows[0];

  if (!invite) {
    return { ok: false, error: "invite_not_found" };
  }

  return {
    ok: true,
    invite: {
      code: invite.code,
      roomId: invite.room_id,
      roomName: invite.room_name,
      roomTopic: invite.room_topic,
      createdBy: invite.created_by_id
        ? {
            id: invite.created_by_id,
            name: invite.created_by_name
          }
        : null
    }
  };
}

export async function acceptRoomInvite({ token, code }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserBySessionToken(client, token);

    if (!user) {
      await client.query("ROLLBACK");
      return { ok: false, error: "unauthorized" };
    }

    const inviteResult = await client.query(
      `
        SELECT
          ic.id,
          ic.code,
          ic.room_id,
          ic.max_uses,
          ic.used_count,
          ic.status,
          ic.expires_at,
          r.slug AS room_slug,
          r.name AS room_name,
          r.kind AS room_kind,
          r.topic AS room_topic
        FROM invite_codes ic
        LEFT JOIN rooms r ON r.id = ic.room_id
        WHERE ic.code = $1
          AND ic.room_id IS NOT NULL
        FOR UPDATE
      `,
      [code]
    );

    const invite = inviteResult.rows[0];

    if (!invite) {
      await client.query("ROLLBACK");
      return { ok: false, error: "invite_not_found" };
    }

    if (!invite.room_slug) {
      await client.query("ROLLBACK");
      return { ok: false, error: "room_not_found" };
    }

    const membershipResult = await client.query(
      `
        SELECT 1
        FROM room_memberships
        WHERE room_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [invite.room_id, user.id]
    );

    const memberCountResult = await client.query(
      `
        SELECT COUNT(*)::int AS members
        FROM room_memberships
        WHERE room_id = $1
      `,
      [invite.room_id]
    );

    const room = {
      id: invite.room_slug,
      name: invite.room_name,
      kind: invite.room_kind,
      topic: invite.room_topic,
      members: memberCountResult.rows[0]?.members || 0
    };

    if (membershipResult.rows[0]) {
      await client.query("COMMIT");
      return {
        ok: true,
        room,
        joined: false
      };
    }

    const isExpired = invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
    const isUnavailable = invite.status !== "active" || invite.used_count >= invite.max_uses || isExpired;

    if (isUnavailable) {
      await client.query("ROLLBACK");
      return { ok: false, error: "invite_not_found" };
    }

    await client.query(
      `
        INSERT INTO room_memberships (room_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (room_id, user_id) DO NOTHING
      `,
      [invite.room_id, user.id]
    );

    await client.query(
      `
        UPDATE invite_codes
        SET
          used_count = used_count + 1,
          status = CASE
            WHEN used_count + 1 >= max_uses THEN 'exhausted'::invite_status
            ELSE status
          END
        WHERE id = $1
      `,
      [invite.id]
    );

    const nextMemberCountResult = await client.query(
      `
        SELECT COUNT(*)::int AS members
        FROM room_memberships
        WHERE room_id = $1
      `,
      [invite.room_id]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      room: {
        ...room,
        members: nextMemberCountResult.rows[0]?.members || room.members
      },
      joined: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
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

// =============================================
// TEAMS (бывшие "комнаты" — быстрые конференции)
// =============================================

export async function getTeams({ token }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return [];

  const result = await pool.query(
    `
      SELECT
        t.id,
        t.slug,
        t.name,
        t.topic,
        COUNT(tm.user_id)::int AS members
      FROM teams t
      JOIN team_memberships tm ON tm.team_id = t.id
      WHERE tm.user_id = $1
      GROUP BY t.id
      ORDER BY t.updated_at DESC
    `,
    [user.id]
  );

  return result.rows.map(row => ({
    id: row.slug,
    slug: row.slug,
    name: row.name,
    topic: row.topic,
    members: row.members
  }));
}

export async function createTeam({ token, name, topic = '' }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user || !name) return null;

  const slug = name
    .toLowerCase()
    .replace(/[а-яё]/g, c => {
      const map = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
      return map[c] || c;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const result = await pool.query(
    `
      WITH new_team AS (
        INSERT INTO teams (slug, name, topic, created_by_user_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, slug, name, topic, created_by_user_id
      )
      INSERT INTO team_memberships (team_id, user_id, role)
      SELECT id, $4, 'owner' FROM new_team
      RETURNING team_id
    `,
    [slug, name, topic, user.id]
  );

  if (result.rows.length === 0) {
    // Slug collision — попробуем с суффиксом
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
    const retry = await pool.query(
      `
        WITH new_team AS (
          INSERT INTO teams (slug, name, topic, created_by_user_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id, slug, name, topic, created_by_user_id
        )
        INSERT INTO team_memberships (team_id, user_id, role)
        SELECT id, $4, 'owner' FROM new_team
        RETURNING team_id
      `,
      [uniqueSlug, name, topic, user.id]
    );
    if (retry.rows.length === 0) return null;
  }

  return {
    id: slug,
    slug,
    name,
    topic,
    members: 1,
    kind: 'team'
  };
}

export async function getTeamById(teamId) {
  const pool = getPool();
  const [teamResult, membersResult] = await Promise.all([
    pool.query(
      `
        SELECT id, slug, name, topic, created_by_user_id
        FROM teams
        WHERE slug = $1
      `,
      [teamId]
    ),
    pool.query(
      `
        SELECT u.id, u.display_name, u.presence, tm.role
        FROM team_memberships tm
        JOIN users u ON u.id = tm.user_id
        JOIN teams t ON t.id = tm.team_id
        WHERE t.slug = $1
        ORDER BY lower(u.display_name) ASC
      `,
      [teamId]
    )
  ]);

  const team = teamResult.rows[0];
  if (!team) return null;

  return {
    id: team.slug,
    slug: team.slug,
    name: team.name,
    topic: team.topic,
    members: membersResult.rows.length,
    membersList: membersResult.rows.map(m => ({
      id: m.id,
      name: m.display_name,
      presence: m.presence,
      role: m.role
    }))
  };
}

// =============================================
// FRIENDSHIPS
// =============================================

export async function getFriends({ token }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return [];

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.display_name,
        u.presence,
        u.status_note,
        f.status as friendship_status,
        (SELECT COUNT(*) FROM direct_messages dm
         WHERE (dm.sender_id = $1 AND dm.receiver_id = u.id)
            OR (dm.sender_id = u.id AND dm.receiver_id = $1)
         AND dm.is_read = false
         AND dm.sender_id = u.id
        )::int as unread_count
      FROM friendships f
      JOIN users u ON (
        (f.user_id = $1 AND f.friend_id = u.id) OR
        (f.friend_id = $1 AND f.user_id = u.id)
      )
      WHERE f.status = 'accepted'
      ORDER BY lower(u.display_name) ASC
    `,
    [user.id]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.display_name,
    presence: row.presence,
    statusNote: row.status_note,
    unreadCount: row.unread_count
  }));
}

export async function getFriendRequests({ token }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return [];

  const result = await pool.query(
    `
      SELECT u.id, u.display_name, u.presence, f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `,
    [user.id]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.display_name,
    presence: row.presence,
    requestedAt: row.created_at
  }));
}

export async function sendFriendRequest({ token, friendId }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user || friendId === user.id) return { ok: false, error: 'invalid_target' };

  // Check if friend exists
  const exists = await pool.query('SELECT id FROM users WHERE id = $1', [friendId]);
  if (exists.rows.length === 0) return { ok: false, error: 'user_not_found' };

  // Check existing friendship
  const existing = await pool.query(
    'SELECT id, status FROM friendships WHERE user_id = $1 AND friend_id = $2',
    [user.id, friendId]
  );

  if (existing.rows.length > 0) {
    const status = existing.rows[0].status;
    if (status === 'accepted') return { ok: true, message: 'already_friends' };
    if (status === 'pending') return { ok: true, message: 'request_already_sent' };
    if (status === 'blocked') return { ok: false, error: 'blocked' };
  }

  await pool.query(
    'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [user.id, friendId, 'pending']
  );

  return { ok: true };
}

export async function acceptFriendRequest({ token, friendId }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return { ok: false, error: 'unauthorized' };

  const result = await pool.query(
    `UPDATE friendships SET status = 'accepted', updated_at = NOW()
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
     RETURNING id`,
    [friendId, user.id]
  );

  if (result.rows.length === 0) return { ok: false, error: 'request_not_found' };

  // Create reverse friendship entry too
  await pool.query(
    'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [user.id, friendId, 'accepted']
  );

  return { ok: true };
}

export async function removeFriend({ token, friendId }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return { ok: false, error: 'unauthorized' };

  await pool.query(
    'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
    [user.id, friendId]
  );

  return { ok: true };
}

// =============================================
// DIRECT MESSAGES
// =============================================

export async function getDirectMessages({ token, peerUserId }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return [];

  const result = await pool.query(
    `
      SELECT
        dm.id,
        dm.sender_id as "senderId",
        dm.receiver_id as "receiverId",
        dm.body,
        dm.is_read as "isRead",
        dm.created_at as "sentAt",
        u.display_name as "senderName"
      FROM direct_messages dm
      JOIN users u ON u.id = dm.sender_id
      WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
         OR (dm.sender_id = $2 AND dm.receiver_id = $1)
      ORDER BY dm.created_at ASC
    `,
    [user.id, peerUserId]
  );

  return result.rows.map(row => ({
    id: row.id,
    senderId: row.senderId,
    senderName: row.senderName,
    body: row.body,
    isRead: row.isRead,
    sentAt: row.sentAt
  }));
}

export async function sendDirectMessage({ token, receiverId, body }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user || !body?.trim()) return null;

  const result = await pool.query(
    `
      INSERT INTO direct_messages (sender_id, receiver_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, sender_id as "senderId", receiver_id as "receiverId", body, created_at as "sentAt"
    `,
    [user.id, receiverId, body.trim()]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    senderId: row.senderId,
    senderName: user.name,
    body: row.body,
    isRead: false,
    sentAt: row.sentAt
  };
}

export async function markDirectMessagesRead({ token, peerUserId }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return;

  await pool.query(
    `UPDATE direct_messages SET is_read = true
     WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`,
    [peerUserId, user.id]
  );
}

export async function getUnreadDMCount({ token }) {
  const pool = getPool();
  const user = await getSessionUser(token);
  if (!user) return 0;

  const result = await pool.query(
    'SELECT COUNT(*)::int as count FROM direct_messages WHERE receiver_id = $1 AND is_read = false',
    [user.id]
  );

  return result.rows[0]?.count || 0;
}
