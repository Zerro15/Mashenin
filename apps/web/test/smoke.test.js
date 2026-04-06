import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";

const host = "127.0.0.1";
const port = "3110";
const apiPort = "4110";
const baseUrl = `http://${host}:${port}`;
const apiBaseUrl = `http://${host}:${apiPort}`;

let serverProcess = null;
let apiServer = null;

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("web server did not start within 5s"));
    }, 5000);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
      child.off("exit", onExit);
    }

    function onStdout(chunk) {
      if (String(chunk).includes(`web listening on ${host}:${port}`)) {
        cleanup();
        resolve();
      }
    }

    function onStderr(chunk) {
      const text = String(chunk);
      if (text.trim()) {
        cleanup();
        reject(new Error(`web server stderr: ${text.trim()}`));
      }
    }

    function onExit(code) {
      cleanup();
      reject(new Error(`web server exited before ready with code ${code}`));
    }

    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.on("exit", onExit);
  });
}

async function fetchHtml(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const body = await response.text();
  return { response, body };
}

function startMockApiServer() {
  apiServer = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/invite-preview" && url.searchParams.get("code") === "mashenin-2026") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        data: {
          code: "mashenin-2026",
          groupName: "mashenin core",
          availableSlots: 42,
          invitedBy: "zerro"
        }
      }));
      return;
    }

    if (url.pathname === "/api/rooms/general") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        data: {
          id: "general",
          name: "Общая",
          kind: "permanent",
          topic: "Главный голосовой канал команды",
          members: 2,
          speakers: [
            { id: "u1", name: "Артем", status: "in_voice", note: "в комнате Общая" },
            { id: "u2", name: "Лена", status: "online", note: "слушает разговор" }
          ]
        }
      }));
      return;
    }

    if (url.pathname === "/api/rooms/general/messages") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        data: [
          {
            id: "m1",
            roomId: "general",
            author: "Артем",
            sentAt: "2026-04-04T10:00:00.000Z",
            text: "Созвон уже идет, залетай."
          }
        ]
      }));
      return;
    }

    if (url.pathname === "/api/profile") {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  return new Promise((resolve, reject) => {
    apiServer.once("error", reject);
    apiServer.listen(Number(apiPort), host, resolve);
  });
}

before(async () => {
  await startMockApiServer();

  serverProcess = spawn("node", ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      HOST: host,
      PORT: port,
      API_BASE_URL: apiBaseUrl
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await waitForServerReady(serverProcess);
});

after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGINT");
  }

  if (apiServer) {
    apiServer.close();
  }
});

describe("web SSR smoke", () => {
  test("/login renders login form", async () => {
    const { response, body } = await fetchHtml("/login");

    assert.equal(response.status, 200);
    assert.match(body, /<title>Вход<\/title>/);
    assert.match(body, /action="\/auth\/login"/);
  });

  test("/register renders register form", async () => {
    const { response, body } = await fetchHtml("/register");

    assert.equal(response.status, 200);
    assert.match(body, /<title>Регистрация<\/title>/);
    assert.match(body, /name="display_name"/);
    assert.match(body, /action="\/auth\/register"/);
  });

  test("/rooms renders rooms page shell", async () => {
    const { response, body } = await fetchHtml("/rooms");

    assert.equal(response.status, 200);
    assert.match(body, /mashenin · Комнаты/);
    assert.match(body, /id="rooms"/);
  });

  test("/settings renders settings page shell", async () => {
    const { response, body } = await fetchHtml("/settings");

    assert.equal(response.status, 200);
    assert.match(body, /mashenin · Настройки/);
    assert.match(body, /id="profile-section"/);
  });

  test("/admin renders admin page shell", async () => {
    const { response, body } = await fetchHtml("/admin");

    assert.equal(response.status, 200);
    assert.match(body, /mashenin · Панель/);
    assert.match(body, /mashenin_session/);
  });

  test("/invite/:code renders invite SSR via API stub", async () => {
    const { response, body } = await fetchHtml("/invite/mashenin-2026");

    assert.equal(response.status, 200);
    assert.match(body, /mashenin core/);
    assert.match(body, /Войти по коду mashenin-2026/);
    assert.match(body, /42/);
  });

  test("/room/:id renders room SSR via API stub", async () => {
    const { response, body } = await fetchHtml("/room/general");

    assert.equal(response.status, 200);
    assert.match(body, /mashenin · Общая/);
    assert.match(body, /Главный голосовой канал команды/);
    assert.match(body, /Созвон уже идет, залетай\./);
    assert.match(body, /Артем/);
  });
});
