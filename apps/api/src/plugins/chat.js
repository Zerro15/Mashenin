import { v4 as uuidv4 } from 'uuid';
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  // Хранилище активных комнат и их участников
  const rooms = new Map();

  // Регистрируем декораторы для работы с чатом
  fastify.decorate('chat', {
    // Подключить пользователя к комнате
    joinRoom: (roomId, userId, ws) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      rooms.get(roomId).set(userId, ws);

      // Уведомить других участников
      fastify.chat.broadcastToRoom(roomId, userId, {
        type: 'user_joined',
        userId,
        timestamp: new Date().toISOString()
      });
    },

    // Отключить пользователя от комнаты
    leaveRoom: (roomId, userId) => {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          // Уведомить других участников
          fastify.chat.broadcastToRoom(roomId, userId, {
            type: 'user_left',
            userId,
            timestamp: new Date().toISOString()
          });
        }
      }
    },

    // Отправить сообщение всем в комнате (кроме отправителя)
    broadcastToRoom: (roomId, senderId, message) => {
      const room = rooms.get(roomId);
      if (room) {
        for (const [userId, ws] of room.entries()) {
          if (userId !== senderId && ws.readyState === 1) {
            ws.send(JSON.stringify(message));
          }
        }
      }
    },

    // Отправить сообщение конкретному пользователю
    sendToUser: (userId, message) => {
      for (const ws of fastify.connections.values()) {
        if (ws.userId === userId && ws.readyState === 1) {
          ws.send(JSON.stringify(message));
        }
      }
    }
  });
});