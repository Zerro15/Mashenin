export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function statusLabel(status) {
  return (
    {
      online: "онлайн",
      away: "нет на месте",
      in_voice: "в голосовом"
    }[status] || status
  );
}

export function kindLabel(kind) {
  return kind === "temporary" ? "временный" : "постоянный";
}
