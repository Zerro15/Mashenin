import { listPage } from "../../shared/page-helpers.js";

export function adminHtml() {
  return listPage({
    title: "Панель",
    active: "admin",
    headerTitle: "панель",
    headerTopic: "Служебные параметры сервера",
    heroTitle: "Служебная панель",
    heroText: "Короткая техпанель для проверки брендинга, инвайта и UI-паттернов после переезда на mashenin.",
    body: `
      <section class="card-grid admin">
        <article class="admin-card">
          <div class="card-title">Проект</div>
          <div class="meta">Название обновлено на <code>mashenin</code>.</div>
        </article>
        <article class="admin-card">
          <div class="card-title">Инвайт</div>
          <div class="meta">Основной код доступа: <code>mashenin-2026</code>.</div>
        </article>
        <article class="admin-card">
          <div class="card-title">Cookie</div>
          <div class="meta">Сессия хранится под именем <code>mashenin_session</code>.</div>
        </article>
        <article class="admin-card">
          <div class="card-title">Интерфейс</div>
          <div class="meta">Левая навигация, список каналов, центральная лента и список участников собраны в единую структуру.</div>
        </article>
      </section>
    `
  });
}
