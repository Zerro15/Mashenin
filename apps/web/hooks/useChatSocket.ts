import { useEffect, useRef, useState, useCallback } from 'react';
import { getSessionToken } from '../lib/api';

export type ChatSocketMessage = {
  id: string;
  author: string;
  authorId: string;
  sentAt: string;
  text: string;
};

export type TypingUser = {
  id: string;
  name: string;
};

export type ChatSocketEvent =
  | { type: 'message'; message: ChatSocketMessage }
  | { type: 'typing'; userId: string; userName: string; isTyping: boolean }
  | { type: 'user_joined'; userId: string; userName: string }
  | { type: 'user_left'; userId: string; userName: string }
  | { type: 'presence_update'; onlineUsers: Array<{ id: string; name: string }> };

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'fallback';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const TYPING_DEBOUNCE_MS = 1500;
const TYPING_CLEAR_MS = 3000;

export interface UseChatSocketOptions {
  roomId: string;
  userId?: string;
  userName?: string;
  onMessage: (message: ChatSocketMessage) => void;
  onEvent: (event: ChatSocketEvent) => void;
  enabled: boolean;
}

export function useChatSocket(options: UseChatSocketOptions) {
  const { roomId, userId, userName, onMessage, onEvent, enabled } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string }>>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isIntentionalCloseRef = useRef(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingUsersRef = useRef<Map<string, { name: string; expiresAt: number }>>(new Map());

  const sendMessage = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!userId || !userName) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      if (isTyping && now - lastTypingSentRef.current < TYPING_DEBOUNCE_MS) return;

      if (isTyping) {
        lastTypingSentRef.current = now;
      }

      sendMessage({ type: 'typing', isTyping, userId, userName });
    },
    [userId, userName, sendMessage]
  );

  useEffect(() => {
    if (!enabled || !roomId || typeof window === 'undefined') {
      setStatus('disconnected');
      return;
    }

    let isActive = true;
    isIntentionalCloseRef.current = false;

    function connect() {
      if (!isActive) return;

      const token = getSessionToken();
      if (!token) {
        setStatus('fallback');
        return;
      }

      setStatus('connecting');

      const wsUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/ws/rooms/${roomId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isActive) return;
        // Аутентификация при подключении
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'auth_ok':
              if (isActive) {
                setStatus('connected');
                reconnectAttemptsRef.current = 0;
                if (Array.isArray(data.onlineUsers)) {
                  setOnlineUsers(data.onlineUsers);
                }
              }
              break;

            case 'auth_error':
              if (isActive) {
                setStatus('fallback');
                ws.close();
              }
              break;

            case 'message':
              if (isActive && data.message) {
                onMessage(data.message);
              }
              break;

            case 'typing':
              if (isActive && data.userId && data.userName) {
                // Не показываем typing для себя
                if (data.userId === userId) break;

                if (data.isTyping) {
                  typingUsersRef.current.set(data.userId, {
                    name: data.userName,
                    expiresAt: Date.now() + TYPING_CLEAR_MS,
                  });
                } else {
                  typingUsersRef.current.delete(data.userId);
                }
                onEvent({
                  type: 'typing',
                  userId: data.userId,
                  userName: data.userName,
                  isTyping: data.isTyping,
                });
              }
              break;

            case 'user_joined':
              if (isActive) {
                const newUser = { id: data.userId, name: data.userName };
                setOnlineUsers((prev) => {
                  if (prev.some((u) => u.id === data.userId)) return prev;
                  return [...prev, newUser];
                });
                onEvent(data);
              }
              break;

            case 'user_left':
              if (isActive) {
                setOnlineUsers((prev) => prev.filter((u) => u.id !== data.userId));
                onEvent(data);
              }
              break;

            case 'presence_update':
              if (isActive && Array.isArray(data.onlineUsers)) {
                setOnlineUsers(data.onlineUsers);
                onEvent(data);
              }
              break;
          }
        } catch {
          // Игнорируем невалидные сообщения
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;

        if (!isActive) return;

        // Если закрыли намеренно — не переподключаемся
        if (isIntentionalCloseRef.current) {
          setStatus('disconnected');
          return;
        }

        // Если auth failed — не переподключаемся
        if (event.code === 4001) {
          setStatus('fallback');
          return;
        }

        // Exponential backoff
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptsRef.current), RECONNECT_MAX_MS);
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isActive) {
            connect();
          }
        }, delay);
      };

      ws.onerror = () => {
        if (!isActive) return;
        // onclose вызовется после onerror, обработка там
      };
    }

    connect();

    return () => {
      isActive = false;
      isIntentionalCloseRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        ws.close();
      }
    };
  }, [enabled, roomId, userId, userName, onMessage, onEvent]);

  // Periodic cleanup of expired typing users
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      const entries = Array.from(typingUsersRef.current.entries());
      for (const [id, info] of entries) {
        if (now > info.expiresAt) {
          typingUsersRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        // Trigger re-render через обновление state
        setOnlineUsers((prev) => [...prev]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const disconnect = useCallback(() => {
    isIntentionalCloseRef.current = true;
    const ws = wsRef.current;
    if (ws) {
      wsRef.current = null;
      ws.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  return {
    status,
    onlineUsers,
    sendTyping,
    disconnect,
  };
}
