import { redirect } from "./response-helpers.js";

function sessionCookie(token) {
  return `mashenin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
}

export async function handleActionRoute({ req, res, apiFetch, readForm, sessionToken }) {
  if (req.url === "/auth/invite" && req.method === "POST") {
    try {
      const form = await readForm(req);
      const response = await apiFetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          code: String(form.code || ""),
          name: String(form.name || "")
        })
      });

      if (response.status !== 200) {
        redirect(res, `/invite/${String(form.code || "mashenin-2026")}`);
        return true;
      }

      const payload = await response.json();
      redirect(res, "/", {
        "Set-Cookie": sessionCookie(payload.data.token)
      });
    } catch {
      redirect(res, "/invite/mashenin-2026");
    }

    return true;
  }

  if (req.url === "/auth/register" && req.method === "POST") {
    try {
      const form = await readForm(req);
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          code: String(form.code || "mashenin-2026"),
          email: String(form.email || ""),
          password: String(form.password || ""),
          displayName: String(form.display_name || ""),
          about: String(form.about || "")
        })
      });

      if (response.status !== 200) {
        redirect(res, "/register");
        return true;
      }

      const payload = await response.json();
      redirect(res, "/", {
        "Set-Cookie": sessionCookie(payload.data.token)
      });
    } catch {
      redirect(res, "/register");
    }

    return true;
  }

  if (req.url === "/auth/login" && req.method === "POST") {
    try {
      const form = await readForm(req);
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          email: String(form.email || ""),
          password: String(form.password || "")
        })
      });

      if (response.status !== 200) {
        redirect(res, "/login");
        return true;
      }

      const payload = await response.json();
      redirect(res, "/", {
        "Set-Cookie": sessionCookie(payload.data.token)
      });
    } catch {
      redirect(res, "/login");
    }

    return true;
  }

  if (req.url === "/profile/update" && req.method === "POST") {
    try {
      const form = await readForm(req);
      await apiFetch(
        "/api/profile",
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            displayName: String(form.display_name || ""),
            about: String(form.about || "")
          })
        },
        sessionToken
      );
    } catch {}

    redirect(res, "/profile");
    return true;
  }

  if (req.url === "/logout") {
    try {
      if (sessionToken) {
        await apiFetch("/api/session/logout", { method: "POST" }, sessionToken);
      }
    } catch {}

    redirect(res, "/", {
      "Set-Cookie": "mashenin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    });
    return true;
  }

  if (req.url?.startsWith("/join/")) {
    const roomId = req.url.replace("/join/", "");

    if (!sessionToken) {
      redirect(res, "/invite/mashenin-2026");
      return true;
    }

    try {
      await apiFetch(`/api/rooms/${roomId}/join`, { method: "POST" }, sessionToken);
    } catch {}

    redirect(res, `/room/${roomId}`);
    return true;
  }

  if (req.url?.startsWith("/room/") && req.url.endsWith("/message") && req.method === "POST") {
    const roomId = req.url.replace("/room/", "").replace("/message", "");

    try {
      const form = await readForm(req);
      await apiFetch(
        `/api/rooms/${roomId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ body: String(form.body || "") })
        },
        sessionToken
      );
    } catch {}

    redirect(res, `/room/${roomId}`);
    return true;
  }

  if (req.url === "/events/create" && req.method === "POST") {
    try {
      const form = await readForm(req);
      await apiFetch(
        "/api/events",
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            title: String(form.title || ""),
            startsAt: String(form.starts_at || ""),
            roomId: String(form.room_id || "general")
          })
        },
        sessionToken
      );
    } catch {}

    redirect(res, "/events");
    return true;
  }

  if (req.url?.startsWith("/event/") && req.url.endsWith("/rsvp") && req.method === "POST") {
    const eventId = req.url.replace("/event/", "").replace("/rsvp", "");

    try {
      const form = await readForm(req);
      await apiFetch(
        `/api/events/${eventId}/rsvp`,
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ response: String(form.response || "going") })
        },
        sessionToken
      );
    } catch {}

    redirect(res, "/events");
    return true;
  }

  return false;
}
