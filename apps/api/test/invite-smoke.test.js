import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

function uniqueEmail() {
  return `invite.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test('Invite smoke: create room invite -> preview -> accept -> open room -> send message', async () => {
  process.env.DATA_PROVIDER = 'file';

  const app = await buildServer();

  try {
    const inviterEmail = uniqueEmail();
    const inviterPassword = 'secret123';
    const inviterName = 'Inviter';

    const inviterRegisterResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: inviterEmail,
        password: inviterPassword,
        displayName: inviterName
      }
    });

    assert.equal(inviterRegisterResponse.statusCode, 200);

    const inviterToken = inviterRegisterResponse.json().token;

    const createRoomResponse = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: {
        authorization: `Bearer ${inviterToken}`
      },
      payload: {
        name: `Invite Room ${Date.now()}`,
        topic: 'first conversation'
      }
    });

    assert.equal(createRoomResponse.statusCode, 200);

    const room = createRoomResponse.json().room;
    assert.equal(room.members, 1);

    const createInviteResponse = await app.inject({
      method: 'POST',
      url: `/api/rooms/${room.id}/invites`,
      headers: {
        authorization: `Bearer ${inviterToken}`
      }
    });

    assert.equal(createInviteResponse.statusCode, 200);
    assert.equal(createInviteResponse.json().ok, true);
    assert.equal(createInviteResponse.json().invite.roomId, room.id);
    assert.equal(createInviteResponse.json().invite.path, `/invite/${createInviteResponse.json().invite.code}`);

    const inviteCode = createInviteResponse.json().invite.code;

    const previewResponse = await app.inject({
      method: 'GET',
      url: `/api/invites/${inviteCode}`
    });

    assert.equal(previewResponse.statusCode, 200);
    assert.equal(previewResponse.json().ok, true);
    assert.equal(previewResponse.json().invite.code, inviteCode);
    assert.equal(previewResponse.json().invite.roomId, room.id);
    assert.equal(previewResponse.json().invite.roomName, room.name);
    assert.equal(previewResponse.json().invite.roomTopic, room.topic);
    assert.equal(previewResponse.json().invite.createdBy.name, inviterName);

    const unauthorizedAcceptResponse = await app.inject({
      method: 'POST',
      url: `/api/invites/${inviteCode}/accept`
    });

    assert.equal(unauthorizedAcceptResponse.statusCode, 401);
    assert.equal(unauthorizedAcceptResponse.json().error, 'unauthorized');

    const guestEmail = uniqueEmail();
    const guestPassword = 'secret123';
    const guestName = 'Guest';

    const guestRegisterResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: guestEmail,
        password: guestPassword,
        displayName: guestName
      }
    });

    assert.equal(guestRegisterResponse.statusCode, 200);

    const guestToken = guestRegisterResponse.json().token;

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/api/invites/${inviteCode}/accept`,
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    });

    assert.equal(acceptResponse.statusCode, 200);
    assert.equal(acceptResponse.json().ok, true);
    assert.equal(acceptResponse.json().joined, true);
    assert.equal(acceptResponse.json().room.id, room.id);
    assert.equal(acceptResponse.json().room.name, room.name);
    assert.equal(acceptResponse.json().room.kind, 'persistent');
    assert.equal(acceptResponse.json().room.topic, room.topic);
    assert.equal(acceptResponse.json().room.members, 2);

    const acceptAgainResponse = await app.inject({
      method: 'POST',
      url: `/api/invites/${inviteCode}/accept`,
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    });

    assert.equal(acceptAgainResponse.statusCode, 200);
    assert.equal(acceptAgainResponse.json().ok, true);
    assert.equal(acceptAgainResponse.json().joined, false);
    assert.equal(acceptAgainResponse.json().room.id, room.id);
    assert.equal(acceptAgainResponse.json().room.members, 2);

    const roomResponse = await app.inject({
      method: 'GET',
      url: `/api/rooms/${room.id}`,
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    });

    assert.equal(roomResponse.statusCode, 200);
    assert.equal(roomResponse.json().ok, true);
    assert.equal(roomResponse.json().room.id, room.id);
    assert.equal(roomResponse.json().room.members, 2);

    const sendMessageResponse = await app.inject({
      method: 'POST',
      url: `/api/rooms/${room.id}/messages`,
      headers: {
        authorization: `Bearer ${guestToken}`
      },
      payload: {
        body: 'Hello from invited user'
      }
    });

    assert.equal(sendMessageResponse.statusCode, 200);
    assert.equal(sendMessageResponse.json().ok, true);
    assert.equal(sendMessageResponse.json().message.roomId, room.id);
    assert.equal(sendMessageResponse.json().message.text, 'Hello from invited user');

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/rooms/${room.id}/messages`,
      headers: {
        authorization: `Bearer ${guestToken}`
      }
    });

    assert.equal(messagesResponse.statusCode, 200);
    assert.equal(messagesResponse.json().ok, true);
    assert.ok(messagesResponse.json().messages.some((message) => message.text === 'Hello from invited user'));
  } finally {
    await app.close();
  }
});
