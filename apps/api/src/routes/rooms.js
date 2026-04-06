import { v4 as uuidv4 } from 'uuid';
import { createLiveKitToken } from '../lib/livekit-token.js';

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

  // Получить информацию о комнате
  fastify.get('/:roomId', async (request, reply) => {
    const { roomId } = request.params;

    try {
      const room = await fastify.store.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ ok: false, error: 'room_not_found' });
      }

      // Получаем список участников
      const members = await fastify.store.getRoomMembers(roomId);

      return {
        ok: true,
        room: {
          ...room,
          members
        }
      };
    } catch (error) {
      fastify.log.error('Error fetching room:', error);
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