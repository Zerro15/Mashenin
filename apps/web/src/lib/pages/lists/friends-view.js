import { listPage } from "../../shared/page-helpers.js";

export function friendsHtml() {
  return listPage({
    title: "Люди",
    active: "friends",
    headerTitle: "люди",
    headerTopic: "Присутствие участников сервера",
    heroTitle: "Участники сообщества",
    heroText: "Кто онлайн, кто в голосе и кто временно отошел.",
    body: `
      <article class="panel-card">
        <div class="panel-header">
          <h2>Присутствие</h2>
        </div>
        <div class="friend-list" id="friends">
          <div class="empty">Собираю список...</div>
        </div>
      </article>
    `
  });
}
