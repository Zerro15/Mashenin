import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { getConfig } from './lib/config.js';
import { setStoreProvider } from './lib/store.js';
import * as store from './lib/store.js';
import { createPool } from './lib/sql.js';

// Импорт плагинов
import websocketPlugin from './plugins/websocket.js';
import chatPlugin from './plugins/chat.js';

// Импорт маршрутов
import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';

async function buildServer() {
  const fastify = Fastify({
    logger: true,
    ignoreTrailingSlash: true,
    caseSensitive: false
  });

  // Загрузка конфигурации
  const config = getConfig();
  setStoreProvider(config.data.provider);

  // Подключение к БД если используется SQL провайдер
  if (config.data.provider === 'sql') {
    try {
      await createPool(config.postgres);
      fastify.log.info('SQL provider initialized');
    } catch (error) {
      fastify.log.error('Failed to initialize SQL provider, falling back to file provider', error);
      setStoreProvider('file');
    }
  }

  // Регистрация плагинов
  await fastify.register(helmet, {
    contentSecurityPolicy: false
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  await fastify.register(websocketPlugin);
  await fastify.register(chatPlugin);

  // Декораторы для конфигурации
  fastify.decorate('config', config);
  fastify.decorate('store', store);

  // Регистрация маршрутов
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(roomRoutes, { prefix: '/api/rooms' });
  await fastify.register(chatRoutes, { prefix: '/api' });

  // Health check эндпоинт
  fastify.get('/health', async () => {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  return fastify;
}

// Запуск сервера
const start = async () => {
  try {
    const fastify = await buildServer();

    const port = Number(process.env.PORT || 4000);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`API server listening on ${host}:${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };