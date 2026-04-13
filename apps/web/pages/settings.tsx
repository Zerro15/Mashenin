import { FormEvent, useState } from 'react';
import Header from '../components/layout/Header';
import { createApiClient } from '../lib/api';
import { useAuthRoute } from '../lib/session';

const apiClient = createApiClient();

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Settings() {
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [about, setAbout] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!displayName.trim()) {
      setSaveError('Имя не может быть пустым.');
      return;
    }

    setSaveState('saving');
    setSaveError('');

    try {
      const response = await apiClient.put('/api/auth/profile', {
        displayName: displayName.trim(),
        about: about.trim(),
      });

      if (!response.data?.ok) {
        throw new Error('update_failed');
      }

      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setSaveError('Не удалось сохранить изменения.');
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main">
        {isChecking ? (
          <p className="empty">Проверка сессии...</p>
        ) : (
          <section className="settings-card">
            <h1>Настройки профиля</h1>
            <p className="settings-description">
              Здесь можно изменить своё имя и короткую информацию о себе.
            </p>

            <form className="settings-form" onSubmit={handleSubmit}>
              <div className="settings-field">
                <label htmlFor="displayName" className="settings-field-label">
                  Имя
                </label>
                <input
                  id="displayName"
                  className="text-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Как тебя зовут?"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="about" className="settings-field-label">
                  О себе
                </label>
                <textarea
                  id="about"
                  className="text-area"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Пара слов о себе..."
                  rows={3}
                />
              </div>

              <div className="settings-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={saveState === 'saving'}
                >
                  {saveState === 'saving' ? 'Сохраняю...' :
                   saveState === 'saved' ? 'Сохранено ✓' :
                   'Сохранить'}
                </button>
                {saveState === 'error' && (
                  <p className="form-error">{saveError}</p>
                )}
              </div>
            </form>

            <div className="settings-divider" />

            <section className="settings-danger-zone">
              <h2>Аккаунт</h2>
              <p className="settings-description">
                Email: {user?.email || 'не указан'}
              </p>
              <p className="settings-description">
                ID: {user?.id}
              </p>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
