import { useEffect, useRef, useState, useCallback } from 'react';

const UNREAD_KEY_PREFIX = 'mashenin_unread_';
const LAST_READ_KEY_PREFIX = 'mashenin_last_read_';

interface UnreadCounts {
  [roomId: string]: number;
}

function getUnreadKey(userId: string) {
  return `${UNREAD_KEY_PREFIX}${userId}`;
}

function getLastReadKey(userId: string, roomId: string) {
  return `${LAST_READ_KEY_PREFIX}${userId}:${roomId}`;
}

function loadUnreadCounts(userId: string): UnreadCounts {
  try {
    const raw = localStorage.getItem(getUnreadKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUnreadCounts(userId: string, counts: UnreadCounts) {
  try {
    localStorage.setItem(getUnreadKey(userId), JSON.stringify(counts));
  } catch {
    // Игнорируем ошибки storage
  }
}

function getLastReadMessageId(userId: string, roomId: string): string | null {
  try {
    return localStorage.getItem(getLastReadKey(userId, roomId));
  } catch {
    return null;
  }
}

function setLastReadMessageId(userId: string, roomId: string, messageId: string) {
  try {
    localStorage.setItem(getLastReadKey(userId, roomId), messageId);
  } catch {
    // Игнорируем
  }
}

function clearLastReadMessageId(userId: string, roomId: string) {
  try {
    localStorage.removeItem(getLastReadKey(userId, roomId));
  } catch {
    // Игнорируем
  }
}

function requestNotificationPermission() {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification(title: string, body: string, roomId: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Не показываем если вкладка активна
  if (document.visibilityState === 'visible') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `room-${roomId}`, // Группируем по комнате
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      // Навигация к комнате
      window.location.href = `/room/${roomId}`;
    };
  } catch {
    // Игнорируем ошибки notifications
  }
}

interface UseUnreadTrackerOptions {
  userId: string | undefined;
  currentRoomId: string | undefined;
  enabled: boolean;
}

export function useUnreadTracker(options: UseUnreadTrackerOptions) {
  const { userId, currentRoomId, enabled } = options;

  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const hasNotifiedRef = useRef<Set<string>>(new Set());

  // Load unread counts on mount
  useEffect(() => {
    if (!userId) return;
    const counts = loadUnreadCounts(userId);
    setUnreadCounts(counts);
  }, [userId]);

  // Request notification permission
  useEffect(() => {
    if (enabled) {
      requestNotificationPermission();
    }
  }, [enabled]);

  // Mark room as read when entering
  const markAsRead = useCallback(
    (roomId: string, lastMessageId?: string) => {
      if (!userId) return;

      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[roomId];
        saveUnreadCounts(userId, next);
        return next;
      });

      if (lastMessageId) {
        setLastReadMessageId(userId, roomId, lastMessageId);
      }
    },
    [userId]
  );

  // Clear unread when leaving room
  const clearUnread = useCallback(
    (roomId: string) => {
      if (!userId) return;
      clearLastReadMessageId(userId, roomId);
    },
    [userId]
  );

  // Track new messages and update unread counts
  const onNewMessage = useCallback(
    (roomId: string, messageId: string, author: string, text: string) => {
      if (!userId) return;

      // Если мы в этой комнате — не считаем непрочитанным
      if (currentRoomId === roomId) {
        setLastReadMessageId(userId, roomId, messageId);
        return;
      }

      // Увеличиваем счётчик непрочитанных
      setUnreadCounts((prev) => {
        const next = { ...prev };
        next[roomId] = (next[roomId] || 0) + 1;
        saveUnreadCounts(userId, next);
        return next;
      });

      // Browser notification (только один раз на комнату, пока вкладка не активна)
      if (document.visibilityState !== 'visible' && !hasNotifiedRef.current.has(roomId)) {
        hasNotifiedRef.current.add(roomId);
        showNotification(
          `${author} в комнате`,
          text.length > 80 ? text.slice(0, 80) + '…' : text,
          roomId
        );
      }
    },
    [userId, currentRoomId]
  );

  // Reset notification throttle when tab becomes visible
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        hasNotifiedRef.current.clear();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  return {
    unreadCounts,
    totalUnread,
    markAsRead,
    clearUnread,
    onNewMessage,
  };
}
