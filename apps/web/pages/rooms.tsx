import { GetServerSideProps } from 'next';
import { createApiClient } from '../lib/api';

interface Room {
  id: string;
  name: string;
  kind: string;
  topic: string;
  members: number;
}

interface RoomsPageProps {
  rooms: Room[];
}

export default function Rooms({ rooms }: RoomsPageProps) {
  return (
    <div className="container">
      <header className="header">
        <h1>Комнаты</h1>
        <Link href="/create" className="button">
          Создать комнату
        </Link>
      </header>

      <main className="main">
        <section className="room-list">
          {rooms.length === 0 ? (
            <p className="empty">Пока нет комнат. Создайте первую!</p>
          ) : (
            <div className="grid">
              {rooms.map((room) => (
                <Link key={room.id} href={`/room/${room.id}`} className="room-card">
                  <h3>{room.name}</h3>
                  <p>{room.topic}</p>
                  <div className="members">
                    <span>{room.members}</span> участников
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const apiClient = createApiClient('http://api:4000');
    const response = await apiClient.get('/rooms');

    return {
      props: {
        rooms: response.data?.ok ? response.data.rooms : []
      }
    };
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return {
      props: {
        rooms: []
      }
    };
  }
};