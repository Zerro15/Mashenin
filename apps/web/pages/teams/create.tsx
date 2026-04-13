import { FormEvent, useState } from 'react';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

const apiClient = createApiClient();

export default function CreateTeam() {
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setError('');

    try {
      const res = await apiClient.post('/api/teams', { name: name.trim(), topic: topic.trim() });
      if (res.data?.ok && res.data.team) {
        window.location.href = `/team/${res.data.team.slug}`;
        return;
      }
      setError('Не удалось создать команду.');
    } catch {
      setError('Не удалось создать команду. Попробуй снова.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} totalUnread={0} />

      <main className="main">
        <section className="create-room-card">
          <h1>Создать команду</h1>
          <p>Команда — это быстрая конференция. Пригласи людей и начни разговор.</p>

          {error && <p className="error">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Название</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Моя команда"
                required
                disabled={isCreating}
              />
            </div>

            <div className="form-group">
              <label>Описание (необязательно)</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="О чём будем говорить"
                disabled={isCreating}
              />
            </div>

            <button type="submit" className="button" disabled={!name.trim() || isCreating}>
              {isCreating ? 'Создаю...' : 'Создать команду'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
