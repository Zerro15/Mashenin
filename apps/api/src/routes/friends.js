export default async function friendsRoutes(fastify) {
  // Получить список друзей/пользователей
  fastify.get('/', async (request, reply) => {
    try {
      const friends = await fastify.store.getFriends();
      return { ok: true, friends };
    } catch (error) {
      fastify.log.error('Error fetching friends:', error);
      return reply.status(500).send({ ok: false, error: 'internal_error' });
    }
  });
}