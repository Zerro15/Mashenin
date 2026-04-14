import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { getSafeLocalPath, useAuthRoute } from '../../lib/session';

interface InvitePreview {
  code: string;
  roomId: string;
  roomName: string;
  roomTopic: string;
  createdBy: {
    id: string;
    name: string;
  } | null;
}

type InviteLoadState = 'loading' | 'ready' | 'not_found' | 'room_not_found' | 'error';
type AcceptState = 'idle' | 'submitting' | 'done' | 'error';

const apiClient = createApiClient();

export default function InvitePage() {
  const router = useRouter();
  const code = typeof router.query.code === 'string' ? router.query.code : '';
  const { user, isChecking, logout } = useAuthRoute('optional');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadState, setLoadState] = useState<InviteLoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [acceptState, setAcceptState] = useState<AcceptState>('idle');
  const [acceptError, setAcceptError] = useState('');

  const nextPath = useMemo(() => getSafeLocalPath(code ? `/invite/${code}` : undefined, '/rooms'), [code]);

  useEffect(() => {
    if (!code) {
      return;
    }

    let isActive = true;

    async function loadInvite() {
      setLoadState('loading');
      setLoadError('');
      setInvite(null);

      try {
        const response = await apiClient.get(`/api/invites/${code}`);

        if (!isActive) {
          return;
        }

        if (!response.data?.ok || !response.data?.invite) {
          setLoadState('error');
          setLoadError('Не удалось загрузить приглашение.');
          return;
        }

        setInvite(response.data.invite);
        setLoadState('ready');
      } catch (error: any) {
        if (!isActive) {
          return;
        }

        const apiError = error?.response?.data?.error;

        if (apiError === 'invite_not_found') {
          setLoadState('not_found');
          setLoadError('Это приглашение уже недоступно или не существует.');
          return;
        }

        if (apiError === 'room_not_found') {
          setLoadState('room_not_found');
          setLoadError('Комната для этого приглашения больше недоступна.');
          return;
        }

        setLoadState('error');
        setLoadError('Не удалось загрузить приглашение.');
      }
    }

    loadInvite();

    return () => {
      isActive = false;
    };
  }, [code]);

  useEffect(() => {
    if (!invite || !user || isChecking || acceptState !== 'idle') {
      return;
    }

    let isActive = true;

    async function acceptInvite() {
      setAcceptState('submitting');
      setAcceptError('');

      try {
        const response = await apiClient.post(`/api/invites/${invite.code}/accept`);

        if (!isActive) {
          return;
        }

        if (!response.data?.ok || !response.data?.room?.id) {
          setAcceptState('error');
          setAcceptError('Не удалось принять приглашение.');
          return;
        }

        setAcceptState('done');
        router.replace(`/room/${response.data.room.id}?joined=1`);
      } catch (error: any) {
        if (!isActive) {
          return;
        }

        const apiError = error?.response?.data?.error;

        if (apiError === 'invite_not_found') {
          setAcceptState('error');
          setAcceptError('Это приглашение уже недоступно.');
          return;
        }

        if (apiError === 'room_not_found') {
          setAcceptState('error');
          setAcceptError('Комната для этого приглашения больше недоступна.');
          return;
        }

        if (apiError === 'unauthorized') {
          setAcceptState('idle');
          return;
        }

        setAcceptState('error');
        setAcceptError('Не удалось принять приглашение.');
      }
    }

    acceptInvite();

    return () => {
      isActive = false;
    };
  }, [invite, isChecking, router, user]);

  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;
  const registerPath = `/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main auth-page">
        {loadState === 'loading' || !code ? (
          <section className="status-card invite-card">
            <h1>Проверяю приглашение...</h1>
            <p>Сейчас посмотрим, в какой разговор оно ведет.</p>
          </section>
        ) : loadState === 'not_found' ? (
          <section className="status-card invite-card">
            <h1>Приглашение недоступно</h1>
            <p>{loadError}</p>
            <div className="status-actions invite-actions">
              <a className="button button-secondary" href="/">
                На главную
              </a>
            </div>
          </section>
        ) : loadState === 'room_not_found' ? (
          <section className="status-card invite-card">
            <h1>Комната недоступна</h1>
            <p>{loadError}</p>
            <div className="status-actions invite-actions">
              <a className="button button-secondary" href="/">
                На главную
              </a>
            </div>
          </section>
        ) : loadState === 'error' || !invite ? (
          <section className="status-card invite-card">
            <h1>Не удалось открыть приглашение</h1>
            <p>{loadError || 'Попробуй открыть ссылку еще раз немного позже.'}</p>
            <div className="status-actions invite-actions">
              <a className="button button-secondary" href="/">
                На главную
              </a>
            </div>
          </section>
        ) : (
          <section className="status-card invite-card">
            <h1>Приглашение в комнату</h1>
            <p>
              {invite.createdBy?.name
                ? `${invite.createdBy.name} приглашает тебя в разговор в Mashenin.`
                : 'Тебя приглашают в разговор в Mashenin.'}
            </p>

            <div className="invite-preview">
              <div className="invite-preview-meta">
                <div>
                  Комната: <strong>{invite.roomName}</strong>
                </div>
                <div>
                  Тема: <strong>{invite.roomTopic || 'без отдельной темы'}</strong>
                </div>
              </div>
            </div>

            {isChecking ? (
              <p className="invite-note">Проверяю активную сессию...</p>
            ) : !user ? (
              <>
                <p className="invite-note">
                  Войди или создай аккаунт, чтобы принять приглашение и сразу попасть в комнату.
                </p>
                <div className="status-actions invite-actions">
                  <a className="button" href={loginPath}>
                    Войти
                  </a>
                  <a className="button button-secondary" href={registerPath}>
                    Создать аккаунт
                  </a>
                </div>
              </>
            ) : acceptState === 'submitting' ? (
              <p className="invite-note">Добавляю тебя в комнату и открываю разговор...</p>
            ) : acceptState === 'error' ? (
              <>
                <p className="form-error">{acceptError}</p>
                <div className="status-actions invite-actions">
                  <a className="button button-secondary" href="/rooms">
                    Перейти к комнатам
                  </a>
                </div>
              </>
            ) : (
              <p className="invite-note">Открываю комнату...</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
