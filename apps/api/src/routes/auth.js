import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export default async function authRoutes(fastify) {
  // Получить информацию об инвайте
  fastify.get('/invite/:code', async (request, reply) => {
    const { code } = request.params;

    try {
      const invite = await fastify.store.getInvite(code);
      if (!invite || invite.used) {
        return reply.status(404).send({ ok: false, error: 'invite_not_found' });
      }

      return {
        ok: true,
        invite: {
          code: invite.code,
          roomId: invite.roomId,
          createdBy: invite.createdBy
        }
      };
    } catch (error) {
      fastify.log.error('Error fetching invite:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Создать сессию по инвайту
  fastify.post('/session', async (request, reply) => {
    const { inviteCode, username } = request.body;

    if (!inviteCode || !username) {
      return reply.status(400).send({ ok: false, error: 'invite_code_and_username_required' });
    }

    try {
      const invite = await fastify.store.getInvite(inviteCode);
      if (!invite || invite.used) {
        return reply.status(404).send({ ok: false, error: 'invalid_invite' });
      }

      // Создаем пользователя
      const userId = uuidv4();
      const user = {
        id: userId,
        username,
        roomId: invite.roomId,
        createdAt: new Date().toISOString()
      };

      await fastify.store.createUser(user);

      // Помечаем инвайт как использованный
      await fastify.store.useInvite(inviteCode);

      // Создаем JWT токен
      const token = jwt.sign(
        { userId, username, roomId: invite.roomId },
        fastify.config.jwt?.secret || 'dev-secret',
        { expiresIn: fastify.config.session?.ttlSeconds || 86400 }
      );

      return {
        ok: true,
        user,
        token,
        roomId: invite.roomId
      };
    } catch (error) {
      fastify.log.error('Error creating session:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Верификация токена
  fastify.get('/verify', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ ok: false, error: 'no_token' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, fastify.config.jwt?.secret || 'dev-secret');
      return { ok: true, user: decoded };
    } catch (error) {
      return reply.status(401).send({ ok: false, error: 'invalid_token' });
    }
  });
}