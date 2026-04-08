import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient, clearSessionToken, getSessionToken } from '../../lib/api';

interface HeaderProps {
  requireAuth?: boolean;
}

interface SessionUser {
  id: string;
  name: string;
  email?: string | null;
}

export default function Header({ requireAuth = false }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(requireAuth);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = getSessionToken();

    if (!token) {
      setUser(null);
      setIsLoading(false);

      if (requireAuth) {
        router.replace('/login');
      }

      return;
    }

    let isActive = true;

    async function loadCurrentUser() {
      try {
        const response = await apiClient.get('/api/auth/me');

        if (!isActive) {
          return;
        }

        if (!response.data?.ok || !response.data?.user) {
          clearSessionToken();
          setUser(null);

          if (requireAuth) {
            router.replace('/login');
          }

          return;
        }

        setUser(response.data.user);
      } catch (error: any) {
        if (!isActive) {
          return;
        }

        if (error?.response?.status === 401) {
          clearSessionToken();
          setUser(null);

          if (requireAuth) {
            router.replace('/login');
          }
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [requireAuth, router]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiClient.post('/api/auth/logout');
    } catch {}

    clearSessionToken();
    setUser(null);
    setIsLoggingOut(false);
    router.replace('/login');
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
        {isLoading ? (
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
              disabled={isLoggingOut}
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
