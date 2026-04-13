import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import { createApiClient } from '../../lib/api';
import { useAuthRoute } from '../../lib/session';

interface Team {
  id: string;
  slug: string;
  name: string;
  topic: string;
  members: number;
  membersList?: Array<{ id: string; name: string; presence: string; role: string }>;
}

interface Message {
  id: string;
  roomId?: string;
  author?: string;
  sentAt: string;
  text: string;
}

const apiClient = createApiClient();

export default function TeamPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [team, setTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (isChecking || !user || !slug) return;

    async function load() {
      try {
        const [teamRes, msgsRes] = await Promise.all([
          apiClient.get(`/api/teams/${slug}`),
          apiClient.get(`/api/rooms/${slug}/messages`)
        ]);

        if (teamRes.data?.ok) {
          setTeam(teamRes.data.team);
        }
        if (msgsRes.data?.ok) {
          setMessages(msgsRes.data.messages || []);
        }
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [isChecking, user, slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !slug) return;

    setIsSending(true);
    try {
      const res = await apiClient.post(`/api/rooms/${slug}/messages`, { body: draft });
      if (res.data?.ok && res.data.message) {
        setMessages(prev => [...prev, {
          id: res.data.message.id,
          author: res.data.message.author || user?.name,
          sentAt: res.data.message.sentAt,
          text: res.data.message.text
        }]);
        setDraft('');
      }
    } finally {
      setIsSending(false);
    }
  }

  if (!team || loadState === 'loading') {
    return (
      <div className="container">
        <Header user={user} isCheckingSession={isChecking} onLogout={logout} totalUnread={0} />
        <main className="main"><p className="empty">Загрузка...</p></main>
      </div>
    );
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} totalUnread={0} />

      <main className="main team-page">
        <div className="team-header">
          <a href="/teams" className="team-back">← Команды</a>
          <h1>{team.name}</h1>
          {team.topic && <p className="team-topic">{team.topic}</p>}
          <span className="team-members-count">{team.members} участник{team.members !== 1 ? 'ов' : ''}</span>
        </div>

        {team.membersList && team.membersList.length > 0 && (
          <section className="team-participants">
            <h3>Участники</h3>
            <div className="team-members-grid">
              {team.membersList.map(m => (
                <div key={m.id} className="team-member">
                  <span className="member-name">{m.name}</span>
                  <span className={`member-role member-role--${m.role}`}>{m.role}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="team-messages">
          <h3>Сообщения</h3>
          {messages.length === 0 ? (
            <p className="empty">Пока нет сообщений. Начни разговор!</p>
          ) : (
            <div className="messages-list">
              {messages.map(msg => (
                <div key={msg.id} className="message-bubble">
                  <div className="message-header">
                    <strong>{msg.author}</strong>
                    <span className="message-time">
                      {new Date(msg.sentAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <p className="message-text">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <form className="message-composer" onSubmit={handleSubmit}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`Написать сообщение в ${team.name}...`}
            rows={2}
            disabled={isSending}
          />
          <button type="submit" className="button" disabled={!draft.trim() || isSending}>
            {isSending ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </main>
    </div>
  );
}
