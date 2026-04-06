import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
        const token = localStorage.getItem('mashenin_session');
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
      return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...options.headers,
          'x-session-token': sessionToken || '',
        },
      });
    },
  };
}

export const apiClient = createApiClient();