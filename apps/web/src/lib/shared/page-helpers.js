import { escapeHtml } from "./utils.js";
import { shell } from "../layout/shell.js";
import { authFormShell } from "../layout/auth-shell.js";
import { dashboardScript } from "../client/dashboard.js";

export function listPage({ title, active, headerTitle, headerTopic, heroTitle, heroText, body, script = "" }) {
  return shell({
    title: `mashenin · ${title}`,
    activeNav: active,
    activeRoomId: "",
    headerTitle,
    headerTopic,
    script: `${dashboardScript()}${script}`,
    content: `
      <section class="hero-strip">
        <div class="eyebrow">${escapeHtml(title)}</div>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroText)}</p>
      </section>
      ${body}
    `
  });
}

export function authPage({ title, subtitle, formAction, fields, footer }) {
  return authFormShell({ title, subtitle, formAction, fields, footer });
}
