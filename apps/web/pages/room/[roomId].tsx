import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient, getSessionToken, clearSessionToken } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';
import { useChatSocket, ChatSocketMessage, TypingUser } from '../../hooks/useChatSocket';

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

interface RoomParticipant {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  topic: string;
  kind: string;
  members: number;
  participants: RoomParticipant[];
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

type VoiceParticipantTone = 'connecting' | 'calm' | 'speaking' | 'muted' | 'no-signal' | 'missing-track';

interface VoiceParticipantDiagnostics {
  id: string;
  name: string;
  isLocal: boolean;
  isInCall: boolean;
  isPresentInSdk: boolean;
  hasAudioTrack: boolean;
  isTrackSubscribed: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  signalPercent: number;
  tone: VoiceParticipantTone;
  statusLabel: string;
  detailLabel: string;
}

interface VoiceDiagnosticsSummary {
  wsUrl: string;
  localTrackCreated: boolean;
  localTrackPublished: boolean;
  localTrackMuted: boolean;
  localSignalPercent: number;
  remoteAudioTrackCount: number;
  remoteSubscribedTrackCount: number;
  attachedAudioElements: number;
  playingAudioElements: number;
  activeSpeakerNames: string[];
}

const apiClient = createApiClient();
const ROOM_MESSAGES_POLL_INTERVAL_MS = 5000;
const VOICE_DIAGNOSTICS_POLL_INTERVAL_MS = 250;
const LIVEKIT_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.esm.mjs';
const LOCAL_SPEAKING_THRESHOLD = 7;
const REMOTE_SPEAKING_THRESHOLD = 5;
const REMOTE_SPEAKING_HOLD_MS = 1500;

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

function wsMessageToRoomMessage(wsMsg: ChatSocketMessage): RoomMessage {
  return {
    id: wsMsg.id,
    author: wsMsg.author,
    sentAt: wsMsg.sentAt,
    text: wsMsg.text,
  };
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

function notifyVoiceLeaveOnUnload(roomId: string) {
  const sessionToken = getSessionToken();

  if (!roomId || !sessionToken) {
    return;
  }

  void apiClient
    .apiFetch(
      `/api/rooms/${roomId}/leave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
        keepalive: true,
      },
      sessionToken
    )
    .catch(() => {});
}

function clampSignalPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasRecentRemoteSpeakingSignal(
  participantId: string,
  recentSignals: Map<string, number>,
  now: number
) {
  const seenAt = recentSignals.get(participantId);
  return typeof seenAt === 'number' && now - seenAt <= REMOTE_SPEAKING_HOLD_MS;
}

function getParticipantTrackPublications(participant: any): any[] {
  if (participant?.audioTrackPublications?.values) {
    return Array.from<any>(participant.audioTrackPublications.values());
  }

  if (participant?.trackPublications?.values) {
    return Array.from<any>(participant.trackPublications.values());
  }

  return [];
}

function getMicrophonePublication(participant: any): any | null {
  const publications = getParticipantTrackPublications(participant);

  return (
    publications.find((publication: any) => {
      return (
        publication?.source === 'microphone' ||
        publication?.kind === 'audio' ||
        publication?.track?.kind === 'audio' ||
        publication?.trackName === 'microphone'
      );
    }) || null
  );
}

function getTrackKey(track: any) {
  return track?.sid || track?.mediaStreamTrack?.id || track?.id || '';
}

function createInitialVoiceDiagnostics(): VoiceDiagnosticsSummary {
  return {
    wsUrl: '',
    localTrackCreated: false,
    localTrackPublished: false,
    localTrackMuted: false,
    localSignalPercent: 0,
    remoteAudioTrackCount: 0,
    remoteSubscribedTrackCount: 0,
    attachedAudioElements: 0,
    playingAudioElements: 0,
    activeSpeakerNames: []
  };
}

function buildFallbackVoiceParticipants(
  room: Room | null,
  user: { id: string; name: string } | null,
  voiceState: VoiceCallState
): VoiceParticipantDiagnostics[] {
  const fallbackParticipants = (room?.speakers || []).map((speaker) => ({
    id: speaker.id,
    name: speaker.name,
    isLocal: speaker.id === user?.id,
    isInCall: true,
    isPresentInSdk: false,
    hasAudioTrack: false,
    isTrackSubscribed: false,
    isMuted: false,
    isSpeaking: false,
    signalPercent: 0,
    tone: 'missing-track' as VoiceParticipantTone,
    statusLabel: 'в звонке',
    detailLabel: 'LiveKit-диагностика появится после твоего подключения.'
  }));

  if (
    voiceState === 'connecting' &&
    user &&
    !fallbackParticipants.some((participant) => participant.id === user.id)
  ) {
    fallbackParticipants.unshift({
      id: user.id,
      name: user.name,
      isLocal: true,
      isInCall: true,
      isPresentInSdk: false,
      hasAudioTrack: false,
      isTrackSubscribed: false,
      isMuted: false,
      isSpeaking: false,
      signalPercent: 0,
      tone: 'connecting',
      statusLabel: 'подключаюсь',
      detailLabel: 'Запрашиваю доступ к звонку и готовлю аудиотрек.'
    });
  }

  return fallbackParticipants;
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
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipantDiagnostics[]>([]);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState<VoiceDiagnosticsSummary>(createInitialVoiceDiagnostics());
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  // Real-time state
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string }>>([]);
  const isDraftingRef = useRef(false);
  const wsStatusRef = useRef<string>('disconnected');
  const liveRoomRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const voiceTeardownRef = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const userRef = useRef(user);
  const voiceStateRef = useRef<VoiceCallState>('idle');
  const voiceWsUrlRef = useRef('');
  const remoteAudioMountRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLMediaElement[]>>(new Map());
  const voiceDiagnosticsIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioMeterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioMeterFrameRef = useRef<number | null>(null);
  const localMicSignalPercentRef = useRef(0);
  const remoteSpeakingSeenAtRef = useRef<Map<string, number>>(new Map());
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
  const displayedVoiceParticipants =
    voiceParticipants.length > 0 ? voiceParticipants : buildFallbackVoiceParticipants(room, user, voiceState);
  const voiceActiveSpeakersText = voiceDiagnostics.activeSpeakerNames.length
    ? voiceDiagnostics.activeSpeakerNames.join(', ')
    : 'пока никто не говорит';
  const roomParticipants = room?.participants || [];
  const directCompanions = roomParticipants.filter((participant) => participant.id !== user?.id);
  const directCompanionNames = directCompanions.map((participant) => participant.name).join(', ');
  const directContextLabel = room?.kind === 'direct' && directCompanionNames ? `Разговор с ${directCompanionNames}` : '';
  const conversationTopicText =
    room?.kind === 'direct' && directCompanionNames
      ? `${directContextLabel}. ${room.topic || 'Личный разговор без лишней настройки.'}`
      : room?.topic || 'Открой этот разговор и продолжи общение.';
  const emptyStatePresenceLabel =
    room?.kind === 'direct' && directCompanionNames
      ? `${directCompanionNames} уже ${directCompanions.length > 1 ? 'в этой комнате' : 'в этой комнате'}`
      : 'Кто-то уже вошел в комнату.';
  const emptyStatePresenceHint =
    room?.kind === 'direct' && directCompanionNames
      ? `Собеседник ${directCompanionNames} уже может открыть этот разговор. Можно писать сразу сюда.`
      : 'Ты уже не один в разговоре. Можно написать первое сообщение.';
  const inviteCardTitle =
    hasJoinedCompanion && room?.kind === 'direct' && directCompanionNames
      ? `${directCompanionNames} уже в комнате`
      : hasJoinedCompanion
        ? 'Человек уже в комнате'
        : 'Пригласи первого человека';
  const inviteCardCopy =
    hasJoinedCompanion && room?.kind === 'direct' && directCompanionNames
      ? `${directCompanionNames} уже может открыть разговор. Теперь самый естественный следующий шаг — написать первое сообщение.`
      : hasJoinedCompanion
        ? 'Собеседник уже может открыть разговор. Теперь самый естественный следующий шаг — написать первое сообщение.'
        : 'Подготовь ссылку на эту комнату и отправь ее тому, с кем хочешь начать разговор.';

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

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

    // Polling используем ТОЛЬКО как fallback когда WS не подключён
    const isWsConnected = wsStatusRef.current === 'connected';
    if (isWsConnected) {
      // WS работает — polling не нужен
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

      // Check if session is still valid before polling
      try {
        const sessionResponse = await apiClient.get('/api/auth/me');
        if (!sessionResponse.data?.ok || !sessionResponse.data?.user) {
          if (!isActive) return;
          clearSessionToken();
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/room/${room.id}`;
          const nextParam = encodeURIComponent(currentPath);
          router.replace(`/login?next=${nextParam}`);
          return;
        }
      } catch (sessionError: any) {
        if (!isActive) return;
        if (sessionError?.response?.status === 401) {
          clearSessionToken();
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/room/${room.id}`;
          const nextParam = encodeURIComponent(currentPath);
          router.replace(`/login?next=${nextParam}`);
          return;
        }
        // Non-401 errors are silently ignored for polling resilience
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
    if (liveRoomRef.current) {
      syncVoiceDiagnostics(liveRoomRef.current);
      return;
    }

    setVoiceParticipants(buildFallbackVoiceParticipants(room, user, voiceState));
  }, [room, user, voiceState]);

  useEffect(() => {
    return () => {
      const currentRoom = liveRoomRef.current;
      const currentTrack = localAudioTrackRef.current;

      liveRoomRef.current = null;
      localAudioTrackRef.current = null;
      stopVoiceDiagnosticsPolling();
      stopLocalMicMeter();
      detachAllRemoteAudioTracks();

      if (currentTrack?.stop) {
        currentTrack.stop();
      }

      if (currentRoom) {
        try {
          currentRoom.disconnect();
        } catch {}
      }

      if (roomId) {
        notifyVoiceLeaveOnUnload(roomId);
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const handlePageHide = () => {
      if (voiceStateRef.current !== 'connected' && !liveRoomRef.current && !localAudioTrackRef.current) {
        return;
      }

      notifyVoiceLeaveOnUnload(roomId);
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [roomId]);

  // --- WebSocket for real-time messages ---
  const handleWsMessage = useCallback((message: ChatSocketMessage) => {
    const roomMsg = wsMessageToRoomMessage(message);
    setMessages((prev) => {
      // Не добавляем дубликаты
      if (prev.some((m) => m.id === roomMsg.id)) return prev;
      return [...prev, roomMsg];
    });
  }, []);

  const handleWsEvent = useCallback((event: any) => {
    if (event.type === 'typing') {
      if (event.isTyping) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(event.userId, { id: event.userId, name: event.userName });
          return next;
        });
      } else {
        setTypingUsers((prev) => {
          if (!prev.has(event.userId)) return prev;
          const next = new Map(prev);
          next.delete(event.userId);
          return next;
        });
      }
    } else if (event.type === 'presence_update' && Array.isArray(event.onlineUsers)) {
      setOnlineUsers(event.onlineUsers);
    }
  }, []);

  const wsEnabled = !isChecking && !!user && !!room;

  const {
    status: wsStatus,
    onlineUsers: wsOnlineUsers,
    sendTyping,
  } = useChatSocket({
    roomId,
    userId: user?.id,
    userName: user?.name,
    onMessage: handleWsMessage,
    onEvent: handleWsEvent,
    enabled: wsEnabled,
  });

  // Sync onlineUsers from WS
  useEffect(() => {
    if (wsOnlineUsers.length > 0) {
      setOnlineUsers(wsOnlineUsers);
    }
  }, [wsOnlineUsers]);

  // Sync wsStatus to ref for polling useEffect
  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);

  function stopVoiceDiagnosticsPolling() {
    if (voiceDiagnosticsIntervalRef.current !== null) {
      window.clearInterval(voiceDiagnosticsIntervalRef.current);
      voiceDiagnosticsIntervalRef.current = null;
    }
  }

  function stopLocalMicMeter() {
    if (audioMeterFrameRef.current !== null) {
      cancelAnimationFrame(audioMeterFrameRef.current);
      audioMeterFrameRef.current = null;
    }

    if (audioMeterSourceRef.current) {
      audioMeterSourceRef.current.disconnect();
      audioMeterSourceRef.current = null;
    }

    audioAnalyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    localMicSignalPercentRef.current = 0;
  }

  function detachAllRemoteAudioTracks() {
    remoteAudioElementsRef.current.forEach((elements) => {
      elements.forEach((element) => element.remove());
    });
    remoteAudioElementsRef.current.clear();
    remoteSpeakingSeenAtRef.current.clear();
  }

  function attachRemoteAudioTrack(track: any) {
    if (!track || track.kind !== 'audio') {
      return;
    }

    const mount = remoteAudioMountRef.current;

    if (!mount) {
      return;
    }

    const trackKey = getTrackKey(track);

    if (!trackKey || remoteAudioElementsRef.current.has(trackKey)) {
      return;
    }

    const element = track.attach();
    element.autoplay = true;
    element.playsInline = true;
    element.muted = false;
    element.dataset.voiceTrack = trackKey;
    mount.appendChild(element);

    remoteAudioElementsRef.current.set(trackKey, [element]);

    const playPromise = typeof element.play === 'function' ? element.play() : undefined;
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((playbackError: any) => {
        console.error('Failed to start remote audio playback:', playbackError);
        syncVoiceDiagnostics();
      });
    }
  }

  function detachRemoteAudioTrack(track: any) {
    if (!track) {
      return;
    }

    const trackKey = getTrackKey(track);
    const attachedElements = remoteAudioElementsRef.current.get(trackKey);

    if (attachedElements) {
      attachedElements.forEach((element) => element.remove());
      remoteAudioElementsRef.current.delete(trackKey);
    }

    if (track.detach) {
      track.detach().forEach((element: HTMLMediaElement) => element.remove());
    }
  }

  function startLocalMicMeter(track: any) {
    stopLocalMicMeter();

    if (typeof window === 'undefined' || !track?.mediaStreamTrack) {
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    try {
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      const stream = new MediaStream([track.mediaStreamTrack]);
      const source = audioContext.createMediaStreamSource(stream);
      const data = new Uint8Array(analyser.frequencyBinCount);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      audioAnalyserRef.current = analyser;
      audioMeterSourceRef.current = source;

      const tick = () => {
        if (!audioAnalyserRef.current) {
          return;
        }

        audioAnalyserRef.current.getByteTimeDomainData(data);

        let peak = 0;
        for (let index = 0; index < data.length; index += 1) {
          const value = Math.abs(data[index] - 128) / 128;
          if (value > peak) {
            peak = value;
          }
        }

        const nextPercent = clampSignalPercent(peak * 220);
        localMicSignalPercentRef.current = nextPercent;

        audioMeterFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (meterError) {
      console.error('Failed to start local microphone meter:', meterError);
      stopLocalMicMeter();
    }
  }

  function syncVoiceDiagnostics(connection: any = liveRoomRef.current) {
    const currentRoom = roomRef.current;
    const currentUser = userRef.current;
    const localTrack = localAudioTrackRef.current;
    const nextDiagnostics = createInitialVoiceDiagnostics();

    nextDiagnostics.wsUrl = voiceWsUrlRef.current;
    nextDiagnostics.localTrackCreated = Boolean(localTrack?.mediaStreamTrack);
    const attachedAudioElements = Array.from(remoteAudioElementsRef.current.values()).flat();
    nextDiagnostics.attachedAudioElements = attachedAudioElements.length;
    nextDiagnostics.playingAudioElements = attachedAudioElements.filter((element) => {
      return !element.paused && !element.ended && Boolean(element.srcObject);
    }).length;

    if (!connection || !currentUser) {
      setVoiceParticipants(buildFallbackVoiceParticipants(currentRoom, currentUser, voiceStateRef.current));
      setVoiceDiagnostics({
        ...nextDiagnostics,
        localTrackCreated: nextDiagnostics.localTrackCreated,
        localSignalPercent: localMicSignalPercentRef.current,
        localTrackMuted: Boolean(localTrack?.isMuted)
      });
      return;
    }

    const sdkRemoteParticipants: any[] = connection?.remoteParticipants?.values
      ? Array.from<any>(connection.remoteParticipants.values())
      : [];
    const remoteParticipantById = new Map(
      sdkRemoteParticipants.map((participant: any) => [participant.identity || participant.sid, participant])
    );
    const visibleIds = new Set<string>();
    const nextParticipants: VoiceParticipantDiagnostics[] = [];
    const activeSpeakerIds = new Set(
      Array.isArray(connection?.activeSpeakers)
        ? connection.activeSpeakers.map((participant: any) => participant.identity || participant.sid)
        : []
    );
    const now = Date.now();

    const localParticipant = connection.localParticipant;
    const localPublication = getMicrophonePublication(localParticipant);
    const localTrackPublished = Boolean(localPublication?.trackSid || localPublication?.track || localTrack?.sid);
    const localTrackMuted = Boolean(localTrack?.isMuted || localPublication?.isMuted || localParticipant?.isMicrophoneEnabled === false);
    const localSignalPercent = localTrackMuted ? 0 : localMicSignalPercentRef.current;
    const localIsSpeaking =
      !localTrackMuted &&
      (Boolean(localParticipant?.isSpeaking) || localSignalPercent >= LOCAL_SPEAKING_THRESHOLD);

    nextDiagnostics.localTrackPublished = localTrackPublished;
    nextDiagnostics.localTrackMuted = localTrackMuted;
    nextDiagnostics.localSignalPercent = localSignalPercent;

    visibleIds.add(currentUser.id);
    nextParticipants.push({
      id: currentUser.id,
      name: currentUser.name,
      isLocal: true,
      isInCall: true,
      isPresentInSdk: true,
      hasAudioTrack: Boolean(localTrack?.mediaStreamTrack),
      isTrackSubscribed: localTrackPublished,
      isMuted: localTrackMuted,
      isSpeaking: localIsSpeaking,
      signalPercent: localSignalPercent,
      tone:
        voiceStateRef.current === 'connecting'
          ? 'connecting'
          : localTrackMuted
            ? 'muted'
            : !localTrackPublished
              ? 'missing-track'
              : localIsSpeaking
                ? 'speaking'
                : localSignalPercent > 0
                  ? 'calm'
                  : 'no-signal',
      statusLabel:
        voiceStateRef.current === 'connecting'
          ? 'подключаюсь'
          : localTrackMuted
            ? 'микрофон выключен'
            : !localTrackPublished
              ? 'трек ещё не опубликован'
              : localIsSpeaking
                ? 'говоришь'
                : localSignalPercent > 0
                  ? 'в звонке'
                  : 'сигнал 0%',
      detailLabel:
        !localTrack?.mediaStreamTrack
          ? 'Браузер не создал локальный аудиотрек.'
          : localTrackMuted
            ? 'Локальный трек опубликован, но микрофон сейчас выключен.'
            : localTrackPublished
              ? localSignalPercent > 0
                ? `Локальный микрофон даёт сигнал ${localSignalPercent}%.`
                : 'Локальный трек опубликован, но входной сигнал сейчас 0%.'
              : 'Микрофон захвачен, но публикация аудио ещё не завершилась.'
    });

    for (const speaker of currentRoom?.speakers || []) {
      if (speaker.id === currentUser.id || visibleIds.has(speaker.id)) {
        continue;
      }

      const participant = remoteParticipantById.get(speaker.id) || null;
      const publication = getMicrophonePublication(participant);
      const hasAudioTrack = Boolean(publication?.trackSid || publication?.track);
      const isTrackSubscribed = Boolean(publication?.isSubscribed || publication?.track);
      const isMuted = Boolean(publication?.isMuted || participant?.isMicrophoneEnabled === false);
      const signalPercent = clampSignalPercent(Number(participant?.audioLevel || 0) * 160);
      const detectedSpeaking =
        !isMuted &&
        (Boolean(participant?.isSpeaking) || activeSpeakerIds.has(speaker.id) || signalPercent >= REMOTE_SPEAKING_THRESHOLD);

      if (detectedSpeaking) {
        remoteSpeakingSeenAtRef.current.set(speaker.id, now);
      }

      const isSpeaking =
        !isMuted &&
        (detectedSpeaking || hasRecentRemoteSpeakingSignal(speaker.id, remoteSpeakingSeenAtRef.current, now));

      if (publication) {
        nextDiagnostics.remoteAudioTrackCount += 1;
      }

      if (isTrackSubscribed) {
        nextDiagnostics.remoteSubscribedTrackCount += 1;
      }

      visibleIds.add(speaker.id);
      nextParticipants.push({
        id: speaker.id,
        name: speaker.name,
        isLocal: false,
        isInCall: true,
        isPresentInSdk: Boolean(participant),
        hasAudioTrack,
        isTrackSubscribed,
        isMuted,
        isSpeaking,
        signalPercent,
        tone: isMuted ? 'muted' : isSpeaking ? 'speaking' : !participant || !hasAudioTrack ? 'missing-track' : signalPercent > 0 ? 'calm' : 'no-signal',
        statusLabel: isMuted ? 'микрофон выключен' : isSpeaking ? 'говорит' : !participant ? 'в звонке без SDK-сигнала' : !hasAudioTrack ? 'нет аудиотрека' : signalPercent > 0 ? 'в звонке' : 'сигнал 0%',
        detailLabel: !participant
          ? 'API показывает участника в звонке, но LiveKit ещё не отдал remote participant.'
          : !hasAudioTrack
            ? 'Участник в звонке, но его аудиотрек ещё не опубликован.'
            : !isTrackSubscribed
              ? 'Аудиотрек есть, но текущий клиент ещё не подписался на него.'
              : isMuted
                ? 'Удалённый участник подключён, но его микрофон выключен.'
                : isSpeaking && signalPercent === 0
                  ? 'Удалённый участник недавно говорил; жду следующий срез входящего уровня.'
                : signalPercent > 0
                  ? `Входящий сигнал сейчас ${signalPercent}%.`
                  : 'Входящий аудиотрек получен, но уровень сейчас 0%.'
      });
    }

    for (const participant of sdkRemoteParticipants) {
      const participantId = participant.identity || participant.sid;

      if (!participantId || visibleIds.has(participantId)) {
        continue;
      }

      const publication = getMicrophonePublication(participant);
      const hasAudioTrack = Boolean(publication?.trackSid || publication?.track);
      const isTrackSubscribed = Boolean(publication?.isSubscribed || publication?.track);
      const isMuted = Boolean(publication?.isMuted || participant?.isMicrophoneEnabled === false);
      const signalPercent = clampSignalPercent(Number(participant?.audioLevel || 0) * 160);
      const detectedSpeaking =
        !isMuted &&
        (Boolean(participant?.isSpeaking) || activeSpeakerIds.has(participantId) || signalPercent >= REMOTE_SPEAKING_THRESHOLD);

      if (detectedSpeaking) {
        remoteSpeakingSeenAtRef.current.set(participantId, now);
      }

      const isSpeaking =
        !isMuted &&
        (detectedSpeaking || hasRecentRemoteSpeakingSignal(participantId, remoteSpeakingSeenAtRef.current, now));

      if (publication) {
        nextDiagnostics.remoteAudioTrackCount += 1;
      }

      if (isTrackSubscribed) {
        nextDiagnostics.remoteSubscribedTrackCount += 1;
      }

      nextParticipants.push({
        id: participantId,
        name: participant.name || participant.identity || 'Участник',
        isLocal: false,
        isInCall: true,
        isPresentInSdk: true,
        hasAudioTrack,
        isTrackSubscribed,
        isMuted,
        isSpeaking,
        signalPercent,
        tone: isMuted ? 'muted' : isSpeaking ? 'speaking' : !hasAudioTrack ? 'missing-track' : signalPercent > 0 ? 'calm' : 'no-signal',
        statusLabel: isMuted ? 'микрофон выключен' : isSpeaking ? 'говорит' : !hasAudioTrack ? 'нет аудиотрека' : signalPercent > 0 ? 'в звонке' : 'сигнал 0%',
        detailLabel: !hasAudioTrack
          ? 'LiveKit видит участника, но микрофонный трек ещё не опубликован.'
          : !isTrackSubscribed
            ? 'Трек есть, но текущий клиент ещё не подписался на него.'
            : isSpeaking && signalPercent === 0
              ? 'Удалённый участник недавно говорил; жду следующий срез входящего уровня.'
            : signalPercent > 0
              ? `Входящий сигнал сейчас ${signalPercent}%.`
              : 'Входящий аудиотрек получен, но уровень сейчас 0%.'
      });
    }

    nextDiagnostics.activeSpeakerNames = nextParticipants
      .filter((participant) => participant.isSpeaking)
      .map((participant) => participant.name);

    nextParticipants.sort((left, right) => {
      if (left.isLocal && !right.isLocal) {
        return -1;
      }

      if (!left.isLocal && right.isLocal) {
        return 1;
      }

      if (left.isSpeaking && !right.isSpeaking) {
        return -1;
      }

      if (!left.isSpeaking && right.isSpeaking) {
        return 1;
      }

      return left.name.localeCompare(right.name, 'ru');
    });

    setVoiceParticipants(nextParticipants);
    setVoiceDiagnostics((currentDiagnostics) => ({
      ...currentDiagnostics,
      ...nextDiagnostics
    }));
    setIsVoiceMuted(localTrackMuted);
  }

  function startVoiceDiagnosticsPolling(connection: any) {
    stopVoiceDiagnosticsPolling();
    syncVoiceDiagnostics(connection);
    voiceDiagnosticsIntervalRef.current = window.setInterval(() => {
      syncVoiceDiagnostics(connection);
    }, VOICE_DIAGNOSTICS_POLL_INTERVAL_MS);
  }

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
    stopVoiceDiagnosticsPolling();
    stopLocalMicMeter();
    detachAllRemoteAudioTracks();

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
    setVoiceParticipants(buildFallbackVoiceParticipants(roomRef.current, userRef.current, nextState));
    setVoiceDiagnostics((currentDiagnostics) => ({
      ...createInitialVoiceDiagnostics(),
      wsUrl: currentDiagnostics.wsUrl
    }));
    setIsVoiceMuted(false);
    await refreshRoomSnapshot();
    voiceTeardownRef.current = false;
  }

  async function handleJoinVoice() {
    if (!roomId || !user || voiceState === 'connecting' || voiceState === 'connected') {
      return;
    }

    setVoiceState('connecting');
    setVoiceError('');
    setVoiceParticipants(buildFallbackVoiceParticipants(roomRef.current, user, 'connecting'));

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
      const syncState = () => syncVoiceDiagnostics(connection);

      connection.on(liveKit.RoomEvent.Disconnected, () => {
        if (liveRoomRef.current === connection) {
          void cleanupVoiceConnection();
        }
      });

      if (liveKit.RoomEvent.TrackSubscribed) {
        connection.on(liveKit.RoomEvent.TrackSubscribed, (track: any) => {
          attachRemoteAudioTrack(track);
          syncState();
        });
      }

      if (liveKit.RoomEvent.TrackUnsubscribed) {
        connection.on(liveKit.RoomEvent.TrackUnsubscribed, (track: any) => {
          detachRemoteAudioTrack(track);
          syncState();
        });
      }

      [
        liveKit.RoomEvent.ParticipantConnected,
        liveKit.RoomEvent.ParticipantDisconnected,
        liveKit.RoomEvent.ActiveSpeakersChanged,
        liveKit.RoomEvent.LocalTrackPublished,
        liveKit.RoomEvent.LocalTrackUnpublished,
        liveKit.RoomEvent.ConnectionStateChanged,
        liveKit.RoomEvent.TrackMuted,
        liveKit.RoomEvent.TrackUnmuted
      ]
        .filter(Boolean)
        .forEach((eventName) => {
          connection.on(eventName, syncState);
        });

      const localAudioTrack = await liveKit.createLocalAudioTrack();

      await connection.connect(voiceAccess.wsUrl, voiceAccess.token);
      await connection.localParticipant.publishTrack(localAudioTrack);

      const existingRemoteParticipants: any[] = connection?.remoteParticipants?.values
        ? Array.from<any>(connection.remoteParticipants.values())
        : [];

      existingRemoteParticipants.forEach((participant: any) => {
        getParticipantTrackPublications(participant).forEach((publication: any) => {
          if (publication?.track?.kind === 'audio') {
            attachRemoteAudioTrack(publication.track);
          }
        });
      });

      liveRoomRef.current = connection;
      localAudioTrackRef.current = localAudioTrack;
      startLocalMicMeter(localAudioTrack);
      startVoiceDiagnosticsPolling(connection);
      voiceWsUrlRef.current = voiceAccess.wsUrl;
      setVoiceDiagnostics((currentDiagnostics) => ({
        ...currentDiagnostics,
        wsUrl: voiceAccess.wsUrl
      }));
      setIsVoiceMuted(Boolean(localAudioTrack?.isMuted));
      setVoiceState('connected');
      setVoiceError('');
      syncState();
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

  async function handleToggleVoiceMute() {
    const localAudioTrack = localAudioTrackRef.current;

    if (!localAudioTrack) {
      return;
    }

    try {
      if (localAudioTrack.isMuted) {
        await localAudioTrack.unmute();
        setIsVoiceMuted(false);
      } else {
        await localAudioTrack.mute();
        setIsVoiceMuted(true);
      }

      syncVoiceDiagnostics();
    } catch (muteError) {
      console.error('Failed to toggle microphone mute state:', muteError);
    }
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

    // Отправляем через WS если подключён
    if (wsStatus === 'connected') {
      sendTyping(false); // Остановить typing при отправке
      // Сообщение уже получит WS и добавит через handleWsMessage
      // Но нам нужно подтвердить отправку — используем HTTP для confirm
      try {
        const response = await apiClient.post(`/api/rooms/${roomId}/messages`, {
          body: draft
        });

        if (!response.data?.ok || !response.data?.message) {
          setSendError('Не удалось отправить сообщение.');
          setDraft('');
          setIsSending(false);
          return;
        }

        // WS сам добавит сообщение, но на всякий случай через HTTP confirm
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
    } else {
      // HTTP fallback
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
                    {conversationTopicText}
                  </p>
                  <div className="conversation-meta">
                    {formatMembersLabel(room.members)}
                    {directContextLabel ? ` · ${directContextLabel}` : ''}
                  </div>
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
                    <>
                      <button className="button button-secondary" type="button" onClick={handleToggleVoiceMute}>
                        {isVoiceMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                      </button>
                      <button className="button button-secondary" type="button" onClick={handleLeaveVoice}>
                        Покинуть звонок
                      </button>
                    </>
                  ) : (
                    <button className="button" type="button" onClick={handleJoinVoice} disabled={voiceState === 'connecting'}>
                      {voiceState === 'connecting' ? 'Подключаю...' : 'Присоединиться к звонку'}
                    </button>
                  )}
                </div>
              </section>

              <section className="voice-diagnostics-card">
                <div className="voice-diagnostics-grid">
                  <article className="voice-diagnostics-item">
                    <strong>Твой микрофон</strong>
                    <span>
                      {!voiceDiagnostics.localTrackCreated
                        ? 'локальный трек ещё не создан'
                        : voiceDiagnostics.localTrackMuted
                          ? 'трек есть, но микрофон выключен'
                          : voiceDiagnostics.localTrackPublished
                            ? `сигнал ${voiceDiagnostics.localSignalPercent}%`
                            : 'трек создан, но ещё не опубликован'}
                    </span>
                  </article>
                  <article className="voice-diagnostics-item">
                    <strong>Удалённые аудиотреки</strong>
                    <span>
                      {voiceDiagnostics.remoteSubscribedTrackCount} из {voiceDiagnostics.remoteAudioTrackCount} получены в клиенте
                    </span>
                  </article>
                  <article className="voice-diagnostics-item">
                    <strong>Воспроизведение</strong>
                    <span>
                      {voiceDiagnostics.playingAudioElements} из {voiceDiagnostics.attachedAudioElements} audio-элемент(ов)
                      воспроизводят звук
                    </span>
                  </article>
                  <article className="voice-diagnostics-item">
                    <strong>Сейчас говорит</strong>
                    <span>{voiceActiveSpeakersText}</span>
                  </article>
                </div>
                {voiceDiagnostics.wsUrl ? (
                  <div className="voice-diagnostics-footnote">
                    LiveKit endpoint: {voiceDiagnostics.wsUrl}
                  </div>
                ) : null}
              </section>

              <section className="voice-participants-card">
                <div className="voice-participants-header">
                  <h3>Активность участников</h3>
                  <span>
                    Спокойный круг означает “в звонке”, пульсирующий показывает речь, muted и отсутствие сигнала видны отдельно.
                  </span>
                </div>
                <div className="voice-participants-list">
                  {displayedVoiceParticipants.length > 0 ? (
                    displayedVoiceParticipants.map((participant) => (
                      <article key={participant.id} className="voice-participant-row">
                        <div className={`voice-avatar voice-avatar-${participant.tone}`}>
                          <span>{participant.name.slice(0, 1).toUpperCase()}</span>
                        </div>
                        <div className="voice-participant-copy">
                          <div className="voice-participant-topline">
                            <strong>
                              {participant.name}
                              {participant.isLocal ? ' · ты' : ''}
                            </strong>
                            <span className={`voice-state-badge voice-state-badge-${participant.tone}`}>{participant.statusLabel}</span>
                          </div>
                          <p>{participant.detailLabel}</p>
                          <div className="voice-signal-rail" aria-hidden="true">
                            <span style={{ width: `${Math.max(6, participant.signalPercent)}%` }} />
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty">После входа в звонок здесь появятся участники и их аудиосостояние.</p>
                  )}
                </div>
              </section>

              <div ref={remoteAudioMountRef} aria-hidden="true" className="voice-audio-mount" />

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
                        <strong>{emptyStatePresenceLabel}</strong>
                        <span>{emptyStatePresenceHint}</span>
                      </div>
                    ) : null}
                    <div className="empty-conversation-invite">
                      <div className="empty-conversation-invite-copy">
                        <h3>{inviteCardTitle}</h3>
                        <p>{inviteCardCopy}</p>
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
                    onChange={(event) => {
                      setDraft(event.target.value);
                      // Typing indicator
                      if (wsStatus === 'connected' && sendTyping) {
                        isDraftingRef.current = true;
                        sendTyping(true);
                      }
                    }}
                    onBlur={() => {
                      if (wsStatus === 'connected' && sendTyping) {
                        isDraftingRef.current = false;
                        sendTyping(false);
                      }
                    }}
                    placeholder={`Напиши сообщение в ${room.name}`}
                    rows={3}
                  />

                  <div className="composer-actions">
                    {sendError ? (
                      <p className="form-error">{sendError}</p>
                    ) : (
                      <span className="composer-hint">
                        {messagesSyncState === 'syncing' ? 'Обновляется...' :
                         wsStatus === 'connected' ? 'Онлайн' :
                         wsStatus === 'connecting' ? 'Подключаюсь...' :
                         wsStatus === 'fallback' ? 'Режим offline' :
                         'Ответ в эту комнату'}
                      </span>
                    )}
                    <button className="button" type="submit" disabled={isSending || !draft.trim()}>
                      {isSending ? 'Отправка...' : 'Отправить'}
                    </button>
                  </div>
                </div>

                {/* Typing indicator */}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    {Array.from(typingUsers.values())
                      .map((u) => u.name)
                      .join(', ')}{' '}
                    {typingUsers.size === 1 ? 'печатает' : 'печатают'}...
                  </div>
                )}

                {/* Online users */}
                {onlineUsers.length > 0 && wsStatus === 'connected' && (
                  <div className="online-users-indicator">
                    <span className="online-dot" />
                    {onlineUsers.map((u) => u.name).join(', ')}
                  </div>
                )}
              </form>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
