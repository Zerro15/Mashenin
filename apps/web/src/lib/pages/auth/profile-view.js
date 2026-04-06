import { authPage } from "../../shared/page-helpers.js";
import { escapeHtml } from "../../shared/utils.js";

export function profileHtml(user) {
  return authPage({
    title: "Профиль",
    subtitle: user
      ? "Профиль сохраняется в текущем store провайдере и используется для твоей сессии."
      : "Сначала войди или зарегистрируйся, чтобы редактировать профиль.",
    formAction: "/profile/update",
    fields: user
      ? `
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
          <input class="field" type="text" name="about" value="${escapeHtml(user.about || "")}" />
        </label>
      `
      : `
        <div class="empty">Нет активной сессии. Открой <a href="/login">вход</a> или <a href="/register">регистрацию</a>.</div>
      `,
    footer: user
      ? 'После сохранения открой <a href="/room/general">комнату</a> и нажми «Подключиться».'
      : "Без сессии профиль не редактируется."
  });
}
