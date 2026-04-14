function getSessionToken(request) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return request.headers['x-session-token'] || null;
}

export default async function teamRoutes(fastify) {
  // Список команд пользователя
  fastify.get('/', async (request, reply) => {
    const token = getSessionToken(request);
    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });

    try {
      const teams = await fastify.store.getTeams({ token });
      return { ok: true, teams };
    } catch (error) {
      fastify.log.error('Error fetching teams:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Создать команду
  fastify.post('/', async (request, reply) => {
    const token = getSessionToken(request);
    const name = String(request.body?.name || '').trim();
    const topic = String(request.body?.topic || '').trim();

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });
    if (!name) return reply.status(400).send({ ok: false, error: 'team_name_required' });

    try {
      const team = await fastify.store.createTeam({ token, name, topic });
      if (!team) return reply.status(400).send({ ok: false, error: 'team_create_failed' });
      return { ok: true, team };
    } catch (error) {
      fastify.log.error('Error creating team:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Получить сообщения команды (ДОЛЖЕН идти ПЕРЕД /:teamId!)
  fastify.get('/:teamId/messages', async (request, reply) => {
    const { teamId } = request.params;
    try {
      const messages = await fastify.store.getTeamMessages(teamId);
      return { ok: true, messages };
    } catch (error) {
      fastify.log.error('Error fetching team messages:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Отправить сообщение в команду
  fastify.post('/:teamId/messages', async (request, reply) => {
    const { teamId } = request.params;
    const token = getSessionToken(request);
    const body = String(request.body?.body || '').trim();

    if (!token) return reply.status(401).send({ ok: false, error: 'unauthorized' });
    if (!body) return reply.status(400).send({ ok: false, error: 'message_body_required' });

    try {
      const message = await fastify.store.createTeamMessage({ token, teamId, body });
      if (!message) return reply.status(400).send({ ok: false, error: 'message_create_failed' });
      return { ok: true, message };
    } catch (error) {
      fastify.log.error('Error creating team message:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Получить команду (должен идти ПОСЛЕ /:teamId/messages)
  fastify.get('/:teamId', async (request, reply) => {
    const { teamId } = request.params;
    try {
      const team = await fastify.store.getTeamById(teamId);
      if (!team) return reply.status(404).send({ ok: false, error: 'team_not_found' });
      return { ok: true, team };
    } catch (error) {
      fastify.log.error('Error fetching team:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}
