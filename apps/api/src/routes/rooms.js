import { v4 as uuidv4 } from 'uuid';
import { createLiveKitToken } from '../lib/livekit-token.js';

function getSessionToken(request) {
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return request.headers['x-session-token'] || null;
}

export default async function roomRoutes(fastify) {
  // Получить список комнат пользователя
  fastify.get('/', async (request, reply) => {
    try {
      const rooms = await fastify.store.getRooms();
      return { ok: true, rooms };
    } catch (error) {
      fastify.log.error('Error fetching rooms:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Создать новую комнату
  fastify.post('/', async (request, reply) => {
    const token = getSessionToken(request);
    const name = String(request.body?.name || '').trim();
    const topic = String(request.body?.topic || '').trim();

    if (!token) {
      return reply.status(401).send({ ok: false, error: 'unauthorized' });
    }

    if (!name) {
      return reply.status(400).send({ ok: false, error: 'room_name_required' });
    }

    try {
      const room = await fastify.store.createRoom({
        token,
        name,
        topic
      });

      if (!room) {
        return reply.status(400).send({ ok: false, error: 'room_create_failed' });
      }

      return {
        ok: true,
        room
      };
    } catch (error) {
      fastify.log.error('Error creating room:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Создать invite для комнаты
  fastify.post('/:roomId/invites', async (request, reply) => {
    const { roomId } = request.params;
    const token = getSessionToken(request);

    if (!token) {
      return reply.status(401).send({ ok: false, error: 'unauthorized' });
    }

    try {
      const result = await fastify.store.createRoomInvite({
        token,
        roomId
      });

      if (!result?.ok) {
        if (result?.error === 'unauthorized') {
          return reply.status(401).send({ ok: false, error: 'unauthorized' });
        }

        if (result?.error === 'room_not_found') {
          return reply.status(404).send({ ok: false, error: 'room_not_found' });
        }

        if (result?.error === 'forbidden') {
          return reply.status(403).send({ ok: false, error: 'forbidden' });
        }

        return reply.status(400).send({ ok: false, error: result?.error || 'invite_create_failed' });
      }

      return result;
    } catch (error) {
      fastify.log.error('Error creating room invite:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Получить информацию о комнате
  fastify.get('/:roomId', async (request, reply) => {
    const { roomId } = request.params;

    try {
      const room = await fastify.store.getRoomById(roomId);
      if (!room) {
        return reply.status(404).send({ ok: false, error: 'room_not_found' });
      }

      return {
        ok: true,
        room
      };
    } catch (error) {
      fastify.log.error('Error fetching room:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Получить историю сообщений комнаты
  fastify.get('/:roomId/messages', async (request, reply) => {
    const { roomId } = request.params;

    try {
      const room = await fastify.store.getRoomById(roomId);
      if (!room) {
        return reply.status(404).send({ ok: false, error: 'room_not_found' });
      }

      const messages = await fastify.store.getMessagesForRoom(roomId);

      return {
        ok: true,
        messages
      };
    } catch (error) {
      fastify.log.error('Error fetching room messages:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Отправить сообщение в комнату
  fastify.post('/:roomId/messages', async (request, reply) => {
    const { roomId } = request.params;
    const token = getSessionToken(request);
    const body = String(request.body?.body || '').trim();

    if (!token) {
      return reply.status(401).send({ ok: false, error: 'unauthorized' });
    }

    if (!body) {
      return reply.status(400).send({ ok: false, error: 'message_body_required' });
    }

    try {
      const message = await fastify.store.createMessage({
        token,
        roomId,
        body
      });

      if (!message) {
        return reply.status(400).send({ ok: false, error: 'message_create_failed' });
      }

      return {
        ok: true,
        message
      };
    } catch (error) {
      fastify.log.error('Error creating room message:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Создать LiveKit токен для комнаты
  fastify.post('/:roomId/token', async (request, reply) => {
    const { roomId } = request.params;
    const { userId, username } = request.body;

    if (!userId || !username) {
      return reply.status(400).send({ ok: false, error: 'user_id_and_username_required' });
    }

    try {
      // Проверяем, существует ли комната
      const room = await fastify.store.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ ok: false, error: 'room_not_found' });
      }

      const token = createLiveKitToken({
        apiKey: fastify.config.livekit?.apiKey || process.env.LIVEKIT_API_KEY,
        apiSecret: fastify.config.livekit?.apiSecret || process.env.LIVEKIT_API_SECRET,
        identity: userId,
        name: username,
        roomName: roomId,
        ttlSeconds: fastify.config.session?.ttlSeconds || 3600
      });

      return { ok: true, token };
    } catch (error) {
      fastify.log.error('Error generating LiveKit token:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Получить статус присутствия в комнате
  fastify.get('/:roomId/presence', async (request, reply) => {
    const { roomId } = request.params;

    try {
      const presence = await fastify.store.getRoomPresence(roomId);
      return { ok: true, presence };
    } catch (error) {
      fastify.log.error('Error fetching room presence:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Обновить статус пользователя в комнате
  fastify.post('/:roomId/presence', async (request, reply) => {
    const { roomId } = request.params;
    const { userId, status } = request.body; // status: 'online', 'away', 'offline'

    if (!userId || !status) {
      return reply.status(400).send({ ok: false, error: 'user_id_and_status_required' });
    }

    try {
      await fastify.store.updateUserPresence(roomId, userId, status);

      // Рассылаем обновление через WebSocket
      fastify.chat.broadcastToRoom(roomId, userId, {
        type: 'presence_update',
        userId,
        status,
        timestamp: new Date().toISOString()
      });

      return { ok: true };
    } catch (error) {
      fastify.log.error('Error updating presence:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}
