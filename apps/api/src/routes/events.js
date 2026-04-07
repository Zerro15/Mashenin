export default async function eventsRoutes(fastify) {
  // Получить список событий
  fastify.get('/', async (request, reply) => {
    try {
      const events = await fastify.store.getEvents();
      return { ok: true, events };
    } catch (error) {
      fastify.log.error('Error fetching events:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });

  // Создать новое событие
  fastify.post('/', async (request, reply) => {
    const { title, startsAt, roomId } = request.body;

    if (!title || !startsAt) {
      return reply.status(400).send({ ok: false, error: 'title and startsAt required' });
    }

    try {
      const event = await fastify.store.createEvent({
        token: request.headers['x-session-token'],
        title,
        startsAt,
        roomId: roomId || 'general'
      });

      if (!event) {
        return reply.status(400).send({ ok: false, error: 'event_create_failed' });
      }

      return { ok: true, event };
    } catch (error) {
      fastify.log.error('Error creating event:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}