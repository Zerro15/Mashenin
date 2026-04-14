import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const webPort = 3111;
const apiPort = 4111;
const webBaseUrl = `http://${host}:${webPort}`;
const apiBaseUrl = `http://${host}:${apiPort}`;

const webRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repoRoot = path.resolve(webRoot, '..', '..');
const apiServerEntry = path.resolve(repoRoot, 'apps/api/src/server.js');

let apiProcess = null;
let webProcess = null;
let browser = null;
let page = null;
let tempApiDir = null;
let apiStderr = '';
let webStderr = '';

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcessSafe(child) {
  if (child && !child.killed) {
    child.kill('SIGINT');
  }
}

function removeDirSafe(targetPath) {
  if (targetPath) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

async function waitForHttpOk(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function createSeedUserAndRoom() {
  const email = `text-mvp.${uniqueSuffix()}@example.com`;
  const password = 'secret123';
  const displayName = `Text MVP ${uniqueSuffix()}`;
  const roomName = `Regression Room ${uniqueSuffix()}`;

  const registerResponse = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName
    })
  });

  assert.equal(registerResponse.status, 200);
  const registerBody = await registerResponse.json();
  assert.equal(registerBody.ok, true);
  assert.equal(typeof registerBody.token, 'string');

  const createRoomResponse = await fetch(`${apiBaseUrl}/api/rooms`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${registerBody.token}`
    },
    body: JSON.stringify({
      name: roomName,
      topic: 'Regression room topic'
    })
  });

  assert.equal(createRoomResponse.status, 200);
  const createRoomBody = await createRoomResponse.json();
  assert.equal(createRoomBody.ok, true);
  assert.equal(typeof createRoomBody.room?.id, 'string');

  return {
    email,
    password,
    roomId: createRoomBody.room.id,
    roomName
  };
}

before(async () => {
  tempApiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mashenin-text-mvp-api-'));

  apiProcess = spawn('node', [apiServerEntry], {
    cwd: tempApiDir,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(apiPort),
      DATA_PROVIDER: 'file'
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  apiProcess.stderr?.on('data', (chunk) => {
    apiStderr += String(chunk);
  });

  try {
    await waitForHttpOk(`${apiBaseUrl}/health`);
  } catch (error) {
    throw new Error(`API failed to start: ${error.message}\n${apiStderr.trim()}`);
  }

  webProcess = spawn(
    'node',
    [
      path.resolve(webRoot, 'node_modules/next/dist/bin/next'),
      'dev',
      '-H',
      host,
      '-p',
      String(webPort)
    ],
    {
      cwd: webRoot,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: apiBaseUrl
      },
      stdio: ['ignore', 'ignore', 'pipe']
    }
  );
  webProcess.stderr?.on('data', (chunk) => {
    webStderr += String(chunk);
  });

  try {
    await waitForHttpOk(`${webBaseUrl}/login`, 60000);
  } catch (error) {
    throw new Error(`Web failed to start: ${error.message}\n${webStderr.trim()}`);
  }

  browser = await chromium.launch({
    headless: true
  });
  page = await browser.newPage();
});

after(async () => {
  await page?.close().catch(() => {});
  await browser?.close().catch(() => {});

  killProcessSafe(webProcess);
  killProcessSafe(apiProcess);
  await wait(500);
  removeDirSafe(tempApiDir);
});

test('text MVP regression: login -> /rooms -> open room -> send message -> refresh -> logout', async () => {
  const seeded = await createSeedUserAndRoom();
  const messageText = `Regression message ${uniqueSuffix()}`;

  await page.goto(`${webBaseUrl}/login`, { waitUntil: 'domcontentloaded' });

  await page.locator('input[type="email"]').fill(seeded.email);
  await page.locator('input[type="password"]').fill(seeded.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(`${webBaseUrl}/rooms`);
  await page.locator(`a[href="/room/${seeded.roomId}"]`).waitFor();
  await page.locator(`a[href="/room/${seeded.roomId}"]`).click();

  await page.waitForURL(`${webBaseUrl}/room/${seeded.roomId}`);
  await page.locator('form.composer-form textarea.text-area').waitFor();

  await page.locator('form.composer-form textarea.text-area').fill(messageText);
  await page.locator('form.composer-form button[type="submit"]').click();
  await page.locator('.message-text').filter({ hasText: messageText }).waitFor();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.message-text').filter({ hasText: messageText }).waitFor();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL(`${webBaseUrl}/login`);
});
