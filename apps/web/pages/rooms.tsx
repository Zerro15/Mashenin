import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { createApiClient } from '../lib/api';
import { useAuthRoute } from '../lib/session';

interface Room {
  id: string;
  name: string;
  kind: string;
  topic: string;
  members: number;
}

type RoomsLoadState = 'loading' | 'ready' | 'empty' | 'error';

const apiClient = createApiClient();

export default function Rooms() {
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsState, setRoomsState] = useState<RoomsLoadState>('loading');
  const [roomsError, setRoomsError] = useState('');
  const [roomsReloadKey, setRoomsReloadKey] = useState(0);
  const isFirstStart = roomsState === 'empty';

  useEffect(() => {
    if (isChecking || !user) {
      return;
    }

    let isActive = true;

    async function loadRooms() {
      setRoomsState('loading');
      setRooms([]);
      setRoomsError('');

      try {
        const response = await apiClient.get('/api/rooms');

        if (!isActive) {
          return;
        }

        if (!response.data?.ok || !Array.isArray(response.data.rooms)) {
          setRooms([]);
          setRoomsState('error');
          setRoomsError('Не удалось загрузить список комнат.');
          return;
        }

        const nextRooms = response.data.rooms;

        setRooms(nextRooms);
        setRoomsState(nextRooms.length === 0 ? 'empty' : 'ready');
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        console.error('Failed to fetch rooms:', loadError);
        setRooms([]);
        setRoomsState('error');
        setRoomsError('Не удалось загрузить список комнат.');
      }
    }

    loadRooms();

    return () => {
      isActive = false;
    };
  }, [isChecking, roomsReloadKey, user]);

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main">
        {isChecking ? (
          <p className="empty">Проверка сессии...</p>
        ) : (
          <>
            <section className="page-intro">
              <div className="page-intro-bar">
                <div>
                  <h1>Комнаты</h1>
                  <p>
                    {isFirstStart
                      ? `${user?.name ? `${user.name}, ` : ''}начни с первой комнаты и пригласи человека, чтобы разговор появился прямо здесь.`
                      : 'Здесь можно открыть существующую комнату или создать новую для своего разговора.'}
                  </p>
                </div>
                <a className="button" href="/rooms/create">
                  Создать комнату
                </a>
              </div>
            </section>

            <section className="room-list">
              {roomsState === 'loading' ? (
                <p className="empty">Загрузка комнат...</p>
              ) : roomsState === 'error' ? (
                <section className="status-card">
                  <h1>Не удалось загрузить комнаты</h1>
                  <p>{roomsError || 'Попробуй повторить загрузку списка еще раз.'}</p>
                  <div className="status-actions">
                    <button className="button" type="button" onClick={() => setRoomsReloadKey((value) => value + 1)}>
                      Повторить загрузку
                    </button>
                  </div>
                </section>
              ) : roomsState === 'empty' ? (
                <section className="status-card first-start-card">
                  <h1>{user?.name ? `${user.name}, начни первый разговор` : 'Начни первый разговор'}</h1>
                  <p>Пока у тебя нет комнат. Самый понятный стартовый сценарий здесь простой: создай первую комнату и пригласи в нее человека.</p>
                  <div className="first-start-steps" aria-label="Первый сценарий">
                    <div className="first-start-step">
                      <strong>1. Создай первую комнату</strong>
                      <span>Достаточно одного названия. После создания ты сразу попадешь внутрь.</span>
                    </div>
                    <div className="first-start-step">
                      <strong>2. Пригласи человека ссылкой</strong>
                      <span>Внутри комнаты можно сразу подготовить invite link и отправить его собеседнику.</span>
                    </div>
                  </div>
                  <div className="status-actions">
                    <a className="button" href="/rooms/create">
                      Создать комнату
                    </a>
                  </div>
                </section>
              ) : roomsState === 'ready' ? (
                <>
                  <section className="guidance-card">
                    <h2>{user?.name ? `${user.name}, начни с удобного шага` : 'Начни с удобного шага'}</h2>
                    <p>Можно сразу открыть существующую комнату из списка ниже или создать свою, если хочешь начать новый разговор.</p>
                  </section>

                  <div className="grid">
                    {rooms.map((room) => (
                      <a key={room.id} href={`/room/${room.id}`} className="room-card">
                        <h3>{room.name}</h3>
                        <p>{room.topic}</p>
                        <div className="members">
                          <span>{room.members}</span> участников
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
