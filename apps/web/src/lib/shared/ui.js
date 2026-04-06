import { escapeHtml } from "./utils.js";

export function navItem(href, label, active = false) {
  return `<a class="server-pill${active ? " is-active" : ""}" href="${href}">${escapeHtml(label)}</a>`;
}

export function createItem(href) {
  return `<a class="server-pill is-create" href="${href}" title="Создать">+</a>`;
}

export function avatar(name) {
  const initial = String(name || "M").trim().charAt(0).toUpperCase() || "M";
  return `<div class="avatar">${escapeHtml(initial)}</div>`;
}

export function channelLink({ href, icon, title, meta = "", active = false }) {
  return `
    <a class="channel-link${active ? " is-active" : ""}" href="${href}">
      <span class="channel-icon">${escapeHtml(icon)}</span>
      <span class="channel-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(meta)}</span>
      </span>
    </a>
  `;
}

export function memberRow(name, note, status = "online") {
  return `
    <div class="member-row">
      ${avatar(name)}
      <div class="member-text">
        <strong>${escapeHtml(name)}</strong>
        <span><span class="status-dot status-${escapeHtml(status)}"></span>${escapeHtml(note)}</span>
      </div>
    </div>
  `;
}
