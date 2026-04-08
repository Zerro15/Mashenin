function getSessionToken(request) {
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return request.headers['x-session-token'] || null;
}

export default async function inviteRoutes(fastify) {
  fastify.get('/:code', async (request, reply) => {
    const { code } = request.params;

    try {
      const result = await fastify.store.getRoomInvitePreview(code);

      if (!result?.ok) {
        const statusCode = result?.error === 'room_not_found' ? 404 : 404;
        return reply.status(statusCode).send({ ok: false, error: result?.error || 'invite_not_found' });
      }

      return result;
    } catch (error) {
      fastify.log.error('Error fetching invite preview:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  fastify.post('/:code/accept', async (request, reply) => {
    const { code } = request.params;
    const token = getSessionToken(request);

    if (!token) {
      return reply.status(401).send({ ok: false, error: 'unauthorized' });
    }

    try {
      const result = await fastify.store.acceptRoomInvite({
        token,
        code
      });

      if (!result?.ok) {
        if (result?.error === 'unauthorized') {
          return reply.status(401).send({ ok: false, error: 'unauthorized' });
        }

        if (result?.error === 'room_not_found') {
          return reply.status(404).send({ ok: false, error: 'room_not_found' });
        }

        if (result?.error === 'invite_not_found') {
          return reply.status(404).send({ ok: false, error: 'invite_not_found' });
        }

        return reply.status(400).send({ ok: false, error: result?.error || 'invite_accept_failed' });
      }

      return result;
    } catch (error) {
      fastify.log.error('Error accepting invite:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}
