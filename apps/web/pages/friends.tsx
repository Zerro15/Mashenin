import { GetServerSideProps } from 'next';
import { createApiClient } from '../lib/api';

interface Friend {
  id: string;
  name: string;
  status: string;
  note: string;
  roomId?: string;
  email?: string;
  about: string;
}

interface FriendsPageProps {
  friends: Friend[];
}

export default function Friends({ friends }: FriendsPageProps) {
  return (
    <div className="container">
      <header className="header">
        <h1>Люди</h1>
      </header>

      <main className="main">
        <section className="friend-list">
          {friends.length === 0 ? (
            <p className="empty">Пока нет участников. Пригласите друзей!</p>
          ) : (
            <div className="grid">
              {friends.map((friend) => (
                <div key={friend.id} className="friend-card">
                  <h3>{friend.name}</h3>
                  <p className="status">{friend.status}</p>
                  {friend.note && <p className="note">{friend.note}</p>}
                  {friend.about && <p className="about">{friend.about}</p>}
                  {friend.roomId && (
                    <div className="room-info">
                      <span>в комнате {friend.roomId}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const apiClient = createApiClient('http://api:4000');
    const response = await apiClient.get('/friends');

    return {
      props: {
        friends: response.data?.ok ? response.data.friends : []
      }
    };
  } catch (error) {
    console.error('Failed to fetch friends:', error);
    return {
      props: {
        friends: []
      }
    };
  }
};