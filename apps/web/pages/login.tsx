import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/layout/Header';
import { createApiClient, setSessionToken } from '../lib/api';
import { useAuthRoute } from '../lib/session';

const apiClient = createApiClient();

export default function LoginPage() {
  const router = useRouter();
  const { user, isChecking } = useAuthRoute('guest');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <Header user={user} isCheckingSession={isChecking} />

      <main className="main auth-page">
        <section className="auth-card">
          <h1>Вход</h1>
          <p>
            {isChecking
              ? 'Проверяю активную сессию...'
              : 'Войди в аккаунт, чтобы открыть комнату и отправлять сообщения.'}
          </p>

          {isChecking ? (
            <p className="empty">Проверка сессии...</p>
          ) : (
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

              <button className="button" type="submit" disabled={isSubmitting || isChecking}>
                {isSubmitting ? 'Вход...' : 'Войти'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
