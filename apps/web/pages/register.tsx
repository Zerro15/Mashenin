import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/layout/Header';
import { createApiClient, setSessionToken } from '../lib/api';
import { getSafeLocalPath, useAuthRoute } from '../lib/session';

const apiClient = createApiClient();

export default function RegisterPage() {
  const router = useRouter();
  const nextPath = getSafeLocalPath(
    typeof router.query.next === 'string' ? router.query.next : undefined,
    '/rooms'
  );
  const isInviteAuth = nextPath.startsWith('/invite/');
  const { user, isChecking } = useAuthRoute('guest', { guestRedirectTo: nextPath });
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/register', {
        displayName,
        email,
        password
      });

      if (!response.data?.ok || !response.data?.token) {
        setError('Не удалось создать аккаунт.');
        return;
      }

      setSessionToken(response.data.token);
      router.push(nextPath);
    } catch (submitError: any) {
      const apiError = submitError?.response?.data?.error;
      const nextError =
        apiError === 'password_too_short'
          ? 'Пароль должен быть не короче 6 символов.'
          : apiError === 'email_password_and_display_name_required'
            ? 'Заполни имя, email и пароль.'
            : apiError === 'invalid_email_or_display_name'
              ? 'Проверь имя и email.'
              : apiError === 'registration_failed_maybe_email_exists'
                ? 'Аккаунт с таким email уже существует.'
                : 'Не удалось создать аккаунт.';

      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} />

      <main className="main auth-page">
        <section className={`auth-card${isInviteAuth ? ' auth-card-invite' : ''}`}>
          <h1>Создать аккаунт</h1>
          <p>
            {isChecking
              ? 'Проверяю активную сессию...'
              : isInviteAuth
                ? 'Ты создаешь аккаунт по приглашению. После этого сразу вернешься в нужный разговор.'
                : 'Создай аккаунт и сразу перейди в комнаты, чтобы начать общение.'}
          </p>

          {isChecking ? (
            <p className="empty">Проверка сессии...</p>
          ) : (
            <>
              {isInviteAuth ? (
                <div className="auth-context-note">
                  <strong>Регистрация по приглашению</strong>
                  <span>Создай аккаунт, и Mashenin сразу вернет тебя к приглашению, чтобы открыть именно эту комнату.</span>
                </div>
              ) : null}

              <form className="stack-form" onSubmit={handleSubmit}>
                <label className="field-block">
                  <span>Как тебя назвать</span>
                  <input
                    className="text-input"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                  />
                </label>

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
                    minLength={6}
                    required
                  />
                </label>

                {error ? <p className="form-error">{error}</p> : null}

                <button className="button" type="submit" disabled={isSubmitting || isChecking}>
                  {isSubmitting ? 'Создаю аккаунт...' : isInviteAuth ? 'Создать аккаунт и вернуться к приглашению' : 'Создать аккаунт'}
                </button>
              </form>

              <p className="auth-switch">
                Уже есть аккаунт?{' '}
                <a href={`/login?next=${encodeURIComponent(nextPath)}`}>
                  {isInviteAuth ? 'Войди и вернись к приглашению' : 'Войди'}
                </a>
                .
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
