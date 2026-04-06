import { listPage } from "../../shared/page-helpers.js";

export function createHtml() {
  return listPage({
    title: "Создание",
    active: "home",
    headerTitle: "создание",
    headerTopic: "Новые действия",
    heroTitle: "Создать",
    heroText: "Новые действия для пространства.",
    body: `
      <section class="card-grid two">
        <article class="panel-card">
          <div class="panel-header">
            <h2>Пригласить участника</h2>
          </div>
          <p class="section-note">Добавление нового участника.</p>
          <div class="hero-actions">
            <a class="button" href="/invite/mashenin-2026">Открыть приглашение</a>
          </div>
        </article>
        <article class="panel-card">
          <div class="panel-header">
            <h2>Создать событие</h2>
          </div>
          <p class="section-note">Новый созвон или встреча.</p>
          <div class="hero-actions">
            <a class="button" href="/events">Открыть события</a>
          </div>
        </article>
      </section>
      <section class="card-grid two">
        <article class="panel-card">
          <div class="panel-header">
            <h2>Новая комната</h2>
          </div>
          <p class="section-note">Подготовка отдельной комнаты под новый сценарий.</p>
          <div class="hero-actions">
            <a class="ghost-button" href="/rooms">Открыть комнаты</a>
          </div>
        </article>
        <article class="panel-card">
          <div class="panel-header">
            <h2>Настройки пространства</h2>
          </div>
          <p class="section-note">Профиль, звук и логика входа.</p>
          <div class="hero-actions">
            <a class="ghost-button" href="/settings">Открыть настройки</a>
          </div>
        </article>
      </section>
    `
  });
}
