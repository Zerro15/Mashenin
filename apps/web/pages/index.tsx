import { GetServerSideProps } from 'next';
import { createApiClient } from '../lib/api';

interface HomePageProps {
  summary: any;
}

export default function Home({ summary }: HomePageProps) {
  return (
    <div className="container">
      <header className="header">
        <h1>mashenin</h1>
        <nav>
          <a href="/rooms">Комнаты</a>
          <a href="/friends">Люди</a>
          <a href="/events">События</a>
        </nav>
      </header>

      <main className="main">
        <section className="hero">
          <h2>Голосовые комнаты и текст в одном месте</h2>
          <p>Постоянные комнаты для команд, регулярные созвоны и спокойное общение сообществ без перегруженного интерфейса.</p>
        </section>

        <section className="summary">
          <div className="stats">
            <div className="stat">
              <strong>{summary?.totalFriends || 0}</strong>
              <span>участников</span>
            </div>
            <div className="stat">
              <strong>{summary?.onlineFriends || 0}</strong>
              <span>в сети</span>
            </div>
            <div className="stat">
              <strong>{summary?.inVoiceFriends || 0}</strong>
              <span>в голосе</span>
            </div>
            <div className="stat">
              <strong>{summary?.activeRooms || 0}</strong>
              <span>активных комнат</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const apiClient = createApiClient('http://api:4000');
    const response = await apiClient('/summary');

    return {
      props: {
        summary: response.ok ? response.data : {}
      }
    };
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    return {
      props: {
        summary: {}
      }
    };
  }
};