import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { events, friends, roomMessages, rooms } from "../../../../packages/shared/src/mock-data.js";

const dataDir = path.resolve(process.cwd(), "data");
const stateFile = path.join(dataDir, "runtime-state.json");

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedState() {
  return {
    users: friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      status: friend.status,
      note: friend.note,
      roomId: friend.roomId || null,
      email: null,
      passwordHash: null,
      about: ""
    })),
    rooms: clone(rooms),
    events: clone(events),
    messages: clone(roomMessages),
    inviteCodes: [
      {
        code: "mashenin-2026",
        groupName: "mashenin",
        invitedBy: "Богдан",
        availableSlots: 1000,
        usedCount: 0
      }
    ],
    sessions: [],
    roomMemberships: []
  };
}

function normalizeState(state) {
  state.users = (state.users || []).map((user) => ({
    ...user,
    email: user.email || null,
    passwordHash: user.passwordHash || null,
    about: user.about || ""
  }));
  state.rooms = state.rooms || [];
  state.events = state.events || [];
  state.messages = state.messages || [];
  state.inviteCodes = state.inviteCodes || [];
  state.sessions = state.sessions || [];
  state.roomMemberships = state.roomMemberships || [];
  return state;
}

function ensureStateFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(seedState(), null, 2));
  }
}

function pruneExpiredSessions(state) {
  const now = Date.now();
  state.sessions = state.sessions.filter((session) => session.expiresAt > now);
  return state;
}

