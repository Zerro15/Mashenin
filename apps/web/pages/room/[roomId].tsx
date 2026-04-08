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
type InviteCreateState = 'idle' | 'loading' | 'ready' | 'error';
type InviteCopyState = 'idle' | 'success' | 'error';

const apiClient = createApiClient();

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}

function formatMembersLabel(count: number) {
  if (count === 1) {
    return '1 участник';
  }

  if (count >= 2 && count <= 4) {
    return `${count} участника`;
  }

  return `${count} участников`;
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
  const [inviteCreateState, setInviteCreateState] = useState<InviteCreateState>('idle');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteCopyState, setInviteCopyState] = useState<InviteCopyState>('idle');
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
      setInviteCreateState('idle');
      setInviteLink('');
      setInviteError('');
      setInviteCopyState('idle');
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

  async function handleCreateInvite() {
    if (!roomId || inviteCreateState === 'loading' || inviteLink) {
      return;
    }

    setInviteCreateState('loading');
    setInviteError('');
    setInviteCopyState('idle');

    try {
      const response = await apiClient.post(`/api/rooms/${roomId}/invites`);
      const nextPath = response.data?.invite?.path;

      if (!response.data?.ok || typeof nextPath !== 'string' || !nextPath.startsWith('/')) {
        setInviteCreateState('error');
        setInviteError('Не удалось подготовить ссылку для приглашения.');
        return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setInviteLink(origin ? `${origin}${nextPath}` : nextPath);
      setInviteCreateState('ready');
    } catch {
      setInviteCreateState('error');
      setInviteError('Не удалось подготовить ссылку для приглашения.');
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.value = inviteLink;
        document.body.appendChild(input);
        input.select();
        input.setSelectionRange(0, inviteLink.length);
        const copied = document.execCommand('copy');
        document.body.removeChild(input);

        if (!copied) {
          throw new Error('copy_failed');
        }
      } else {
        throw new Error('clipboard_unavailable');
      }

      setInviteCopyState('success');
    } catch {
      setInviteCopyState('error');
    }
  }

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
          <p className="empty">Открываю разговор...</p>
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
            <h1>Не удалось открыть разговор</h1>
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
            <div className="room-chat-card">
              <div className="chat-header">
                <div className="conversation-header">
                  <div className="conversation-kicker">
                    <a href="/rooms">Все комнаты</a>
                  </div>
                  <h1>{room.name}</h1>
                  <p className="conversation-topic">
                    {room.topic || 'Открой этот разговор и продолжи общение.'}
                  </p>
                  <div className="conversation-meta">{formatMembersLabel(room.members)}</div>
                </div>
              </div>

              <div className="message-list">
                {messagesState === 'loading' ? (
                  <p className="empty">Загружаю сообщения...</p>
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
                  <div className="empty-conversation-state">
                    <h2>Пока здесь тихо</h2>
                    <p>Напиши первое сообщение или пригласи человека, чтобы разговор в этой комнате наконец начался.</p>
                    <div className="empty-conversation-invite">
                      <div className="empty-conversation-invite-copy">
                        <h3>Пригласи первого человека</h3>
                        <p>Подготовь ссылку на эту комнату и отправь ее тому, с кем хочешь начать разговор.</p>
                      </div>

                      {inviteCreateState === 'ready' && inviteLink ? (
                        <div className="invite-inline-state invite-inline-state-success">
                          <p>Ссылка готова. Ее можно отправить прямо сейчас.</p>
                          <div className="invite-inline-link">
                            <input className="text-input invite-link-input" type="text" value={inviteLink} readOnly />
                            <button className="button button-secondary" type="button" onClick={handleCopyInviteLink}>
                              Скопировать ссылку
                            </button>
                          </div>
                          {inviteCopyState === 'success' ? (
                            <div className="empty-conversation-cta">Ссылка скопирована.</div>
                          ) : inviteCopyState === 'error' ? (
                            <p className="invite-inline-note">Не удалось скопировать автоматически. Скопируй ссылку вручную из поля выше.</p>
                          ) : (
                            <p className="invite-inline-note">Когда человек откроет ссылку, он сможет войти и сразу попасть в эту комнату.</p>
                          )}
                        </div>
                      ) : (
                        <div className="invite-inline-state">
                          <div className="invite-inline-actions">
                            <button
                              className="button"
                              type="button"
                              onClick={handleCreateInvite}
                              disabled={inviteCreateState === 'loading'}
                            >
                              {inviteCreateState === 'loading' ? 'Готовлю ссылку...' : 'Пригласить человека'}
                            </button>
                            {inviteCreateState === 'error' ? (
                              <button className="button button-secondary" type="button" onClick={handleCreateInvite}>
                                Повторить
                              </button>
                            ) : null}
                          </div>
                          {inviteCreateState === 'error' ? (
                            <p className="form-error">{inviteError}</p>
                          ) : (
                            <p className="invite-inline-note">Это самый простой следующий шаг, если комната пока пустая.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="empty-conversation-cta">Поле для сообщения находится сразу ниже.</div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <article key={message.id} className="message-item">
                      <div className="message-bubble">
                        <div className="message-topline">
                          <strong className="message-author">{message.author}</strong>
                          <span className="message-time">{formatTimestamp(message.sentAt)}</span>
                        </div>
                        <p className="message-text">{message.text}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <form className="composer-form" onSubmit={handleSubmit}>
                <div className={`composer-shell${messages.length === 0 ? ' composer-shell-first-message' : ''}`}>
                  <textarea
                    className="text-area"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={`Напиши сообщение в ${room.name}`}
                    rows={3}
                  />

                  <div className="composer-actions">
                    {sendError ? <p className="form-error">{sendError}</p> : <span className="composer-hint">Ответ в эту комнату</span>}
                    <button className="button" type="submit" disabled={isSending || !draft.trim()}>
                      {isSending ? 'Отправка...' : 'Отправить'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
