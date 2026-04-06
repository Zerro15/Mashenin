import {
  adminHtml,
  createHtml,
  eventsHtml,
  friendsHtml,
  homeHtml,
  loginHtml,
  registerHtml,
  roomsHtml,
  settingsHtml
} from "../views.js";
import { redirect, sendHtml } from "./response-helpers.js";

export async function handlePageRoute({ req, res, apiFetch, sessionToken, apiBaseUrl }) {
  if (req.url === "/login") {
    sendHtml(res, 200, loginHtml());
    return true;
  }

  if (req.url === "/register") {
    sendHtml(res, 200, registerHtml());
    return true;
  }

  if (req.url === "/profile") {
    redirect(res, "/settings");
    return true;
  }

  if (req.url === "/settings") {
    try {
      const response = await apiFetch("/api/profile", {}, sessionToken);
      const payload = response.status === 200 ? await response.json() : { data: null };
      sendHtml(res, 200, settingsHtml(payload.data));
    } catch {
      sendHtml(res, 200, settingsHtml(null));
    }

    return true;
  }

  if (req.url === "/rooms") {
    sendHtml(res, 200, roomsHtml());
    return true;
  }

  if (req.url === "/friends") {
    sendHtml(res, 200, friendsHtml());
    return true;
  }

  if (req.url === "/events") {
    sendHtml(res, 200, eventsHtml());
    return true;
  }

  if (req.url === "/create") {
    sendHtml(res, 200, createHtml());
    return true;
  }

  if (req.url === "/admin") {
    sendHtml(res, 200, adminHtml());
    return true;
  }

  if (req.url === "/" || req.url === "") {
    sendHtml(res, 200, homeHtml({ sessionToken, apiBaseUrl }));
    return true;
  }

  return false;
}
