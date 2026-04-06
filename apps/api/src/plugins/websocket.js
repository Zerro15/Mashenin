import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';

export default fp(async (fastify) => {
  fastify.register(websocket, {
    options: {
      maxPayload: 1048576,
      pingInterval: 30000,
      pingTimeout: 30000
    }
  });

  // Хранилище для активных соединений
  fastify.decorate('connections', new Map());

  // WebSocket подключения уже обрабатываются fastify-websocket
  fastify.log.info('WebSocket plugin registered');
});