import { dashboardScript } from "../client/dashboard.js";
import { shell } from "../layout/shell.js";

export function homeHtml() {
  return shell({
    title: "mashenin",
    activeNav: "home",
    activeRoomId: "home",
    headerTitle: "обзор",
    headerTopic: "Главный дашборд сообщества",
    script: dashboardScript(),
    content: `
      <section class="hero-grid">
        <section class="hero-strip">
          <div class="eyebrow">Обзор</div>
          <h1 id="hero-greeting">Пространство для голоса и рабочих диалогов</h1>
          <p id="hero-subline">Войди, открой нужную комнату и подключись к разговору.</p>
          <div class="hero-actions">
            <a class="button" href="/register">Создать профиль</a>
            <a class="ghost-button" href="/login">Войти</a>
            <a class="ghost-button" href="/room/general">Открыть общую комнату</a>
          </div>
        </section>
        <aside class="focus-card">
          <div>
            <strong>Последовательность</strong>
            <p class="section-note">Вход, выбор комнаты, подключение.</p>
          </div>
          <div class="check-list">
            <div class="check-item"><span class="check-mark">1</span><span>Войди или зарегистрируйся.</span></div>
            <div class="check-item"><span class="check-mark">2</span><span>Открой нужную комнату.</span></div>
            <div class="check-item"><span class="check-mark">3</span><span>Выбери микрофон и нажми «Подключиться».</span></div>
          </div>
        </aside>
      </section>
      <section class="stats-grid" id="stats">
        <article class="stat-card"><strong>...</strong><span class="label">загрузка</span></article>
        <article class="stat-card"><strong>...</strong><span class="label">в сети</span></article>
        <article class="stat-card"><strong>...</strong><span class="label">в голосе</span></article>
        <article class="stat-card"><strong>...</strong><span class="label">комнат</span></article>
      </section>
      <section class="spotlight-grid" id="spotlight">
        <article class="spotlight-card">
          <div class="eyebrow">Сейчас</div>
          <h2>Собираю лучший следующий шаг</h2>
          <p>Проверяю, где уже есть люди, какая комната ожила и что запланировано дальше.</p>
        </article>
        <article class="spotlight-card">
          <div class="eyebrow">Контекст</div>
          <h2>Подтягиваю комнаты, людей и события</h2>
          <p>Как только данные загрузятся, здесь появятся быстрые входы без лишнего поиска.</p>
        </article>
      </section>
      <section class="card-grid two">
        <article class="panel-card">
          <div class="panel-header">
            <h2>Комнаты</h2>
          </div>
          <div class="room-list" id="rooms">
            <div class="empty">Собираю список комнат...</div>
          </div>
        </article>
        <article class="panel-card">
          <div class="panel-header">
            <h2>Участники</h2>
          </div>
          <div class="friend-list" id="friends">
            <div class="empty">Проверяю присутствие...</div>
          </div>
        </article>
      </section>
      <article class="panel-card">
        <div class="panel-header">
          <h2>События</h2>
        </div>
        <div class="event-list" id="events">
          <div class="empty">Загружаю события...</div>
        </div>
      </article>
    `
  });
}
