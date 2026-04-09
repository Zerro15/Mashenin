import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

type CreateRoomSubmitState = 'idle' | 'submitting' | 'success' | 'error';

const apiClient = createApiClient();

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [submitState, setSubmitState] = useState<CreateRoomSubmitState>('idle');
  const [submitError, setSubmitError] = useState('');

  const isSubmitting = submitState === 'submitting';
  const isRedirecting = submitState === 'success';
  const isFormLocked = isChecking || isSubmitting || isRedirecting;

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
      await router.push(`/room/${response.data.room.id}`);
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
              {isRedirecting ? <p>Комната создана. Открываем...</p> : null}

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
