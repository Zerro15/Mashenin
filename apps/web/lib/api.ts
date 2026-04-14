import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SESSION_KEY = 'mashenin_session';

export function getSessionToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  return localStorage.getItem(SESSION_KEY) || '';
}

export function setSessionToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(SESSION_KEY, token);
  document.cookie = `${SESSION_KEY}=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}

export function clearSessionToken() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${SESSION_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function createAuthHeaders(headersInit: HeadersInit | undefined, sessionToken: string) {
  const headers = new Headers(headersInit);

  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
    // Temporary fallback during auth contract alignment.
    headers.set('x-session-token', sessionToken);
  }

  return headers;
}

export function createApiClient(baseURL?: string) {
  const instance = axios.create({
    baseURL: baseURL || API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add request interceptor for session token
  instance.interceptors.request.use(
    (config) => {
      if (typeof window !== 'undefined') {
        const token = getSessionToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return {
    get: (url: string, params?: any) => instance.get(url, { params }),
    post: (url: string, data?: any) => instance.post(url, data),
    put: (url: string, data?: any) => instance.put(url, data),
    delete: (url: string) => instance.delete(url),
    apiFetch: (path: string, options: RequestInit = {}, sessionToken?: string) => {
      const token = sessionToken || getSessionToken();

      return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: createAuthHeaders(options.headers, token),
      });
    },
  };
}

export const apiClient = createApiClient();
