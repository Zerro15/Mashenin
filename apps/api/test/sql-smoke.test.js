import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { createPool, closePool } from '../src/lib/sql.js';

// ============================================================
// Shared SQL pool — created once, closed after all tests
// ============================================================
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 55432,
  database: 'mashenin',
  user: 'mashenin',
  password: 'mashenin_dev_pass'
};

test.before(async () => {
  process.env.DATA_PROVIDER = 'sql';
  process.env.POSTGRES_HOST = DB_CONFIG.host;
  process.env.POSTGRES_PORT = String(DB_CONFIG.port);
  process.env.POSTGRES_USER = DB_CONFIG.user;
  process.env.POSTGRES_PASSWORD = DB_CONFIG.password;
  process.env.POSTGRES_DB = DB_CONFIG.database;
  await createPool(DB_CONFIG);
});

test.after(async () => {
  await closePool();
});

// ============================================================
// Helpers
// ============================================================
let emailCounter = 0;
function uniqueEmail() {
  emailCounter++;
  return `sql-smoke.${emailCounter}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAndLogin(app, name, email, password) {
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, displayName: name }
  });
  assert.equal(registerRes.statusCode, 200);

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password }
  });
  assert.equal(loginRes.statusCode, 200);
  return loginRes.json().token;
}

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

// ============================================================
// One server instance for all tests (avoids route re-registration)
// ============================================================
const app = await buildServer();

test.after(async () => {
  await app.close();
});

// ============================================================
// TEAMS FLOW IN SQL MODE
// ============================================================
test('SQL teams: create -> list -> send message -> read', async () => {
  const token = await registerAndLogin(app, 'TeamsUser', uniqueEmail(), 'pass123');

  // Create team
  const createRes = await app.inject({
    method: 'POST', url: '/api/teams',
    headers: auth(token),
    payload: { name: `SQL Team ${Date.now()}`, topic: 'testing sql mode' }
  });
  assert.equal(createRes.statusCode, 200);
  const team = createRes.json().team;
  assert.equal(team.name.startsWith('SQL Team'), true);
  assert.equal(team.members, 1);

  // List teams
  const listRes = await app.inject({
    method: 'GET', url: '/api/teams',
    headers: auth(token)
  });
  assert.equal(listRes.statusCode, 200);
  const teams = listRes.json().teams;
  assert.ok(teams.some(t => t.id === team.id));

  // Send team message
  const sendRes = await app.inject({
    method: 'POST', url: `/api/teams/${team.id}/messages`,
    headers: auth(token),
    payload: { body: 'Hello from SQL!' }
  });
  assert.equal(sendRes.statusCode, 200);
  assert.equal(sendRes.json().message.text, 'Hello from SQL!');

  // Read team messages
  const readRes = await app.inject({
    method: 'GET', url: `/api/teams/${team.id}/messages`,
    headers: auth(token)
  });
  assert.equal(readRes.statusCode, 200);
  const messages = readRes.json().messages;
  assert.ok(messages.some(m => m.text === 'Hello from SQL!'));
});

// ============================================================
// ROOM MESSAGE EDIT / DELETE IN SQL MODE
// ============================================================
test('SQL rooms: send -> edit -> delete message', async () => {
  const token = await registerAndLogin(app, 'EditUser', uniqueEmail(), 'pass123');

  // Create room
  const createRoomRes = await app.inject({
    method: 'POST', url: '/api/rooms',
    headers: auth(token),
    payload: { name: `Edit Test Room ${Date.now()}` }
  });
  assert.equal(createRoomRes.statusCode, 200);
  const roomId = createRoomRes.json().room.id;

  // Send message
  const sendRes = await app.inject({
    method: 'POST', url: `/api/rooms/${roomId}/messages`,
    headers: auth(token),
    payload: { body: 'Original text' }
  });
  assert.equal(sendRes.statusCode, 200);
  const messageId = sendRes.json().message.id;

  // Edit message
  const editRes = await app.inject({
    method: 'PUT', url: `/api/rooms/${roomId}/messages/${messageId}`,
    headers: auth(token),
    payload: { body: 'Edited text' }
  });
  assert.equal(editRes.statusCode, 200);
  assert.equal(editRes.json().message.text, 'Edited text');

  // Verify edited message in history
  const histRes = await app.inject({
    method: 'GET', url: `/api/rooms/${roomId}/messages`,
    headers: auth(token)
  });
  assert.equal(histRes.statusCode, 200);
  assert.ok(histRes.json().messages.some(m => m.text === 'Edited text'));

  // Delete message
  const delRes = await app.inject({
    method: 'DELETE', url: `/api/rooms/${roomId}/messages/${messageId}`,
    headers: auth(token)
  });
  assert.equal(delRes.statusCode, 200);

  // Verify message is gone
  const histAfterRes = await app.inject({
    method: 'GET', url: `/api/rooms/${roomId}/messages`,
    headers: auth(token)
  });
  assert.equal(histAfterRes.statusCode, 200);
  assert.ok(!histAfterRes.json().messages.some(m => m.id === messageId));

  // Edit non-existent message
  const editBadRes = await app.inject({
    method: 'PUT', url: `/api/rooms/${roomId}/messages/00000000-0000-0000-0000-000000000000`,
    headers: auth(token),
    payload: { body: 'nope' }
  });
  assert.equal(editBadRes.statusCode, 404);

  // Delete as non-author
  const token2 = await registerAndLogin(app, 'OtherUser', uniqueEmail(), 'pass123');
  const delBadRes = await app.inject({
    method: 'POST', url: `/api/rooms/${roomId}/messages`,
    headers: auth(token),
    payload: { body: 'Author message' }
  });
  const authorMsgId = delBadRes.json().message.id;

  const delOtherRes = await app.inject({
    method: 'DELETE', url: `/api/rooms/${roomId}/messages/${authorMsgId}`,
    headers: auth(token2)
  });
  assert.equal(delOtherRes.statusCode, 403);
});

// ============================================================
// DIRECT MESSAGES IN SQL MODE
// ============================================================
test('SQL DM: send -> read conversation', async () => {
  const token1 = await registerAndLogin(app, 'DMUser1', uniqueEmail(), 'pass123');
  const user1Res = await app.inject({
    method: 'GET', url: '/api/auth/me',
    headers: auth(token1)
  });
  const userId1 = user1Res.json().user.id;

  const token2 = await registerAndLogin(app, 'DMUser2', uniqueEmail(), 'pass123');
  const user2Res = await app.inject({
    method: 'GET', url: '/api/auth/me',
    headers: auth(token2)
  });
  const userId2 = user2Res.json().user.id;

  // User1 sends DM to User2
  const sendRes = await app.inject({
    method: 'POST', url: '/api/dm',
    headers: auth(token1),
    payload: { receiverId: userId2, body: 'Hello from User1!' }
  });
  assert.equal(sendRes.statusCode, 200);
  assert.equal(sendRes.json().message.body, 'Hello from User1!');

  // User2 reads conversation
  const readRes = await app.inject({
    method: 'GET', url: `/api/dm/${userId1}`,
    headers: auth(token2)
  });
  assert.equal(readRes.statusCode, 200);
  const msgs = readRes.json().messages;
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].body, 'Hello from User1!');

  // User2 replies
  const replyRes = await app.inject({
    method: 'POST', url: '/api/dm',
    headers: auth(token2),
    payload: { receiverId: userId1, body: 'Hello back!' }
  });
  assert.equal(replyRes.statusCode, 200);

  // User1 reads updated conversation
  const readBackRes = await app.inject({
    method: 'GET', url: `/api/dm/${userId2}`,
    headers: auth(token1)
  });
  assert.equal(readBackRes.statusCode, 200);
  assert.equal(readBackRes.json().messages.length, 2);
});
