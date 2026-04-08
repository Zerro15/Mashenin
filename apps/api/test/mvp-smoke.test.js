import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

function uniqueEmail() {
  return `smoke.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test('MVP smoke: login -> open room -> load message history -> send message -> logout', async () => {
  process.env.DATA_PROVIDER = 'file';

  const app = await buildServer();

  try {
    const email = uniqueEmail();
    const password = 'secret123';
    const displayName = 'Smoke User';

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password,
        displayName
      }
    });

    assert.equal(registerResponse.statusCode, 200);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password
      }
    });

    assert.equal(loginResponse.statusCode, 200);

    const loginBody = loginResponse.json();
    assert.equal(loginBody.ok, true);
    assert.equal(typeof loginBody.token, 'string');
    assert.equal(loginBody.user.email, email);

    const token = loginBody.token;

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(meResponse.statusCode, 200);
    assert.equal(meResponse.json().user.email, email);

    const roomsResponse = await app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(roomsResponse.statusCode, 200);

    const roomsBody = roomsResponse.json();
    assert.equal(roomsBody.ok, true);
    assert.ok(Array.isArray(roomsBody.rooms));
    assert.ok(roomsBody.rooms.length > 0);

    const roomId = roomsBody.rooms[0].id;

    const roomResponse = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(roomResponse.statusCode, 200);

    const roomBody = roomResponse.json();
    assert.equal(roomBody.ok, true);
    assert.equal(roomBody.room.id, roomId);

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}/messages`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(messagesResponse.statusCode, 200);

    const messagesBody = messagesResponse.json();
    assert.equal(messagesBody.ok, true);
    assert.ok(Array.isArray(messagesBody.messages));

    const messageText = `Smoke message ${Date.now()}`;
    const sendMessageResponse = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/messages`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        body: messageText
      }
    });

    assert.equal(sendMessageResponse.statusCode, 200);

    const sendMessageBody = sendMessageResponse.json();
    assert.equal(sendMessageBody.ok, true);
    assert.equal(sendMessageBody.message.roomId, roomId);
    assert.equal(sendMessageBody.message.text, messageText);

    const nextMessagesResponse = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}/messages`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(nextMessagesResponse.statusCode, 200);

    const nextMessagesBody = nextMessagesResponse.json();
    assert.equal(nextMessagesBody.ok, true);
    assert.ok(nextMessagesBody.messages.some((message) => message.text === messageText));

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(logoutResponse.statusCode, 200);
    assert.equal(logoutResponse.json().ok, true);

    const meAfterLogoutResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(meAfterLogoutResponse.statusCode, 401);
    assert.equal(meAfterLogoutResponse.json().error, 'invalid_token');
  } finally {
    await app.close();
  }
});
