import { v4 as uuidv4 } from 'uuid';

/**
 * Auth-защищённый WebSocket чат для комнат.
 * В отличие от legacy /ws/chat/:roomId — требует Bearer token при подключении.
 */
export default async function wsChatRoutes(fastify) {
  // Трекинг пользователей в комнатах: roomId -> Map<userId, { ws, name }>
  const roomMembers = new Map();

  function getRoom(roomId) {
    if (!roomMembers.has(roomId)) {
      roomMembers.set(roomId, new Map());
    }
    return roomMembers.get(roomId);
  }

  function getUser(roomId, userId) {
    return getRoom(roomId).get(userId);
  }

  function setUser(roomId, userId, ws, name) {
    getRoom(roomId).set(userId, { ws, name });
  }

  function removeUser(roomId, userId) {
    const room = getRoom(roomId);
    room.delete(userId);
    if (room.size === 0) {
      roomMembers.delete(roomId);
    }
  }

  function broadcastToRoom(roomId, senderId, payload) {
    const room = getRoom(roomId);
    for (const [userId, { ws }] of room.entries()) {
      if (userId !== senderId && ws.readyState === 1) {
        ws.send(JSON.stringify(payload));
      }
    }
  }

  function getOnlineUsers(roomId) {
    const room = getRoom(roomId);
    return Array.from(room.entries()).map(([id, { name }]) => ({
      id,
      name,
    }));
  }

  fastify.get('/ws/rooms/:roomId', { websocket: true }, async (connection, req) => {
    const { roomId } = req.params;
    let userId = null;
    let userName = null;
    let sessionToken = null; // оригинальный token для presence операций
    let isAuthenticated = false;

    connection.socket.on('message', async (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());

        if (data.type === 'auth') {
          // Валидация session token
          const token = data.token;

          if (!token) {
            connection.socket.send(JSON.stringify({ type: 'auth_error', reason: 'no_token' }));
            connection.socket.close(4001);
            return;
          }

          const sessionUser = await fastify.store.getSessionUser(token);

          if (!sessionUser) {
            connection.socket.send(JSON.stringify({ type: 'auth_error', reason: 'invalid_token' }));
            connection.socket.close(4001);
            return;
          }

          userId = sessionUser.id;
          userName = sessionUser.name || sessionUser.displayName || sessionUser.email || 'Аноним';
          sessionToken = token; // сохраняем для presence
          isAuthenticated = true;

          // Подключаем к комнате
          setUser(roomId, userId, connection.socket, userName);

          // Отправляем подтверждение + список онлайн-пользователей
          connection.socket.send(JSON.stringify({
            type: 'auth_ok',
            userId,
            userName,
            onlineUsers: getOnlineUsers(roomId),
          }));

          // Уведомляем остальных
          broadcastToRoom(roomId, userId, {
            type: 'user_joined',
            userId,
            userName,
            timestamp: new Date().toISOString(),
          });

          // Обновляем presence в store
          try {
            await fastify.store.joinRoom({ token: sessionToken, roomId });
          } catch (e) {
            fastify.log.warn('Failed to update presence on WS join: ' + e.message);
          }

          return;
        }

        // Все остальные команды требуют аутентификации
        if (!isAuthenticated) return;

        switch (data.type) {
          case 'message': {
            const text = String(data.content || '').trim();
            if (!text) return;

            // Сохраняем через store — используем sessionToken
            const message = await fastify.store.createMessage({
              token: sessionToken,
              roomId,
              body: text,
            });

            if (!message) return;

            // Форматируем для клиента
            const clientMessage = {
              id: message.id || uuidv4(),
              author: message.author || userName,
              authorId: message.authorId || userId,
              sentAt: message.sentAt || new Date().toISOString(),
              text: message.text || text,
            };

            // Отправляем всем в комнате (включая отправителя для подтверждения)
            const room = getRoom(roomId);
            for (const [, { ws }] of room.entries()) {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'message', message: clientMessage }));
              }
            }

            break;
          }

          case 'typing': {
            const isTyping = Boolean(data.isTyping);
            const typingUserId = data.userId;
            const typingUserName = data.userName;

            if (!typingUserId) return;

            broadcastToRoom(roomId, userId, {
              type: 'typing',
              userId: typingUserId,
              userName: typingUserName,
              isTyping,
              timestamp: new Date().toISOString(),
            });
            break;
          }

          case 'ping': {
            connection.socket.send(JSON.stringify({ type: 'pong' }));
            break;
          }
        }
      } catch (error) {
        fastify.log.error('WS message error: ' + error.message);
      }
    });

    connection.socket.on('close', () => {
      if (userId && isAuthenticated) {
        // Уведомляем остальных
        broadcastToRoom(roomId, userId, {
          type: 'user_left',
          userId,
          userName,
          timestamp: new Date().toISOString(),
        });

        removeUser(roomId, userId);

        // Обновляем presence через store
        if (sessionToken) {
          try {
            void fastify.store.leaveRoom({ token: sessionToken, roomId }).catch(() => {});
          } catch (e) {
            // Игнорируем ошибки при cleanup
          }
        }
      }
    });
  });
}
