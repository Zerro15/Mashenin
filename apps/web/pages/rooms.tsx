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

const apiClient = createApiClient();

export default function Rooms() {
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isChecking || !user) {
      return;
    }

    let isActive = true;

    async function loadRooms() {
      try {
        const response = await apiClient.get('/api/rooms');

        if (!isActive) {
          return;
        }

        setRooms(response.data?.ok ? response.data.rooms || [] : []);
        setError('');
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        console.error('Failed to fetch rooms:', loadError);
        setRooms([]);
        setError('Не удалось загрузить комнаты.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadRooms();

    return () => {
      isActive = false;
    };
  }, [isChecking, user]);

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
                  <p>Выбери комнату и открой текстовый поток.</p>
                </div>
                <a className="button" href="/rooms/create">
                  Новая комната
                </a>
              </div>
            </section>

            <section className="room-list">
              {isLoading ? (
                <p className="empty">Загрузка комнат...</p>
              ) : error ? (
                <p className="empty">{error}</p>
              ) : rooms.length === 0 ? (
                <p className="empty">Пока нет комнат.</p>
              ) : (
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
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
