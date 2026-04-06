import { listPage } from "../../shared/page-helpers.js";
import { escapeHtml, statusLabel } from "../../shared/utils.js";

export function settingsHtml(user) {
  return listPage({
    title: "Настройки",
    active: "settings",
    headerTitle: "настройки",
    headerTopic: "Профиль, звук и пространство",
    heroTitle: "Настройки",
    heroText: "Управление профилем, звуком и пространством.",
    body: `
      <section class="settings-shell">
        <aside class="settings-nav">
          <div class="settings-nav-title">Разделы</div>
          <a class="settings-nav-link is-active" href="#profile-section">Профиль</a>
          <a class="settings-nav-link" href="#audio-section">Звук</a>
          <a class="settings-nav-link" href="#space-section">Пространство</a>
          <a class="settings-nav-link" href="#account-section">Аккаунт</a>
        </aside>
        <div class="settings-main">
          <section class="settings-section" id="profile-section">
            <div class="settings-section-head">
              <h2>Профиль</h2>
              <p>Основные данные аккаунта и имя в пространстве.</p>
            </div>
            ${
              user
                ? `
                  <form class="stack" method="POST" action="/profile/update">
                    <label class="stack">
                      <span class="label">Имя</span>
                      <input class="field" type="text" name="display_name" value="${escapeHtml(user.name || "")}" required />
                    </label>
                    <label class="stack">
                      <span class="label">Email</span>
                      <input class="field" type="email" value="${escapeHtml(user.email || "")}" readonly />
                    </label>
                    <label class="stack">
                      <span class="label">О себе</span>
                      <input class="field" type="text" name="about" value="${escapeHtml(user.about || "")}" placeholder="Коротко о себе" />
                    </label>
                    <div class="hero-actions">
                      <button class="button" type="submit">Сохранить</button>
                    </div>
                  </form>
                `
                : `
                  <div class="empty">Войди, чтобы открыть настройки профиля.</div>
                `
            }
          </section>
          <section class="settings-section" id="audio-section">
            <div class="settings-section-head">
              <h2>Звук</h2>
              <p>Микрофон и проверка сигнала доступны внутри голосовой комнаты.</p>
            </div>
            <div class="hero-actions">
              <a class="ghost-button" href="/room/general">Открыть голосовую комнату</a>
            </div>
          </section>
          <section class="settings-section" id="space-section">
            <div class="settings-section-head">
              <h2>Пространство</h2>
              <p>Приглашения, события и новые действия собраны в одной структуре.</p>
            </div>
            <div class="hero-actions">
              <a class="button" href="/create">Открыть создание</a>
              <a class="ghost-button" href="/invite/mashenin-2026">Открыть приглашение</a>
            </div>
          </section>
          <section class="settings-section" id="account-section">
            <div class="settings-section-head">
              <h2>Аккаунт</h2>
              <p>Текущее состояние учетной записи и присутствия.</p>
            </div>
            <div class="settings-compact-stats">
              <article class="stat-card">
                <strong>${escapeHtml(user ? user.name || "Пользователь" : "Гость")}</strong>
                <span class="label">имя</span>
              </article>
              <article class="stat-card">
                <strong>${escapeHtml(user ? statusLabel(user.status || "away") : "гость")}</strong>
                <span class="label">статус</span>
              </article>
            </div>
          </section>
        </div>
      </section>
    `
  });
}
