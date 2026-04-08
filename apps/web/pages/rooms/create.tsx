import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

const apiClient = createApiClient();

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Название комнаты обязательно.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post('/api/rooms', {
        name,
        topic
      });

      if (!response.data?.ok || !response.data?.room?.id) {
        setError('Не удалось создать комнату.');
        return;
      }

      router.push(`/room/${response.data.room.id}`);
    } catch (submitError: any) {
      const nextError =
        submitError?.response?.status === 401
          ? 'Сессия истекла. Войди снова.'
          : submitError?.response?.data?.error === 'room_name_required'
            ? 'Название комнаты обязательно.'
            : 'Не удалось создать комнату.';

      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main auth-page">
        {isChecking ? (
          <p className="empty">Проверка сессии...</p>
        ) : (
          <section className="auth-card">
            <h1>Новая комната</h1>
            <p>Создай новую текстовую комнату и сразу перейди в нее.</p>

            <form className="stack-form" onSubmit={handleSubmit}>
              <label className="field-block">
                <span>Название</span>
                <input
                  className="text-input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например, Команда"
                  maxLength={64}
                  required
                />
              </label>

              <label className="field-block">
                <span>Тема</span>
                <textarea
                  className="text-area"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Коротко опиши, для чего нужна эта комната"
                  rows={4}
                  maxLength={160}
                />
              </label>

              {error ? <p className="form-error">{error}</p> : null}

              <div className="form-actions">
                <a className="button button-secondary" href="/rooms">
                  Назад
                </a>
                <button className="button" type="submit" disabled={isSubmitting || isChecking}>
                  {isSubmitting ? 'Создание...' : 'Создать комнату'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
