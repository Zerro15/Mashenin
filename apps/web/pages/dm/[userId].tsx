import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

interface DM {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  isRead: boolean;
  sentAt: string;
}

const apiClient = createApiClient();

export default function DM() {
  const router = useRouter();
  const { userId } = router.query;
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState('');
  const [peerName, setPeerName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (isChecking || !user || !userId) return;

    async function load() {
      try {
        const res = await apiClient.get(`/api/dm/${userId}`);
        if (res.data?.ok) {
          setMessages(res.data.messages || []);
          if (res.data.messages?.length > 0) {
            setPeerName(res.data.messages[0].senderName);
          }
        }
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [isChecking, user, userId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !userId) return;

    setIsSending(true);
    try {
      const res = await apiClient.post('/api/dm', { receiverId: userId, body: draft });
      if (res.data?.ok && res.data.message) {
        setMessages(prev => [...prev, res.data.message]);
        setDraft('');
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} totalUnread={0} />

      <main className="main dm-page">
        <div className="dm-header">
          <a href="/friends" className="dm-back">← Друзья</a>
          <h2>{peerName || 'Личные сообщения'}</h2>
        </div>

        {loadState === 'loading' && <p className="empty">Загрузка...</p>}

        {loadState === 'ready' && (
          <>
            <div className="dm-messages">
              {messages.length === 0 ? (
                <p className="empty">Пока нет сообщений. Начни разговор!</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`dm-bubble ${msg.senderId === user?.id ? 'dm-bubble--self' : ''}`}>
                    <div className="dm-bubble-author">{msg.senderName}</div>
                    <div className="dm-bubble-text">{msg.body}</div>
                    <div className="dm-bubble-time">
                      {new Date(msg.sentAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form className="dm-composer" onSubmit={handleSubmit}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Написать сообщение..."
                rows={2}
                disabled={isSending}
              />
              <button type="submit" className="button" disabled={!draft.trim() || isSending}>
                {isSending ? 'Отправка...' : 'Отправить'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
