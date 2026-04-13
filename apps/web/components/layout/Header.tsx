import { useState } from 'react';
import type { SessionUser } from '../../lib/session';

interface HeaderProps {
  user?: SessionUser | null;
  isCheckingSession?: boolean;
  onLogout?: () => Promise<void>;
  totalUnread?: number;
}

export default function Header({
  user = null,
  isCheckingSession = false,
  onLogout,
  totalUnread = 0
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

      {user ? (
        <nav className="header-nav" aria-label="Основная навигация">
          <a href="/rooms" className="header-nav-link">
            Комнаты
            {totalUnread > 0 && (
              <span className="nav-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </a>
          <a href="/settings" className="header-nav-link header-nav-link--settings" aria-label="Настройки">
            ⚙
          </a>
        </nav>
      ) : (
        <div />
      )}

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
