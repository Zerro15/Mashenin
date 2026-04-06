import http from "node:http";
import { createApiClient } from "./lib/api.js";
import { getCookie, json, readForm } from "./lib/http.js";
import { handleActionRoute } from "./lib/server/action-routes.js";
import { handleFetchRoute } from "./lib/server/fetch-routes.js";
import { handlePageRoute } from "./lib/server/page-routes.js";
import { sendHtml } from "./lib/server/response-helpers.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const { apiFetch, proxyJson } = createApiClient(apiBaseUrl);

const server = http.createServer(async (req, res) => {
  const sessionToken = getCookie(req, "mashenin_session");

  if (req.url === "/health") {
    return json(res, 200, { ok: true, service: "web" });
  }

  if (req.url === "/data/me" || req.url === "/me") {
    return proxyJson(res, "/api/session/me", { ok: false, error: "api_unavailable", data: null }, sessionToken);
  }

  if (req.url === "/data/rooms") {
    return proxyJson(res, "/api/rooms", { ok: false, error: "api_unavailable", data: [] });
  }

  if (req.url === "/data/friends") {
    return proxyJson(res, "/api/friends", { ok: false, error: "api_unavailable", data: [] });
  }

  if (req.url === "/data/events") {
    return proxyJson(res, "/api/events", { ok: false, error: "api_unavailable", data: [] });
  }

  if (req.url === "/data/summary" || req.url === "/summary") {
    return proxyJson(res, "/api/summary", { ok: false, error: "api_unavailable", data: {} });
  }

  if (req.url?.startsWith("/data/room/") && req.url.endsWith("/voice")) {
    const roomId = req.url.replace("/data/room/", "").replace("/voice", "");
    return proxyJson(
      res,
      `/api/rooms/${roomId}/token`,
      { ok: false, error: "api_unavailable" },
      sessionToken
    );
  }

  if (req.url?.startsWith("/data/room/") && req.url.endsWith("/join") && req.method === "POST") {
    const roomId = req.url.replace("/data/room/", "").replace("/join", "");
    return proxyJson(
      res,
      `/api/rooms/${roomId}/join`,
      { ok: false, error: "api_unavailable" },
      sessionToken,
      { method: "POST" }
    );
  }

  if (req.url?.startsWith("/data/room/") && req.url.endsWith("/state")) {
    const roomId = req.url.replace("/data/room/", "").replace("/state", "");
    return proxyJson(
      res,
      `/api/rooms/${roomId}/state`,
      { ok: false, error: "api_unavailable" },
      sessionToken
    );
  }

  if (req.url?.startsWith("/data/room/") && req.url.endsWith("/social")) {
    const roomId = req.url.replace("/data/room/", "").replace("/social", "");
    return proxyJson(
      res,
      `/api/rooms/${roomId}/social`,
      { ok: false, error: "api_unavailable" },
      sessionToken
    );
  }

  if (await handleActionRoute({ req, res, apiFetch, readForm, sessionToken })) {
    return;
  }

  if (await handleFetchRoute({ req, res, apiFetch })) {
    return;
  }

  if (await handlePageRoute({ req, res, apiFetch, sessionToken, apiBaseUrl })) {
    return;
  }

  sendHtml(res, 404, "<h1>Страница не найдена</h1>");
});

server.listen(port, host, () => {
  console.log(`web listening on ${host}:${port}`);
});
