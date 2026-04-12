import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient, clearSessionToken, getSessionToken } from './api';

export interface SessionUser {
  id: string;
  name: string;
  email?: string | null;
}

type AuthMode = 'guest' | 'protected' | 'optional';

interface UseAuthRouteOptions {
  guestRedirectTo?: string;
}

interface UseAuthRouteResult {
  user: SessionUser | null;
  isChecking: boolean;
  logout: () => Promise<void>;
}

export function getSafeLocalPath(value: unknown, fallback = '/rooms') {
  if (typeof value !== 'string') {
    return fallback;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value;
}

export function useAuthRoute(mode: AuthMode, options: UseAuthRouteOptions = {}): UseAuthRouteResult {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const guestRedirectTo = getSafeLocalPath(options.guestRedirectTo, '/rooms');
  const protectedRedirectTo = `/login?next=${encodeURIComponent(getSafeLocalPath(router.asPath, '/rooms'))}`;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = getSessionToken();

    if (!token) {
      setUser(null);
      setIsChecking(false);

      if (mode === 'protected') {
        router.replace(protectedRedirectTo);
      }

      return;
    }

    let isActive = true;

    async function resolveSession() {
      try {
        const response = await apiClient.get('/api/auth/me');

        if (!isActive) {
          return;
        }

        if (!response.data?.ok || !response.data?.user) {
          clearSessionToken();
          setUser(null);

          if (mode === 'protected') {
            router.replace(protectedRedirectTo);
          }

          return;
        }

        setUser(response.data.user);

        if (mode === 'guest') {
          router.replace(guestRedirectTo);
        }
      } catch (error: any) {
        if (!isActive) {
          return;
        }

        if (error?.response?.status === 401) {
          clearSessionToken();
        }

        setUser(null);

        if (mode === 'protected') {
          router.replace(protectedRedirectTo);
        }
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    }

    resolveSession();

    return () => {
      isActive = false;
    };
  }, [guestRedirectTo, mode, protectedRedirectTo, router]);

  async function logout() {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {}

    clearSessionToken();
    setUser(null);
    router.replace('/login');
  }

  return {
    user,
    isChecking,
    logout
  };
}
