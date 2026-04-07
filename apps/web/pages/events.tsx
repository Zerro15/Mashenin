import { GetServerSideProps } from 'next';
import { createApiClient } from '../lib/api';

interface Event {
  id: string;
  title: string;
  startsAt: string;
  attendees: number;
  roomId: string;
  attendeesByUserId?: Record<string, string>;
}

interface EventsPageProps {
  events: Event[];
}

export default function Events({ events }: EventsPageProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <div className="container">
      <header className="header">
        <h1>События</h1>
      </header>

      <main className="main">
        <section className="event-list">
          {events.length === 0 ? (
            <p className="empty">Пока нет событий. Создайте первое!</p>
          ) : (
            <div className="grid">
              {events.map((event) => (
                <div key={event.id} className="event-card">
                  <h3>{event.title}</h3>
                  <p className="date">{formatDate(event.startsAt)}</p>
                  <p className="room">Комната: {event.roomId}</p>
                  <div className="attendees">
                    <span>{event.attendees}</span> участников
                  </div>
                </div>
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
    const response = await apiClient.get('/events');

    return {
      props: {
        events: response.data?.ok ? response.data.events : []
      }
    };
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return {
      props: {
        events: []
      }
    };
  }
};