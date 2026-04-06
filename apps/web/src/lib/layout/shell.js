import { getBaseStyles } from "../styles.js";
import { escapeHtml } from "../shared/utils.js";
import { avatar, channelLink, createItem, memberRow, navItem } from "../shared/ui.js";

function serverNav(active) {
  return `
    <div class="server-home">M</div>
    <div class="server-divider"></div>
    <nav class="server-list">
      ${navItem("/", "Дом", active === "home")}
      ${createItem("/create")}
    </nav>
  `;
}

function channelSidebar(activeNav, activeRoomId) {
  const textChannels = [
    { href: "/room/general", icon: "#", title: "общий", meta: "общее общение", id: "general" },
    { href: "/room/games", icon: "#", title: "игры", meta: "катки и сборы", id: "games" },
    { href: "/room/chill", icon: "#", title: "чилл", meta: "спокойный поток", id: "chill" }
  ];
  const voiceChannels = [
    { href: "/room/general", icon: "◉", title: "Общая", meta: "главный голосовой", id: "general" },
    { href: "/room/games", icon: "◉", title: "Игры", meta: "пати и кооп", id: "games" },
    { href: "/room/movie-night", icon: "◉", title: "Киноночь", meta: "временная сессия", id: "movie-night" }
  ];

  return `
    <div class="promo-card">
      <strong>mashenin</strong>
      <p>Комнаты, голос и текст.</p>
    </div>
    <section class="category">
      <div class="category-title"><span>Разделы</span><span></span></div>
      ${channelLink({ href: "/", icon: "•", title: "обзор", meta: "главный экран", active: activeNav === "home" })}
      ${channelLink({ href: "/rooms", icon: "•", title: "комнаты", meta: "все комнаты", active: activeNav === "rooms" })}
      ${channelLink({ href: "/friends", icon: "•", title: "люди", meta: "участники", active: activeNav === "friends" })}
      ${channelLink({ href: "/events", icon: "•", title: "события", meta: "календарь", active: activeNav === "events" })}
    </section>
    <section class="category">
      <div class="category-title"><span>Текстовые каналы</span><span>+</span></div>
      ${textChannels.map((item) => channelLink({ ...item, active: item.id === activeRoomId })).join("")}
    </section>
    <section class="category">
      <div class="category-title"><span>Голосовые каналы</span><span>+</span></div>
      ${voiceChannels.map((item) => channelLink({ ...item, active: item.id === activeRoomId })).join("")}
    </section>
    <section class="category">
      <div class="category-title"><span>Действия</span><span></span></div>
      ${channelLink({ href: "/invite/mashenin-2026", icon: "+", title: "пригласить", meta: "добавить участника" })}
      ${channelLink({ href: "/settings", icon: "•", title: "настройки", meta: "профиль и звук", active: activeNav === "settings" })}
    </section>
  `;
}

function userPanel() {
  return `
    <div class="user-panel">
      <button class="user-card user-trigger" id="sidebar-user-trigger" type="button" aria-expanded="false">
        <span class="user-trigger-main" id="sidebar-user">
          ${avatar("M")}
          <span class="user-copy">
            <strong>Гость</strong>
            <span>ожидает инвайт</span>
          </span>
        </span>
        <span class="user-chevron">⌃</span>
      </button>
      <div class="profile-drawer" id="profile-drawer">
        <div class="profile-drawer-banner"></div>
        <div class="profile-drawer-body">
          <div class="profile-drawer-header">
            <div id="profile-drawer-avatar">${avatar("M")}</div>
            <div class="profile-drawer-copy">
              <strong id="profile-drawer-name">Гость</strong>
              <span id="profile-drawer-status">ожидает инвайт</span>
            </div>
          </div>
          <div class="profile-meta-grid">
            <div class="profile-meta-card">
              <strong>Статус</strong>
              <span id="profile-drawer-meta-status">ожидает вход</span>
            </div>
            <div class="profile-meta-card">
              <strong>Email</strong>
              <span id="profile-drawer-meta-email">пока нет</span>
            </div>
          </div>
          <div class="profile-drawer-about" id="profile-drawer-about">Войди или зарегистрируйся, чтобы настроить свой профиль и быстро возвращаться в разговор.</div>
          <div class="profile-drawer-actions">
            <a class="profile-link" href="/settings"><span>Настройки</span><span>›</span></a>
            <a class="profile-link" href="/room/general"><span>Открыть общую комнату</span><span>›</span></a>
            <a class="profile-link" href="/logout"><span>Выйти</span><span>›</span></a>
          </div>
        </div>
      </div>
      <div class="user-actions">
        <a class="user-action-link" href="/settings">Настройки</a>
        <a class="user-action-link" href="/logout">Выход</a>
      </div>
    </div>
  `;
}

function rightAside() {
  return `
    <div class="members-title">Участники</div>
    <div class="members-scroll">
      <section class="category">
        <div class="category-title"><span>Ты</span><span></span></div>
        <div id="me-card">
          ${memberRow("Гость", "не авторизован", "away")}
        </div>
      </section>
      <section class="category">
        <div class="category-title"><span>Онлайн сейчас</span><span id="online-count">0</span></div>
        <div id="live-members">
          <div class="empty">Загружаю участников...</div>
        </div>
      </section>
      <section class="category">
        <div class="category-title"><span>Сегодня</span><span></span></div>
        <div id="today-events">
          <div class="empty">Проверяю события...</div>
        </div>
      </section>
    </div>
  `;
}

export function shell({
  title,
  activeNav,
  activeRoomId = "",
  headerTitle,
  headerTopic,
  content,
  aside = rightAside(),
  script = "",
  scriptType = "text/javascript"
}) {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${getBaseStyles()}</style>
  </head>
  <body>
    <div class="app-shell">
      <aside class="server-rail">
        ${serverNav(activeNav)}
      </aside>
      <aside class="channels-panel">
        <div class="guild-header">
          <span>mashenin</span>
          <span class="guild-caret">▼</span>
        </div>
        <div class="channels-scroll">
          ${channelSidebar(activeNav, activeRoomId)}
        </div>
        ${userPanel()}
      </aside>
      <main class="main-panel">
        <div class="channel-header">
          <div class="channel-meta">
            <div class="channel-name">
              <span class="channel-icon">#</span>
              <span>${escapeHtml(headerTitle)}</span>
            </div>
            <div class="header-topic">${escapeHtml(headerTopic)}</div>
          </div>
          <div class="channel-tools">участники</div>
        </div>
        <div class="channel-body">
          ${content}
        </div>
      </main>
      <aside class="members-panel">
        ${aside}
      </aside>
    </div>
    <script type="${escapeHtml(scriptType)}">${script}</script>
  </body>
</html>`;
}
