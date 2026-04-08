import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

interface RoomMessage {
  id: string;
  author: string;
  sentAt: string;
  text: string;
}

interface Room {
  id: string;
  name: string;
  topic: string;
  kind: string;
  members: number;
}

type RoomLoadState = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';
type MessagesLoadState = 'idle' | 'loading' | 'ready' | 'error';

const apiClient = createApiClient();

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}

export default function RoomPage() {
  const router = useRouter();
  const roomId = typeof router.query.roomId === 'string' ? router.query.roomId : '';
  const { user, isChecking, logout } = useAuthRoute('protected');

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [roomState, setRoomState] = useState<RoomLoadState>('loading');
  const [messagesState, setMessagesState] = useState<MessagesLoadState>('idle');
  const [roomError, setRoomError] = useState('');
  const [messagesError, setMessagesError] = useState('');
  const [sendError, setSendError] = useState('');
  const [roomReloadKey, setRoomReloadKey] = useState(0);
  const [messagesReloadKey, setMessagesReloadKey] = useState(0);

  useEffect(() => {
    if (!roomId || isChecking || !user) {
      return;
    }

    let isActive = true;

    async function loadRoom() {
      setRoomState('loading');
      setRoomError('');
      setMessagesError('');
      setSendError('');
      setRoom(null);
      setMessages([]);
      setMessagesState('idle');

      try {
        const roomResponse = await apiClient.get(`/api/rooms/${roomId}`);

        if (!isActive) {
          return;
        }

        if (!roomResponse.data?.ok || !roomResponse.data?.room) {
          setRoomState('not_found');
          setRoomError('Комната не найдена.');
          setRoom(null);
          return;
        }

        setRoom(roomResponse.data.room);
        setRoomState('ready');
      } catch (loadError: any) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load room:', loadError);
        setRoom(null);
        setMessages([]);
        setMessagesState('idle');

        if (loadError?.response?.status === 404) {
          setRoomState('not_found');
          setRoomError('Комната не найдена.');
          return;
        }

        setRoomState('error');
        setRoomError('Не удалось загрузить комнату.');
      }
    }

    loadRoom();

    return () => {
      isActive = false;
    };
  }, [roomId, isChecking, roomReloadKey, user]);

  useEffect(() => {
    if (!room || isChecking || !user) {
      return;
    }

    let isActive = true;

    async function loadMessages() {
      setMessagesState('loading');
      setMessagesError('');
      setMessages([]);

      try {
        const messagesResponse = await apiClient.get(`/api/rooms/${room.id}/messages`);

        if (!isActive) {
          return;
        }

        setMessages(messagesResponse.data?.ok ? messagesResponse.data.messages || [] : []);
        setMessagesState('ready');
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load messages:', loadError);
        setMessages([]);
        setMessagesState('error');
        setMessagesError('Не удалось загрузить историю сообщений.');
      }
    }

    loadMessages();

    return () => {
      isActive = false;
    };
  }, [isChecking, messagesReloadKey, room, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim() || !roomId) {
      return;
    }

    setIsSending(true);
    setSendError('');

    try {
      const response = await apiClient.post(`/api/rooms/${roomId}/messages`, {
        body: draft
      });

      if (!response.data?.ok || !response.data?.message) {
        setSendError('Не удалось отправить сообщение.');
        return;
      }

      setMessages((currentMessages) => [...currentMessages, response.data.message]);
      setMessagesState('ready');
      setDraft('');
    } catch (submitError: any) {
      const nextError =
        submitError?.response?.status === 401
          ? 'Сессия истекла. Войди снова.'
          : 'Не удалось отправить сообщение.';

      setSendError(nextError);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main">
        {isChecking ? (
          <p className="empty">Проверка сессии...</p>
        ) : roomState === 'loading' ? (
          <p className="empty">Загрузка комнаты...</p>
        ) : roomState === 'not_found' ? (
          <section className="status-card">
            <h1>Комната не найдена</h1>
            <p>{roomError || 'Проверь ссылку или вернись к списку комнат.'}</p>
            <div className="status-actions">
              <a className="button button-secondary" href="/rooms">
                Назад к комнатам
              </a>
            </div>
          </section>
        ) : roomState === 'error' ? (
          <section className="status-card">
            <h1>Не удалось открыть комнату</h1>
            <p>{roomError || 'Попробуй повторить загрузку еще раз.'}</p>
            <div className="status-actions">
              <button className="button" type="button" onClick={() => setRoomReloadKey((value) => value + 1)}>
                Повторить
              </button>
              <a className="button button-secondary" href="/rooms">
                Назад к комнатам
              </a>
            </div>
          </section>
        ) : room ? (
          <section className="room-shell">
            <div className="room-meta-card">
              <h1>{room.name}</h1>
              <p>{room.topic}</p>
              <div className="room-facts">
                <span>id: {room.id}</span>
                <span>тип: {room.kind}</span>
                <span>в комнате: {room.members}</span>
              </div>
            </div>

            <div className="room-chat-card">
              <div className="chat-header">
                <h2>Сообщения</h2>
                <a href="/rooms">Назад к комнатам</a>
              </div>

              <div className="message-list">
                {messagesState === 'loading' ? (
                  <p className="empty">Загрузка истории сообщений...</p>
                ) : messagesState === 'error' ? (
                  <div className="inline-state inline-state-error">
                    <p>{messagesError}</p>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setMessagesReloadKey((value) => value + 1)}
                    >
                      Повторить загрузку
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="empty">Сообщений пока нет.</p>
                ) : (
                  messages.map((message) => (
                    <article key={message.id} className="message-item">
                      <div className="message-topline">
                        <strong>{message.author}</strong>
                        <span>{formatTimestamp(message.sentAt)}</span>
                      </div>
                      <p>{message.text}</p>
                    </article>
                  ))
                )}
              </div>

              <form className="composer-form" onSubmit={handleSubmit}>
                <textarea
                  className="text-area"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Сообщение в #${room.id}`}
                  rows={4}
                />

                <div className="composer-actions">
                  {sendError ? <p className="form-error">{sendError}</p> : <span />}
                  <button className="button" type="submit" disabled={isSending}>
                    {isSending ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
