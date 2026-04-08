import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, verifyPassword, normalizeEmail } from '../lib/auth.js';

export default async function authRoutes(fastify) {
  // Регистрация пользователя по email/password
  fastify.post('/register', async (request, reply) => {
    const { email, password, displayName, username } = request.body;

    // Базовая валидация
    if (!email || !password || !displayName) {
      return reply.status(400).send({
        ok: false,
        error: 'email_password_and_display_name_required'
      });
    }

    if (password.length < 6) {
      return reply.status(400).send({
        ok: false,
        error: 'password_too_short'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedDisplayName = String(displayName).trim();

    if (!normalizedEmail || !normalizedDisplayName) {
      return reply.status(400).send({
        ok: false,
        error: 'invalid_email_or_display_name'
      });
    }

    try {
      // Используем инвайт по умолчанию для регистрации без инвайта
      const session = await fastify.store.registerUser({
        code: 'mashenin-2026', // default invite for auth v1
        email: normalizedEmail,
        password,
        displayName: normalizedDisplayName,
        about: '',
        ttlSeconds: fastify.config.session?.ttlSeconds || 604800
      });

      if (!session) {
        return reply.status(400).send({
          ok: false,
          error: 'registration_failed_maybe_email_exists'
        });
      }

      return reply.send({
        ok: true,
        user: session.user,
        token: session.token
      });
    } catch (error) {
      fastify.log.error('Registration error:', error);
      return reply.status(500).send({
        ok: false,
        error: 'internal_error'
      });
    }
  });

  // Вход пользователя по email/password
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;

    // Базовая валидация
    if (!email || !password) {
      return reply.status(400).send({
        ok: false,
        error: 'email_and_password_required'
      });
    }

    try {
      const session = await fastify.store.loginWithPassword({
        email,
        password,
        ttlSeconds: fastify.config.session?.ttlSeconds || 604800
      });

      if (!session) {
        return reply.status(401).send({
          ok: false,
          error: 'invalid_email_or_password'
        });
      }

      return reply.send({
        ok: true,
        user: session.user,
        token: session.token
      });
    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.status(500).send({
        ok: false,
        error: 'internal_error'
      });
    }
  });

  // Получение информации о текущем пользователе
  fastify.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        ok: false,
        error: 'no_token'
      });
    }

    const token = authHeader.substring(7);

    try {
      const user = await fastify.store.getSessionUser(token);

      if (!user) {
        return reply.status(401).send({
          ok: false,
          error: 'invalid_token'
        });
      }

      return reply.send({
        ok: true,
        user
      });
    } catch (error) {
      fastify.log.error('Get user error:', error);
      return reply.status(500).send({
        ok: false,
        error: 'internal_error'
      });
    }
  });

  // Выход пользователя
  fastify.post('/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        await fastify.store.clearSession(token);
      } catch (error) {
        fastify.log.error('Logout error:', error);
        // Продолжаем даже если очистка сессии не удалась
      }
    }

    return reply.send({
      ok: true,
      message: 'logged_out'
    });
  });

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