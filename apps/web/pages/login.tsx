import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/layout/Header';
import { clearSessionToken, createApiClient, getSessionToken, setSessionToken } from '../lib/api';

const apiClient = createApiClient();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = getSessionToken();

    if (!token) {
      return;
    }

    let isActive = true;

    async function validateSession() {
      try {
        const response = await apiClient.get('/api/auth/me');

        if (!isActive) {
          return;
        }

        if (response.data?.ok && response.data?.user) {
          router.replace('/rooms');
          return;
        }

        clearSessionToken();
      } catch {
        if (isActive) {
          clearSessionToken();
        }
      }
    }

    validateSession();

    return () => {
      isActive = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/login', {
        email,
        password
      });

      if (!response.data?.ok || !response.data?.token) {
        setError('Не удалось войти.');
        return;
      }

      setSessionToken(response.data.token);
      router.push('/rooms');
    } catch (submitError: any) {
      const nextError =
        submitError?.response?.data?.error === 'invalid_email_or_password'
          ? 'Неверный email или пароль.'
          : 'Не удалось выполнить вход.';

      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container">
      <Header />

      <main className="main auth-page">
        <section className="auth-card">
          <h1>Вход</h1>
          <p>Войди в аккаунт, чтобы открыть комнату и отправлять сообщения.</p>

          <form className="stack-form" onSubmit={handleSubmit}>
            <label className="field-block">
              <span>Email</span>
              <input
                className="text-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="field-block">
              <span>Пароль</span>
              <input
                className="text-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
