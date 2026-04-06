import {
  clearSession,
  createRoomAccess,
  createSession,
  loginWithPassword,
  registerUser,
  createEvent,
  createMessage,
  getEvents,
  getFriends,
  getInvitePreview,
  getMessagesForRoom,
  getRoomById,
  getRooms,
  getRoomSocial,
  getRoomState,
  getSessionUser,
  getSummary,
  joinRoom,
  respondToEvent,
  updateProfile
} from "./store.js";
import { createLiveKitToken } from "./livekit-token.js";

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function routeRequest(req, res, config) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = url;
  const sessionToken = req.headers["x-session-token"];

  if (pathname === "/health") {
    return json(res, 200, { ok: true, service: "api" });
  }

  if (pathname === "/api/config") {
    return json(res, 200, {
      ok: true,
      data: {
        livekitUrl: config.livekitUrl
      }
    });
  }

  if (pathname === "/api/summary") {
    return json(res, 200, { ok: true, data: await getSummary() });
  }

  if (pathname === "/api/session/me") {
    const user = await getSessionUser(sessionToken);

    if (!user) {
      return json(res, 401, { ok: false, error: "unauthorized" });
    }

    return json(res, 200, { ok: true, data: user });
  }

  if (pathname === "/api/session/logout" && req.method === "POST") {
    if (sessionToken) {
      await clearSession(sessionToken);
    }

    return json(res, 200, { ok: true });
  }

  if (pathname === "/api/session/login" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const session = await createSession({ ...body, ttlSeconds: config.sessionTtlSeconds });

      if (!session) {
        return json(res, 400, { ok: false, error: "invalid_invite_or_name" });
      }

      return json(res, 200, { ok: true, data: session });
    } catch {
      return json(res, 400, { ok: false, error: "invalid_body" });
    }
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const session = await registerUser({
        code: body.code,
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        about: body.about,
        ttlSeconds: config.sessionTtlSeconds
      });

      if (!session) {
        return json(res, 400, { ok: false, error: "register_failed" });
      }

      return json(res, 200, { ok: true, data: session });
    } catch {
      return json(res, 400, { ok: false, error: "invalid_body" });
    }
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const session = await loginWithPassword({
        email: body.email,
        password: body.password,
        ttlSeconds: config.sessionTtlSeconds
      });

      if (!session) {
        return json(res, 401, { ok: false, error: "login_failed" });
      }

      return json(res, 200, { ok: true, data: session });
    } catch {
      return json(res, 400, { ok: false, error: "invalid_body" });
    }
  }

  if (pathname === "/api/profile") {
    if (req.method === "POST") {
      try {
        const body = await readJson(req);
        const profile = await updateProfile({
          token: sessionToken,
          displayName: body.displayName,
          about: body.about
        });

        if (!profile) {
          return json(res, 401, { ok: false, error: "profile_update_failed" });
        }

        return json(res, 200, { ok: true, data: profile });
      } catch {
        return json(res, 400, { ok: false, error: "invalid_body" });
      }
    }

    const user = await getSessionUser(sessionToken);
    if (!user) {
      return json(res, 401, { ok: false, error: "unauthorized" });
    }

    return json(res, 200, { ok: true, data: user });
  }

  if (pathname === "/api/rooms") {
    return json(res, 200, { ok: true, data: await getRooms() });
  }

  if (pathname.startsWith("/api/rooms/") && pathname.endsWith("/messages")) {
    const roomId = pathname.replace("/api/rooms/", "").replace("/messages", "");

    if (req.method === "POST") {
      try {
        const body = await readJson(req);
        const message = await createMessage({
          token: sessionToken,
          roomId,
          body: body.body
        });

        if (!message) {
          return json(res, 400, { ok: false, error: "message_create_failed" });
        }

        return json(res, 200, { ok: true, data: message });
      } catch {
        return json(res, 400, { ok: false, error: "invalid_body" });
      }
    }

    return json(res, 200, { ok: true, data: await getMessagesForRoom(roomId) });
  }

  if (pathname.startsWith("/api/rooms/")) {
    if (pathname.endsWith("/state")) {
      const roomId = pathname.replace("/api/rooms/", "").replace("/state", "");
      const state = await getRoomState({ token: sessionToken, roomId });

      if (!state) {
        return json(res, 404, { ok: false, error: "room_not_found" });
      }

      return json(res, 200, { ok: true, data: state });
    }

    if (pathname.endsWith("/social")) {
      const roomId = pathname.replace("/api/rooms/", "").replace("/social", "");
      const social = await getRoomSocial(roomId);

      if (!social) {
        return json(res, 404, { ok: false, error: "room_not_found" });
      }

      return json(res, 200, { ok: true, data: social });
    }

    if (pathname.endsWith("/token")) {
      const roomId = pathname.replace("/api/rooms/", "").replace("/token", "");
      const access = await createRoomAccess({ token: sessionToken, roomId, ttlSeconds: 3600 });

      if (!access) {
        return json(res, 401, { ok: false, error: "voice_access_denied" });
      }

      const token = createLiveKitToken({
        apiKey: config.livekitApiKey,
        apiSecret: config.livekitApiSecret,
        identity: access.identity,
        name: access.name,
        roomName: access.roomName,
        ttlSeconds: access.ttlSeconds
      });

      return json(res, 200, {
        ok: true,
        data: {
          token,
          wsUrl: config.livekitUrl,
          roomId: access.roomName,
          identity: access.identity,
          name: access.name,
          expiresIn: access.ttlSeconds
        }
      });
    }

    if (pathname.endsWith("/join") && req.method === "POST") {
      const roomId = pathname.replace("/api/rooms/", "").replace("/join", "");
      const result = await joinRoom({ token: sessionToken, roomId });

      if (!result) {
        return json(res, 400, { ok: false, error: "join_failed" });
      }

      return json(res, 200, { ok: true, data: result });
    }

    const roomId = pathname.replace("/api/rooms/", "");
    const room = await getRoomById(roomId);

    if (!room) {
      return json(res, 404, { ok: false, error: "room_not_found" });
    }

    return json(res, 200, { ok: true, data: room });
  }

  if (pathname === "/api/friends") {
    return json(res, 200, { ok: true, data: await getFriends() });
  }

  if (pathname === "/api/events") {
    if (req.method === "POST") {
      try {
        const body = await readJson(req);
        const event = await createEvent({
          token: sessionToken,
          title: body.title,
          startsAt: body.startsAt,
          roomId: body.roomId
        });

        if (!event) {
          return json(res, 400, { ok: false, error: "event_create_failed" });
        }

        return json(res, 200, { ok: true, data: event });
      } catch {
        return json(res, 400, { ok: false, error: "invalid_body" });
      }
    }

    return json(res, 200, { ok: true, data: await getEvents() });
  }

  if (pathname.startsWith("/api/events/") && pathname.endsWith("/rsvp") && req.method === "POST") {
    const eventId = pathname.replace("/api/events/", "").replace("/rsvp", "");

    try {
      const body = await readJson(req);
      const event = await respondToEvent({
        token: sessionToken,
        eventId,
        response: body.response
      });

      if (!event) {
        return json(res, 400, { ok: false, error: "event_rsvp_failed" });
      }

      return json(res, 200, { ok: true, data: event });
    } catch {
      return json(res, 400, { ok: false, error: "invalid_body" });
    }
  }

  if (pathname === "/api/invite-preview") {
    const invite = await getInvitePreview(searchParams.get("code"));

    if (!invite) {
      return json(res, 404, { ok: false, error: "invite_not_found" });
    }

    return json(res, 200, { ok: true, data: invite });
  }

  return json(res, 404, { ok: false, error: "not_found" });
}
