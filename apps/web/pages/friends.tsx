import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { createApiClient } from '../lib/api';
import { useAuthRoute } from '../lib/session';

interface Friend {
  id: string;
  name: string;
  presence: string;
  statusNote?: string;
  unreadCount: number;
}

interface FriendRequest {
  id: string;
  name: string;
  presence: string;
  requestedAt: string;
}

const apiClient = createApiClient();

export default function Friends() {
  const { user, isChecking, logout } = useAuthRoute('protected');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (isChecking || !user) return;

    async function load() {
      try {
        const res = await apiClient.get('/api/friends');
        if (res.data?.ok) {
          setFriends(res.data.friends || []);
          setRequests(res.data.requests || []);
        }
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }

    load();
  }, [isChecking, user]);

  async function acceptRequest(friendId: string) {
    await apiClient.post('/api/friends/accept', { friendId });
    const res = await apiClient.get('/api/friends');
    if (res.data?.ok) {
      setFriends(res.data.friends || []);
      setRequests(res.data.requests || []);
    }
  }

  async function removeFriend(friendId: string) {
    await apiClient.delete(`/api/friends/${friendId}`);
    const res = await apiClient.get('/api/friends');
    if (res.data?.ok) {
      setFriends(res.data.friends || []);
      setRequests(res.data.requests || []);
    }
  }

  return (
    <div className="container">
      <Header user={user} isCheckingSession={isChecking} onLogout={logout} totalUnread={0} />

      <main className="main">
        <h1>Друзья</h1>

        {loadState === 'loading' && <p className="empty">Загрузка...</p>}

        {loadState === 'ready' && (
          <>
            {/* Friend requests */}
            {requests.length > 0 && (
              <section className="friends-section">
                <h2>Запросы в друзья</h2>
                {requests.map(req => (
                  <div key={req.id} className="friend-card">
                    <div className="friend-info">
                      <strong>{req.name}</strong>
                      <span className="friend-presence">{req.presence}</span>
                    </div>
                    <button className="button button-sm" onClick={() => acceptRequest(req.id)}>
                      Принять
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* Friends list */}
            <section className="friends-section">
              <h2>Друзья ({friends.length})</h2>
              {friends.length === 0 ? (
                <p className="empty">У тебя пока нет друзей. Найди кого-нибудь и добавь в друзья!</p>
              ) : (
                friends.map(friend => (
                  <div key={friend.id} className="friend-card">
                    <div className="friend-info">
                      <strong>{friend.name}</strong>
                      <span className={`friend-presence friend-presence--${friend.presence}`}>
                        {friend.presence === 'online' ? 'онлайн' : friend.presence}
                      </span>
                      {friend.unreadCount > 0 && (
                        <span className="unread-badge">{friend.unreadCount}</span>
                      )}
                    </div>
                    <div className="friend-actions">
                      <a className="button button-sm" href={`/dm/${friend.id}`}>
                        Написать
                      </a>
                      <button className="button button-sm button-danger" onClick={() => removeFriend(friend.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
