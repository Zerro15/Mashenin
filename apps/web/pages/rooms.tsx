import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { createApiClient } from '../lib/api';

interface Room {
  id: string;
  name: string;
  kind: string;
  topic: string;
  members: number;
}

const apiClient = createApiClient();

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, []);

  return (
    <div className="container">
      <Header />

      <main className="main">
        <section className="page-intro">
          <h1>Комнаты</h1>
          <p>Выбери комнату и открой текстовый поток.</p>
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
      </main>
    </div>
  );
}
