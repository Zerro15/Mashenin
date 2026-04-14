function getSessionToken(request) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return request.headers['x-session-token'] || null;
}

export default async function friendsRoutes(fastify) {
  // Список друзей
  fastify.get('/', async (request, reply) => {
    const token = getSessionToken(request);
    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });

    try {
      const friends = await fastify.store.getFriends({ token });
      const requests = await fastify.store.getFriendRequests({ token });
      return { ok: true, friends, requests };
    } catch (error) {
      fastify.log.error('Error fetching friends:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Отправить запрос в друзья
  fastify.post('/request', async (request, reply) => {
    const token = getSessionToken(request);
    const friendId = String(request.body?.friendId || '').trim();

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });
    if (!friendId) return reply.status(400).send({ ok: false, error: 'friend_id_required' });

    try {
      const result = await fastify.store.sendFriendRequest({ token, friendId });
      return result;
    } catch (error) {
      fastify.log.error('Error sending friend request:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Принять запрос в друзья
  fastify.post('/accept', async (request, reply) => {
    const token = getSessionToken(request);
    const friendId = String(request.body?.friendId || '').trim();

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });
    if (!friendId) return reply.status(400).send({ ok: false, error: 'friend_id_required' });

    try {
      const result = await fastify.store.acceptFriendRequest({ token, friendId });
      return result;
    } catch (error) {
      fastify.log.error('Error accepting friend request:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Удалить из друзей
  fastify.delete('/:friendId', async (request, reply) => {
    const token = getSessionToken(request);
    const { friendId } = request.params;

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });

    try {
      const result = await fastify.store.removeFriend({ token, friendId });
      return result;
    } catch (error) {
      fastify.log.error('Error removing friend:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}
