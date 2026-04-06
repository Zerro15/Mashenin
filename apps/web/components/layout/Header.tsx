export default function Header() {
  return (
    <header className="header">
      <a href="/" className="logo">
        <h1>mashenin</h1>
      </a>

      <nav>
        <a href="/rooms">Комнаты</a>
        <a href="/friends">Люди</a>
        <a href="/events">События</a>
        <a href="/settings">Настройки</a>
      </nav>
    </header>
  );
}