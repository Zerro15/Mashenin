import { getBaseStyles } from "../styles.js";
import { escapeHtml } from "../shared/utils.js";

export function authShell({ title, bodyClass, content }) {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${getBaseStyles()}</style>
  </head>
  <body>
    <div class="${escapeHtml(bodyClass)}">
      ${content}
    </div>
  </body>
</html>`;
}

export function authFormShell({ title, subtitle, formAction, fields, footer }) {
  return authShell({
    title,
    bodyClass: "auth-shell",
    content: `
      <section class="auth-window">
        <div class="auth-brand">
          <strong>mashenin</strong>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="auth-tabs">
          <a class="auth-tab${formAction === "/auth/login" ? " is-active" : ""}" href="/login">Вход</a>
          <a class="auth-tab${formAction === "/auth/register" ? " is-active" : ""}" href="/register">Регистрация</a>
        </div>
        <form class="form-grid" method="POST" action="${escapeHtml(formAction)}">
          ${fields}
          <button class="button" type="submit">${escapeHtml(title)}</button>
        </form>
        <div class="auth-meta">
          <span>После входа откроется продукт</span>
          <span>${footer}</span>
        </div>
      </section>
    `
  });
}
