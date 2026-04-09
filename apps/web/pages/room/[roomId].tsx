import { FormEvent, useEffect, useRef, useState } from 'react';
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

interface RoomSpeaker {
  id: string;
  name: string;
  status: string;
  note: string;
}

interface Room {
  id: string;
  name: string;
  topic: string;
  kind: string;
  members: number;
  speakers: RoomSpeaker[];
}

type RoomLoadState = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';
type MessagesLoadState = 'idle' | 'loading' | 'ready' | 'error';
type InviteCreateState = 'idle' | 'loading' | 'ready' | 'error';
type InviteCopyState = 'idle' | 'success' | 'error';
type MessagesSyncState = 'idle' | 'syncing';
type VoiceCallState = 'idle' | 'connecting' | 'connected' | 'error';

type LiveKitModule = {
  Room: new (options?: any) => any;
  RoomEvent: Record<string, string>;
  createLocalAudioTrack: (options?: any) => Promise<any>;
};

const apiClient = createApiClient();
const ROOM_MESSAGES_POLL_INTERVAL_MS = 5000;
const LIVEKIT_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.esm.mjs';

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

function mergeMessages(currentMessages: RoomMessage[], nextMessages: RoomMessage[]) {
  const byId = new Map<string, RoomMessage>();

  for (const message of currentMessages) {
    byId.set(message.id, message);
  }

  for (const message of nextMessages) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
  );
}

function areSpeakersEqual(currentSpeakers: RoomSpeaker[] = [], nextSpeakers: RoomSpeaker[] = []) {
  if (currentSpeakers.length !== nextSpeakers.length) {
    return false;
  }

  return currentSpeakers.every((speaker, index) => {
    const nextSpeaker = nextSpeakers[index];

    return (
      speaker.id === nextSpeaker?.id &&
      speaker.name === nextSpeaker?.name &&
      speaker.status === nextSpeaker?.status &&
      speaker.note === nextSpeaker?.note
    );
  });
}

function formatVoiceCountLabel(count: number) {
  if (count === 0) {
    return 'Пока никто не в звонке.';
  }

  if (count === 1) {
    return 'Сейчас в звонке 1 человек.';
  }

  return `Сейчас в звонке ${count} человек.`;
}

function getVoiceErrorMessage(error: any) {
  const apiError = error?.response?.data?.error;

  if (apiError === 'unauthorized' || apiError === 'voice_access_denied') {
    return 'Нужна активная сессия, чтобы подключиться к звонку.';
  }

  if (apiError === 'room_not_found' || apiError === 'join_failed') {
    return 'Не удалось подключиться именно к этой комнате.';
  }

  if (error?.name === 'NotAllowedError') {
    return 'Браузер не дал доступ к микрофону.';
  }

  if (error?.name === 'NotFoundError') {
    return 'Не найден микрофон для подключения.';
  }

  return 'Не удалось подключиться к звонку.';
}

