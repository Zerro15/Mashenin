import { listPage } from "../../shared/page-helpers.js";

export function eventsHtml() {
  return listPage({
    title: "События",
    active: "events",
    headerTitle: "события",
    headerTopic: "Планирование созвонов и сборов",
    heroTitle: "События и сборы",
    heroText: "Планируй созвоны и сборы прямо внутри сервера.",
    body: `
      <section class="card-grid two">
        <article class="panel-card">
          <div class="panel-header">
            <h2>Ближайшие события</h2>
          </div>
          <div class="event-list" id="events">
            <div class="empty">Загружаю календарь...</div>
          </div>
        </article>
        <article class="panel-card">
          <div class="panel-header">
            <h2>Создать событие</h2>
          </div>
          <form class="stack" method="POST" action="/events/create">
            <label class="stack">
              <span class="label">Название</span>
              <input class="field" type="text" name="title" placeholder="Например, вечерний созвон" required />
            </label>
            <div class="split">
              <label class="stack">
                <span class="label">Дата и время</span>
                <input class="field" type="datetime-local" name="starts_at" required />
              </label>
              <label class="stack">
                <span class="label">Комната</span>
                <select class="select" name="room_id">
                  <option value="general">общая</option>
                  <option value="games">игры</option>
                  <option value="chill">чилл</option>
                  <option value="movie-night">киноночь</option>
                </select>
              </label>
            </div>
            <button class="button" type="submit">Создать сбор</button>
          </form>
        </article>
      </section>
    `
  });
}
