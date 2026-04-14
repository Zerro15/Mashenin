import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { createApiClient } from '../lib/api';
import { useAuthRoute } from '../lib/session';

interface Team {
  id: string;
  slug: string;
  name: string;
  topic: string;
  members: number;
}

const apiClient = createApiClient();

export default function Teams() {
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (isChecking || !user) return;

    async function load() {
      try {
        const res = await apiClient.get('/api/teams');
        if (res.data?.ok) {
          setTeams(res.data.teams || []);
        }
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }

    load();
  }, [isChecking, user]);

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} totalUnread={0} />

      <main className="main">
        <section className="page-intro">
          <div className="page-intro-bar">
            <div>
              <h1>Команды</h1>
              <p>Быстрые конференции — собери команду и начни разговор.</p>
            </div>
            <a className="button" href="/teams/create">
              Создать команду
            </a>
          </div>
        </section>

        <section className="team-list">
          {loadState === 'loading' && <p className="empty">Загрузка...</p>}

          {loadState === 'ready' && teams.length === 0 && (
            <section className="status-card first-start-card">
              <h1>{user?.name ? `${user.name}, начни первую конференцию` : 'Начни первую конференцию'}</h1>
              <p>Создай команду, пригласи людей ссылкой и начни разговор.</p>
              <div className="status-actions">
                <a className="button" href="/teams/create">
                  Создать команду
                </a>
              </div>
            </section>
          )}

          {loadState === 'ready' && teams.length > 0 && (
            <div className="grid">
              {teams.map(team => (
                <a key={team.id} href={`/team/${team.slug}`} className="room-card">
                  <div className="room-card-header">
                    <h3>{team.name}</h3>
                  </div>
                  <p>{team.topic || 'Без описания'}</p>
                  <div className="members">
                    <span>{team.members}</span> участник{team.members !== 1 ? 'ов' : ''}
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
