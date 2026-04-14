import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

type CreateRoomSubmitState = 'idle' | 'submitting' | 'success' | 'error';
type DirectOpenState = 'idle' | 'opening' | 'error';

const apiClient = createApiClient();

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, isChecking, logout } = useAuthRoute('protected');
  const peerUserId = typeof router.query.peerUserId === 'string' ? router.query.peerUserId.trim() : '';
  const peerName = typeof router.query.peerName === 'string' ? router.query.peerName.trim() : '';
  const isDirectMode = Boolean(peerUserId);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [submitState, setSubmitState] = useState<CreateRoomSubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [directState, setDirectState] = useState<DirectOpenState>('idle');
  const [directError, setDirectError] = useState('');

  const isSubmitting = submitState === 'submitting';
  const isRedirecting = submitState === 'success';
  const isOpeningDirect = directState === 'opening';
  const isFormLocked = isChecking || isSubmitting || isRedirecting || isOpeningDirect;

  useEffect(() => {
    if (!router.isReady || !isDirectMode || isChecking || !user || directState !== 'idle') {
      return;
    }

    let isActive = true;

    async function openDirectRoom() {
      setDirectState('opening');
      setDirectError('');

      try {
        const response = await apiClient.post('/api/rooms/direct', {
          peerUserId
        });

        if (!isActive) {
          return;
        }

        if (!response.data?.ok || !response.data?.room?.id) {
          setDirectState('error');
          setDirectError('Не удалось открыть direct room.');
          return;
        }

        const nextSearch = response.data.created ? '?direct=1&created=1' : '?direct=1';
        window.location.assign(`/room/${response.data.room.id}${nextSearch}`);
      } catch (openError: any) {
        if (!isActive) {
          return;
        }

        const apiError = openError?.response?.data?.error;
        const nextError =
          apiError === 'user_not_found'
            ? 'Не удалось найти этого пользователя.'
            : apiError === 'self_direct_not_allowed'
              ? 'Нельзя открыть direct room с самим собой.'
              : apiError === 'unauthorized'
                ? 'Сессия истекла. Войди снова.'
                : 'Не удалось открыть direct room.';

        setDirectState('error');
        setDirectError(nextError);
      }
    }

    openDirectRoom();

    return () => {
      isActive = false;
    };
  }, [isChecking, isDirectMode, peerUserId, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isFormLocked) {
      return;
    }

    if (!name.trim()) {
      setSubmitState('error');
      setSubmitError('Название комнаты обязательно.');
      return;
    }

    setSubmitState('submitting');
    setSubmitError('');

    try {
      const response = await apiClient.post('/api/rooms', {
        name,
        topic
      });

      if (!response.data?.ok || !response.data?.room?.id) {
        setSubmitState('error');
        setSubmitError('Не удалось создать комнату.');
        return;
      }

      setSubmitState('success');
      await router.push(`/room/${response.data.room.id}?created=1`);
    } catch (submitError: any) {
      const nextError =
        submitError?.response?.status === 401
          ? 'Сессия истекла. Войди снова.'
          : submitError?.response?.data?.error === 'room_name_required'
            ? 'Название комнаты обязательно.'
            : 'Не удалось создать комнату.';

      setSubmitState('error');
      setSubmitError(nextError);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} />

      <main className="main auth-page">
        {isChecking ? (
          <p className="empty">Проверка сессии...</p>
        ) : isDirectMode ? (
          <section className="status-card create-room-card">
            <h1>Открываю direct room</h1>
            <p>
              {peerName
                ? `Проверяю, есть ли уже разговор с ${peerName}, и открываю ту же комнату без дублей.`
                : 'Проверяю, есть ли уже direct room, и открываю её без дублей.'}
            </p>

            {directState === 'error' ? (
              <>
                <p className="form-error">{directError}</p>
                <div className="form-actions">
                  <a className="button button-secondary" href="/rooms">
                    К комнатам
                  </a>
                </div>
              </>
            ) : (
              <p>{peerName ? `Сейчас открою общий разговор с ${peerName}.` : 'Сейчас открою общий разговор.'}</p>
            )}
          </section>
        ) : (
          <section className="auth-card create-room-card">
            <div className="create-room-intro">
              <span className="create-room-kicker">Первый старт</span>
              <h1>Создай первую комнату для первого разговора</h1>
              <p>Здесь не нужно ничего настраивать заранее. Достаточно одного названия, чтобы открыть комнату и сразу перейти к следующему шагу.</p>
            </div>

            <div className="create-room-next">
              <h2>Что будет дальше</h2>
              <div className="create-room-next-steps" aria-label="Следующие шаги">
                <div className="create-room-next-step">
                  <strong>1. Комната откроется сразу после создания</strong>
                  <span>Ты попадешь внутрь без дополнительных экранов.</span>
                </div>
                <div className="create-room-next-step">
                  <strong>2. Оттуда можно пригласить первого человека ссылкой</strong>
                  <span>Invite link уже создается прямо в комнате, когда разговор еще пустой.</span>
                </div>
              </div>
            </div>

            <form className="stack-form" onSubmit={handleSubmit}>
              <label className="field-block field-block-primary">
                <span>Название комнаты</span>
                <input
                  className="text-input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например, Команда"
                  maxLength={64}
                  disabled={isFormLocked}
                  required
                />
                <small className="field-hint field-hint-strong">Это главное поле. Одного названия уже достаточно, чтобы создать первую комнату.</small>
              </label>

              <label className="field-block field-block-secondary">
                <span>Тема <span className="field-optional">необязательно</span></span>
                <textarea
                  className="text-area"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Если хочешь, коротко опиши, для чего нужна эта комната"
                  rows={3}
                  maxLength={160}
                  disabled={isFormLocked}
                />
                <small className="field-hint">Можно пропустить и добавить позже, если это вообще понадобится.</small>
              </label>

              {submitState === 'error' && submitError ? <p className="form-error">{submitError}</p> : null}
              {isRedirecting ? <p>Комната создана. Открываем разговор...</p> : null}

              <div className="form-actions">
                <a
                  className="button button-secondary"
                  href="/rooms"
                  aria-disabled={isFormLocked}
                  onClick={(event) => {
                    if (isFormLocked) {
                      event.preventDefault();
                    }
                  }}
                >
                  Назад
                </a>
                <button className="button" type="submit" disabled={isFormLocked}>
                  {isSubmitting ? 'Создание...' : isRedirecting ? 'Открываем...' : 'Создать комнату'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
