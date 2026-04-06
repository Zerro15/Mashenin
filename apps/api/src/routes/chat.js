import { v4 as uuidv4 } from 'uuid';

export default async function chatRoutes(fastify) {
  // WebSocket эндпоинт для чата
  fastify.get('/ws/chat/:roomId', { websocket: true }, (connection, req) => {
    const { roomId } = req.params;
    let userId = null;

    connection.socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'auth':
            // Аутентификация пользователя
            userId = data.userId;
            connection.socket.userId = userId;
            fastify.connections.set(userId, connection.socket);
            fastify.chat.joinRoom(roomId, userId, connection.socket);
            break;

          case 'message':
            // Отправка текстового сообщения
            if (!userId) return;

            const chatMessage = {
              id: uuidv4(),
              type: 'message',
              userId,
              content: data.content,
              timestamp: new Date().toISOString()
            };

            // Сохраняем в БД (TODO: реализовать)
            // await fastify.store.saveMessage(roomId, chatMessage);

            // Рассылаем всем в комнате
            fastify.chat.broadcastToRoom(roomId, userId, chatMessage);
            break;

          case 'typing':
            // Индикатор набора текста
            if (!userId) return;
            fastify.chat.broadcastToRoom(roomId, userId, {
              type: 'typing',
              userId,
              isTyping: data.isTyping
            });
            break;

          case 'voice_signal':
            // Сигналы WebRTC для голосового чата
            if (!userId) return;
            fastify.chat.broadcastToRoom(roomId, userId, {
              type: 'voice_signal',
              userId,
              signal: data.signal
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    connection.socket.on('close', () => {
      if (userId) {
        fastify.chat.leaveRoom(roomId, userId);
        fastify.connections.delete(userId);
      }
    });
  });

  // HTTP эндпоинт для получения истории сообщений
  fastify.get('/chat/:roomId/messages', async (request, reply) => {
    const { roomId } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    // TODO: реализовать получение из БД
    const messages = []; // await fastify.store.getMessages(roomId, limit, offset);

    return { ok: true, messages };
  });

  // HTTP эндпоинт для отправки сообщения (резервный вариант)
  fastify.post('/chat/:roomId/messages', async (request, reply) => {
    const { roomId } = request.params;
    const { content, userId } = request.body;

    if (!content || !userId) {
      return reply.status(400).send({ ok: false, error: 'content and userId required' });
    }

    const message = {
      id: uuidv4(),
      type: 'message',
      userId,
      content,
      timestamp: new Date().toISOString()
    };

    // Сохраняем в БД (TODO: реализовать)
    // await fastify.store.saveMessage(roomId, message);

    // Рассылаем через WebSocket
    fastify.chat.broadcastToRoom(roomId, userId, message);

    return { ok: true, message };
  });
}