async function loadLiveKitClient(): Promise<LiveKitModule> {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<LiveKitModule>;
  return dynamicImport(LIVEKIT_CLIENT_URL);
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
  const [messagesSyncState, setMessagesSyncState] = useState<MessagesSyncState>('idle');
  const [roomReloadKey, setRoomReloadKey] = useState(0);
  const [messagesReloadKey, setMessagesReloadKey] = useState(0);
  const [showCreateHandoff, setShowCreateHandoff] = useState(false);
  const [showInviteHandoff, setShowInviteHandoff] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceCallState>('idle');
  const [voiceError, setVoiceError] = useState('');
  const liveRoomRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const voiceTeardownRef = useRef(false);
  const hasJoinedCompanion = Boolean(room && room.members > 1 && messages.length === 0);
  const createdQuery = typeof router.query.created === 'string' ? router.query.created : '';
  const joinedQuery = typeof router.query.joined === 'string' ? router.query.joined : '';
  const shouldShowCreateHandoff = showCreateHandoff && messages.length === 0;
  const voiceParticipantsCount = room?.speakers?.length || 0;
  const voiceStatusText =
    voiceState === 'connecting'
      ? 'Подключаю тебя к звонку...'
      : voiceState === 'connected'
        ? 'Ты уже в звонке этой комнаты.'
        : voiceState === 'error'
          ? voiceError
          : formatVoiceCountLabel(voiceParticipantsCount);

  useEffect(() => {
    if (!roomId || createdQuery !== '1') {
      return;
    }

    setShowCreateHandoff(true);
    void router.replace(`/room/${roomId}`, undefined, { shallow: true });
  }, [createdQuery, roomId, router]);

  useEffect(() => {
    if (!roomId || joinedQuery !== '1') {
      return;
    }

    setShowInviteHandoff(true);
    void router.replace(`/room/${roomId}`, undefined, { shallow: true });
  }, [joinedQuery, roomId, router]);

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
      setMessagesSyncState('idle');
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
      setMessagesSyncState('idle');
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
  }, [isChecking, messagesReloadKey, room?.id, user]);

  useEffect(() => {
    if (!room?.id || isChecking || !user || messagesState !== 'ready') {
      return;
    }

    let isActive = true;
    let isRefreshing = false;

    async function refreshRoomActivity() {
      if (isRefreshing) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      isRefreshing = true;
      setMessagesSyncState('syncing');

      try {
        const [roomResponse, messagesResponse] = await Promise.all([
          apiClient.get(`/api/rooms/${room.id}`),
          apiClient.get(`/api/rooms/${room.id}/messages`)
        ]);

        if (!isActive) {
          return;
        }

        if (roomResponse.data?.ok && roomResponse.data.room) {
          const nextRoom = roomResponse.data.room;

          setRoom((currentRoom) => {
            if (!currentRoom || currentRoom.id !== nextRoom.id) {
              return currentRoom;
            }

            if (
              currentRoom.name === nextRoom.name &&
              currentRoom.topic === nextRoom.topic &&
              currentRoom.kind === nextRoom.kind &&
              currentRoom.members === nextRoom.members &&
              areSpeakersEqual(currentRoom.speakers, nextRoom.speakers)
            ) {
              return currentRoom;
            }

            return nextRoom;
          });
        }

        const nextMessages = messagesResponse.data?.ok ? messagesResponse.data.messages || [] : [];
        setMessages((currentMessages) => mergeMessages(currentMessages, nextMessages));
      } catch (loadError) {
        if (isActive) {
          console.error('Failed to refresh room activity:', loadError);
        }
      } finally {
        if (isActive) {
          setMessagesSyncState('idle');
        }

        isRefreshing = false;
      }
    }

    const intervalId = window.setInterval(refreshRoomActivity, ROOM_MESSAGES_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [isChecking, messagesState, room?.id, user]);

  useEffect(() => {
    return () => {
      const currentRoom = liveRoomRef.current;
      const currentTrack = localAudioTrackRef.current;

      liveRoomRef.current = null;
      localAudioTrackRef.current = null;

      if (currentTrack?.stop) {
        currentTrack.stop();
      }

      if (currentRoom) {
        try {
          currentRoom.disconnect();
        } catch {}
      }

      if (roomId) {
        void apiClient.post(`/api/rooms/${roomId}/leave`).catch(() => {});
      }
    };
  }, [roomId]);

  async function refreshRoomSnapshot() {
    if (!roomId) {
      return;
    }

    try {
      const roomResponse = await apiClient.get(`/api/rooms/${roomId}`);

      if (roomResponse.data?.ok && roomResponse.data.room) {
        setRoom(roomResponse.data.room);
      }
    } catch {}
  }

  async function cleanupVoiceConnection(options: { notifyServer?: boolean; nextState?: VoiceCallState; nextError?: string } = {}) {
    if (voiceTeardownRef.current) {
      return;
    }

    voiceTeardownRef.current = true;

    const { notifyServer = true, nextState = 'idle', nextError = '' } = options;
    const currentRoom = liveRoomRef.current;
    const currentTrack = localAudioTrackRef.current;

    liveRoomRef.current = null;
    localAudioTrackRef.current = null;

    if (currentTrack?.stop) {
      currentTrack.stop();
    }

    if (currentRoom) {
      try {
        currentRoom.disconnect();
      } catch {}
    }

    if (notifyServer && roomId) {
      try {
        await apiClient.post(`/api/rooms/${roomId}/leave`);
      } catch {}
    }

    setVoiceState(nextState);
    setVoiceError(nextError);
    await refreshRoomSnapshot();
    voiceTeardownRef.current = false;
  }

  async function handleJoinVoice() {
    if (!roomId || !user || voiceState === 'connecting' || voiceState === 'connected') {
      return;
    }

    setVoiceState('connecting');
    setVoiceError('');

    try {
      const joinResponse = await apiClient.post(`/api/rooms/${roomId}/join`);

      if (!joinResponse.data?.ok) {
        throw new Error('join_failed');
      }

      const tokenResponse = await apiClient.post(`/api/rooms/${roomId}/token`);
      const voiceAccess = tokenResponse.data?.data;

      if (!tokenResponse.data?.ok || !voiceAccess?.token || !voiceAccess?.wsUrl) {
        throw new Error('voice_access_denied');
      }

      const liveKit = await loadLiveKitClient();
      const connection = new liveKit.Room({
        adaptiveStream: true,
        dynacast: true
      });

      connection.on(liveKit.RoomEvent.Disconnected, () => {
        if (liveRoomRef.current === connection) {
          void cleanupVoiceConnection();
        }
      });

      const localAudioTrack = await liveKit.createLocalAudioTrack();

      await connection.connect(voiceAccess.wsUrl, voiceAccess.token);
      await connection.localParticipant.publishTrack(localAudioTrack);

      liveRoomRef.current = connection;
      localAudioTrackRef.current = localAudioTrack;
      setVoiceState('connected');
      setVoiceError('');
      await refreshRoomSnapshot();
    } catch (error: any) {
      const nextError = getVoiceErrorMessage(error);
      await cleanupVoiceConnection({
        notifyServer: true,
        nextState: 'error',
        nextError
      });
    }
  }

  async function handleLeaveVoice() {
    await cleanupVoiceConnection();
  }

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

              {shouldShowCreateHandoff ? (
                <div className="room-handoff-signal">
                  <strong>Комната создана.</strong>
                  <span>Теперь можно написать первое сообщение или сразу пригласить человека ссылкой из этого разговора.</span>
                </div>
              ) : null}

              {showInviteHandoff ? (
                <div className="room-handoff-signal room-handoff-signal-success">
                  <strong>Приглашение сработало.</strong>
                  <span>Ты уже в нужном разговоре. Здесь можно читать историю, отвечать и продолжать общение.</span>
                </div>
              ) : null}

              <section className="room-voice-card">
                <div className="room-voice-copy">
                  <h2>Звонок в комнате</h2>
                  <p>{voiceStatusText}</p>
                  <span className="room-voice-meta">
                    {voiceParticipantsCount > 0
                      ? `Сейчас подключены: ${room.speakers.map((speaker) => speaker.name).join(', ')}`
                      : 'Если хочешь, можно зайти в голос первым прямо из этой комнаты.'}
                  </span>
                </div>
                <div className="room-voice-actions">
                  {voiceState === 'connected' ? (
                    <button className="button button-secondary" type="button" onClick={handleLeaveVoice}>
                      Покинуть звонок
                    </button>
                  ) : (
                    <button className="button" type="button" onClick={handleJoinVoice} disabled={voiceState === 'connecting'}>
                      {voiceState === 'connecting' ? 'Подключаю...' : 'Присоединиться к звонку'}
                    </button>
                  )}
                </div>
              </section>

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
                    {hasJoinedCompanion ? (
                      <div className="room-social-signal">
                        <strong>Кто-то уже вошел в комнату.</strong>
                        <span>Ты уже не один в разговоре. Можно написать первое сообщение.</span>
                      </div>
                    ) : null}
                    <div className="empty-conversation-invite">
                      <div className="empty-conversation-invite-copy">
                        <h3>{hasJoinedCompanion ? 'Человек уже в комнате' : 'Пригласи первого человека'}</h3>
                        <p>
                          {hasJoinedCompanion
                            ? 'Собеседник уже может открыть разговор. Теперь самый естественный следующий шаг — написать первое сообщение.'
                            : 'Подготовь ссылку на эту комнату и отправь ее тому, с кем хочешь начать разговор.'}
                        </p>
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
                    {sendError ? (
                      <p className="form-error">{sendError}</p>
                    ) : (
                      <span className="composer-hint">
                        {messagesSyncState === 'syncing' ? 'Обновляется...' : 'Ответ в эту комнату'}
                      </span>
                    )}
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
