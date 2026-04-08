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
          <p>Открой нужную комнату, прочитай историю и продолжи разговор без лишних разделов и перегруженной навигации.</p>

          {isChecking ? (
            <p className="empty">Проверка сессии...</p>
          ) : (
            <div className="status-actions">
              <a className="button" href="/login">
                Войти
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
