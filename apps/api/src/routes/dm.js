function getSessionToken(request) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return request.headers['x-session-token'] || null;
}

export default async function dmRoutes(fastify) {
  // Получить переписку с пользователем
  fastify.get('/:userId', async (request, reply) => {
    const token = getSessionToken(request);
    const { userId } = request.params;

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });

    try {
      await fastify.store.markDirectMessagesRead({ token, peerUserId: userId });
      const messages = await fastify.store.getDirectMessages({ token, peerUserId: userId });
      return { ok: true, messages };
    } catch (error) {
      fastify.log.error('Error fetching DMs:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Отправить личное сообщение
  fastify.post('/', async (request, reply) => {
    const token = getSessionToken(request);
    const receiverId = String(request.body?.receiverId || '').trim();
    const body = String(request.body?.body || '').trim();

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });
    if (!receiverId || !body) return reply.status(400).send({ ok: false, error: 'receiver_and_body_required' });

    try {
      const message = await fastify.store.sendDirectMessage({ token, receiverId, body });
      if (!message) return reply.status(400).send({ ok: false, error: 'send_failed' });
      return { ok: true, message };
    } catch (error) {
      fastify.log.error('Error sending DM:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Количество непрочитанных
  fastify.get('/unread/count', async (request, reply) => {
    const token = getSessionToken(request);
    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });

    try {
      const count = await fastify.store.getUnreadDMCount({ token });
      return { ok: true, count };
    } catch (error) {
      fastify.log.error('Error counting unread DMs:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}
