import { useState } from 'react';
import type { SessionUser } from '../../lib/session';

interface HeaderProps {
  user?: SessionUser | null;
  isCheckingSession?: boolean;
  onLogout?: () => Promise<void>;
}

export default function Header({
  user = null,
  isCheckingSession = false,
  onLogout
}: HeaderProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (!onLogout) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="header">
      <a href="/" className="logo">
        <h1>mashenin</h1>
      </a>

      <nav className="header-nav">
        <a href="/rooms">Комнаты</a>
        <a href="/friends">Люди</a>
        <a href="/events">События</a>
        <a href="/settings">Настройки</a>
      </nav>

      <div className="header-session">
        {isCheckingSession ? (
          <span className="session-muted">Проверка сессии...</span>
        ) : user ? (
          <>
            <div className="session-user">
              <strong>{user.name}</strong>
              <span>{user.email || 'активная сессия'}</span>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut || !onLogout}
            >
              {isLoggingOut ? 'Выход...' : 'Выйти'}
            </button>
          </>
        ) : (
          <a href="/login" className="button button-secondary">
            Войти
          </a>
        )}
      </div>
    </header>
  );
}
