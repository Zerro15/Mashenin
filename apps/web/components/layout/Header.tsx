import Link from 'next/link';

export default function Header() {
  return (
    <header className="header">
      <Link href="/" className="logo">
        <h1>mashenin</h1>
      </Link>

      <nav>
        <Link href="/rooms">Комнаты</Link>
        <Link href="/friends">Люди</Link>
        <Link href="/events">События</Link>
        <Link href="/settings">Настройки</Link>
      </nav>
    </header>
  );
}