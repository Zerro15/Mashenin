import Header from '../components/layout/Header';
import { useAuthRoute } from '../lib/session';

export default function Home() {
  const { user, isChecking, logout } = useAuthRoute('guest');

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main auth-page">
        <section className="status-card">
          <h1>Комнаты для спокойного общения</h1>
          <p>Создай аккаунт, открой нужную комнату и продолжи разговор без лишних настроек и перегруженной навигации.</p>

          {isChecking ? (
            <p className="empty">Проверка сессии...</p>
          ) : (
            <div className="status-actions">
              <a className="button" href="/register">
                Создать аккаунт
              </a>
              <a className="button button-secondary" href="/login">
                У меня уже есть аккаунт
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
