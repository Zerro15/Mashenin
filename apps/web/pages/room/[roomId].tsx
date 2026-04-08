import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient, getSessionToken } from '../../lib/api';

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

const apiClient = createApiClient();

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}

export default function RoomPage() {
  const router = useRouter();
  const roomId = typeof router.query.roomId === 'string' ? router.query.roomId : '';

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomId) {
      return;
    }

    if (typeof window !== 'undefined' && !getSessionToken()) {
      router.replace('/login');
      return;
    }

    let isActive = true;

    async function loadRoom() {
      try {
        const [roomResponse, messagesResponse] = await Promise.all([
          apiClient.get(`/api/rooms/${roomId}`),
          apiClient.get(`/api/rooms/${roomId}/messages`)
        ]);

        if (!isActive) {
          return;
        }

        if (!roomResponse.data?.ok || !roomResponse.data?.room) {
          setError('Комната не найдена.');
          setRoom(null);
          setMessages([]);
          return;
        }

        setRoom(roomResponse.data.room);
        setMessages(messagesResponse.data?.ok ? messagesResponse.data.messages || [] : []);
        setError('');
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load room:', loadError);
        setError('Не удалось загрузить комнату.');
        setRoom(null);
        setMessages([]);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadRoom();

    return () => {
      isActive = false;
    };
  }, [roomId, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim() || !roomId) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const response = await apiClient.post(`/api/rooms/${roomId}/messages`, {
        body: draft
      });

      if (!response.data?.ok || !response.data?.message) {
        setError('Не удалось отправить сообщение.');
        return;
      }

      setMessages((currentMessages) => [...currentMessages, response.data.message]);
      setDraft('');
    } catch (submitError: any) {
      const nextError =
        submitError?.response?.status === 401
          ? 'Сессия истекла. Войди снова.'
          : 'Не удалось отправить сообщение.';

      setError(nextError);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="container">
      <Header requireAuth />

      <main className="main">
        {isLoading ? (
          <p className="empty">Загрузка комнаты...</p>
        ) : error && !room ? (
          <p className="empty">{error}</p>
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
                {messages.length === 0 ? (
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
                  {error ? <p className="form-error">{error}</p> : <span />}
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