export function readState() {
  ensureStateFile();
  const raw = fs.readFileSync(stateFile, "utf8");
  const state = normalizeState(pruneExpiredSessions(JSON.parse(raw)));
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

export function writeState(state) {
  ensureStateFile();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

export function updateState(updater) {
  const state = readState();
  const nextState = updater(state) || state;
  writeState(nextState);
  return nextState;
}

export function getStateFilePath() {
  return stateFile;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    status: user.status,
    note: user.note,
    roomId: user.roomId || null,
    email: user.email || null,
    about: user.about || ""
  };
}

function buildSessionRecord(userId, ttlSeconds) {
  return {
    token: `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlSeconds * 1000
  };
}

function getSessionRecord(token) {
  const state = readState();
  return state.sessions.find((session) => session.token === token) || null;
}

function slugifyRoomName(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return normalized || `room-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSessionPayload(user, ttlSeconds, state) {
  const session = buildSessionRecord(user.id, ttlSeconds);
  state.sessions = state.sessions.filter((entry) => entry.userId !== user.id);
  state.sessions.push(session);

  return {
    token: session.token,
    user: publicUser(user),
    expiresAt: session.expiresAt
  };
}

export async function getSummary() {
  const state = readState();
  const onlineFriends = state.users.filter((friend) => friend.status !== "away").length;
  const inVoiceFriends = state.users.filter((friend) => friend.status === "in_voice").length;
  const activeRooms = state.rooms.filter((room) => room.members > 0).length;

  return {
    totalFriends: state.users.length,
    onlineFriends,
    inVoiceFriends,
    activeRooms
  };
}

export async function getRooms() {
  return readState().rooms;
}

export async function getFriends() {
  return readState().users.map(publicUser);
}

export async function getEvents() {
  return readState().events;
}

export async function getRoomById(roomId) {
  const state = readState();
  const room = state.rooms.find((entry) => entry.id === roomId);

  if (!room) {
    return null;
  }

  const speakers = state.users.filter((friend) => friend.roomId === roomId);

  return {
    ...room,
    speakers: speakers.map(publicUser)
  };
}

export async function getMessagesForRoom(roomId) {
  return readState().messages.filter((message) => message.roomId === roomId);
}

export async function getInvitePreview(code) {
  return readState().inviteCodes.find((invite) => invite.code === code) || null;
}

export async function createSession({ code, name, ttlSeconds = 604800 }) {
  let createdSession = null;

  updateState((state) => {
    const invite = state.inviteCodes.find((entry) => entry.code === code);

    if (!invite || !name) {
      return state;
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      return state;
    }

    const inviteExhausted = invite.availableSlots <= 0;

    const existingFriend = state.users.find(
      (friend) => friend.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (!existingFriend && inviteExhausted) {
      return state;
    }

    const user =
      existingFriend ||
      {
        id: `u${state.users.length + 1}`,
        name: normalizedName,
        status: "online",
        note: "только что зашел в клуб",
        roomId: null
      };

    if (!existingFriend) {
      state.users.push(user);
      invite.availableSlots -= 1;
      invite.usedCount += 1;
    }

    createdSession = buildSessionPayload(user, ttlSeconds, state);

    return state;
  });

  return createdSession;
}

export async function getSessionUser(token) {
  const record = getSessionRecord(token);

  if (!record) {
    return null;
  }

  const user = readState().users.find((friend) => friend.id === record.userId) || null;
  return publicUser(user);
}

export async function clearSession(token) {
  updateState((state) => {
    state.sessions = state.sessions.filter((session) => session.token !== token);
    return state;
  });
}

export async function joinRoom({ token, roomId }) {
  let result = null;

  updateState((state) => {
    const session = state.sessions.find((entry) => entry.token === token);
    const user = session ? state.users.find((entry) => entry.id === session.userId) : null;
    const room = state.rooms.find((entry) => entry.id === roomId);

    if (!user || !room) {
      return state;
    }

    if (user.roomId === roomId) {
      result = { user: publicUser(user), room };
      return state;
    }

    for (const entry of state.rooms) {
      if (entry.id === user.roomId && entry.members > 0) {
        entry.members -= 1;
      }
    }

    user.roomId = roomId;
    user.status = "in_voice";
    user.note = `в комнате ${room.name}`;
    room.members += 1;

    result = { user: publicUser(user), room };
    return state;
  });

  return result;
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

export async function createRoom({ token, name, topic = '' }) {
  const normalizedName = String(name || '').trim();
  const normalizedTopic = String(topic || '').trim();

  if (!token || !normalizedName) {
    return null;
  }

  let createdRoom = null;

  updateState((state) => {
    const session = state.sessions.find((entry) => entry.token === token);
    const user = session ? state.users.find((entry) => entry.id === session.userId) : null;

    if (!user) {
      return state;
    }

    const slugBase = slugifyRoomName(normalizedName);
    const hasSameSlug = state.rooms.some((room) => room.id === slugBase || room.slug === slugBase);
    const roomId = hasSameSlug ? `${slugBase}-${Math.random().toString(36).slice(2, 6)}` : slugBase;

    const room = {
      id: roomId,
      slug: roomId,
      name: normalizedName,
      kind: 'persistent',
      topic: normalizedTopic || 'новая комната',
      members: 0
    };

    state.rooms.push(room);
    state.roomMemberships = state.roomMemberships || [];
    state.roomMemberships.push({
      roomId,
      userId: user.id,
      role: 'owner',
      joinedAt: Date.now()
    });

    createdRoom = {
      id: room.id,
      name: room.name,
      kind: room.kind,
      topic: room.topic,
      members: room.members,
      speakers: []
    };

    return state;
  });

  return createdRoom;
}

export async function registerUser({
  code,
  email,
  password,
  displayName,
  about = "",
  ttlSeconds = 604800
}) {
  const normalizedEmail = String(email || "").trim();
  const normalizedName = String(displayName || "").trim();

  if (!code || !normalizedEmail || !password || password.length < 6 || !normalizedName) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  let createdSession = null;

  updateState((state) => {
    const invite = state.inviteCodes.find((entry) => entry.code === code);
    if (!invite || invite.availableSlots <= 0) {
      return state;
    }

    const existingEmailUser = state.users.find((user) => user.email === normalizedEmail);
    if (existingEmailUser) {
      return state;
    }

    const user = {
      id: `u${state.users.length + 1}`,
      name: normalizedName,
      status: "online",
      note: "только что зарегистрировался",
      roomId: null,
      email: normalizedEmail,
      passwordHash,
      about: String(about || "").trim()
    };

    state.users.push(user);
    invite.availableSlots -= 1;
    invite.usedCount += 1;
    createdSession = buildSessionPayload(user, ttlSeconds, state);
    return state;
  });

  return createdSession;
}

export async function loginWithPassword({ email, password, ttlSeconds = 604800 }) {
  const normalizedEmail = String(email || "").trim();
  const state = readState();
  const user = state.users.find((entry) => entry.email === normalizedEmail);

  if (!user?.passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  let sessionPayload = null;

  updateState((nextState) => {
    const target = nextState.users.find((entry) => entry.id === user.id);
    if (!target) {
      return nextState;
    }

    target.status = target.roomId ? "in_voice" : "online";
    target.note = target.roomId ? target.note : "снова в сети";
    sessionPayload = buildSessionPayload(target, ttlSeconds, nextState);
    return nextState;
  });

  return sessionPayload;
}

export async function updateProfile({ token, displayName, about }) {
  const normalizedName = String(displayName || "").trim();
  const normalizedAbout = String(about || "").trim();
  let updated = null;

  updateState((state) => {
    const session = state.sessions.find((entry) => entry.token === token);
    const user = session ? state.users.find((entry) => entry.id === session.userId) : null;

    if (!user) {
      return state;
    }

    if (normalizedName) {
      user.name = normalizedName;
    }

    user.about = normalizedAbout;
    updated = publicUser(user);
    return state;
  });

  return updated;
}

export async function getInvite(code) {
  const state = readState();
  return state.inviteCodes.find(invite => invite.code === code && invite.status === 'active') || null;
}

export async function useInvite(code) {
  updateState((state) => {
    const invite = state.inviteCodes.find(invite => invite.code === code);
    if (invite) {
      invite.usedCount = (invite.usedCount || 0) + 1;
    }
    return state;
  });
}

export async function createUser({ id, username, email, passwordHash, roomId }) {
  updateState((state) => {
    const user = {
      id,
      name: username,
      email,
      passwordHash,
      status: 'online',
      note: '',
      about: '',
      createdAt: Date.now()
    };

    state.users.push(user);

    if (roomId) {
      const membership = {
        roomId,
        userId: id,
        role: 'member',
        joinedAt: Date.now()
      }
      state.roomMemberships = state.roomMemberships || [];
      state.roomMemberships.push(membership);
    }

    return state;
  });
}

export async function getRoom(roomId) {
  const state = readState();
  return state.rooms.find(room => room.id === roomId || room.slug === roomId) || null;
}

export async function getRoomMembers(roomId) {
  const state = readState();
  const memberships = state.roomMemberships?.filter(m => m.roomId === roomId) || []

  return memberships.map(membership => {
    const user = state.users.find(u => u.id === membership.userId)
    return user ? {
      id: user.id,
      name: user.name,
      status: user.status,
      note: user.note,
      role: membership.role,
      joinedAt: membership.joinedAt
    } : null
  }).filter(Boolean)
}

export async function getRoomPresence(roomId) {
  const state = readState();
  const memberships = state.roomMemberships?.filter(m => m.roomId === roomId) || []

  return memberships.map(membership => {
    const user = state.users.find(u => u.id === membership.userId)
    return user ? {
      userId: user.id,
      name: user.name,
      status: user.status,
      note: user.note,
      voiceRoom: user.roomId
    } : null
  }).filter(Boolean)
}

export async function updateUserPresence(roomId, userId, status) {
  updateState((state) => {
    const user = state.users.find(u => u.id === userId)
    if (user) {
      user.status = status
    }
    return state
  })
}

export async function saveMessage(roomId, message) {
  updateState((state) => {
    state.messages = state.messages || []
    state.messages.push({
      id: message.id,
      roomId,
      userId: message.userId,
      content: message.content,
      timestamp: message.timestamp
    })
    return state
  })
}

export async function getMessages(roomId, limit = 50, offset = 0) {
  const state = readState()
  const messages = state.messages?.filter(m => m.roomId === roomId) || []

  return messages
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(offset, offset + limit)
    .reverse()
    .map(msg => {
      const user = state.users.find(u => u.id === msg.userId)
      return {
        id: msg.id,
        userId: msg.userId,
        userName: user?.name || 'Unknown',
        content: msg.content,
        timestamp: msg.timestamp
      }
    })
}

export async function getRoomState({ token, roomId }) {
  const user = await getSessionUser(token);
  const room = await getRoomById(roomId);

  if (!room) {
    return null;
  }

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
  const room = await getRoomById(roomId);
  const state = readState();

  if (!room) {
    return null;
  }

  const availableToInvite = state.users
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

  let created = null;

  updateState((state) => {
    const session = state.sessions.find((entry) => entry.token === token);
    const user = session ? state.users.find((entry) => entry.id === session.userId) : null;
    const room = state.rooms.find((entry) => entry.id === roomId);

    if (!user || !room) {
      return state;
    }

    const message = {
      id: `m${state.messages.length + 1}`,
      roomId,
      author: user.name,
      sentAt: new Date().toISOString(),
      text: trimmed
    };

    state.messages.push(message);
    created = message;
    return state;
  });

  return created;
}

export async function createEvent({ token, title, startsAt, roomId = null }) {
  const trimmedTitle = (title || "").trim();
  if (!trimmedTitle || !startsAt) {
    return null;
  }

  let created = null;

  updateState((state) => {
    const session = state.sessions.find((entry) => entry.token === token);
    const user = session ? state.users.find((entry) => entry.id === session.userId) : null;

    if (!user) {
      return state;
    }

    const event = {
      id: `e${state.events.length + 1}`,
      title: trimmedTitle,
      startsAt,
      attendees: 1,
      roomId: roomId || "general",
      attendeesByUserId: { [user.id]: "going" }
    };

    state.events.push(event);
    created = event;
    return state;
  });

  return created;
}

export async function respondToEvent({ token, eventId, response }) {
  const allowed = new Set(["going", "maybe", "declined"]);
  if (!allowed.has(response)) {
    return null;
  }

  let updated = null;

  updateState((state) => {
    const session = state.sessions.find((entry) => entry.token === token);
    const user = session ? state.users.find((entry) => entry.id === session.userId) : null;
    const event = state.events.find((entry) => entry.id === eventId);

    if (!user || !event) {
      return state;
    }

    event.attendeesByUserId = event.attendeesByUserId || {};
    event.attendeesByUserId[user.id] = response;
    event.attendees = Object.values(event.attendeesByUserId).filter((value) => value === "going").length;
    updated = event;
    return state;
  });

  return updated;
}
