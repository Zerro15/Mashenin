import { listPage } from "../../shared/page-helpers.js";

export function roomsHtml() {
  return listPage({
    title: "Комнаты",
    active: "rooms",
    headerTitle: "комнаты",
    headerTopic: "Все голосовые и текстовые зоны",
    heroTitle: "Комнаты",
    heroText: "Постоянные и временные комнаты с быстрым переходом в разговор.",
    body: `
      <article class="panel-card">
        <div class="panel-header">
          <h2>Навигация по комнатам</h2>
        </div>
        <div class="room-list" id="rooms">
          <div class="empty">Загружаю комнаты...</div>
        </div>
      </article>
    `
  });
}
