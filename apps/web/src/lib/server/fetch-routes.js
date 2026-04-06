import { inviteHtml, roomHtml } from "../views.js";
import { sendHtml } from "./response-helpers.js";

export async function handleFetchRoute({ req, res, apiFetch }) {
  if (req.url?.startsWith("/room/")) {
    const roomId = req.url.replace("/room/", "");

    try {
      const [roomResponse, messagesResponse] = await Promise.all([
        apiFetch(`/api/rooms/${roomId}`),
        apiFetch(`/api/rooms/${roomId}/messages`)
      ]);

      if (roomResponse.status !== 200) {
        sendHtml(res, 404, "<h1>Комната не найдена</h1>");
        return true;
      }

      const roomPayload = await roomResponse.json();
      const messagesPayload = await messagesResponse.json();

      sendHtml(res, 200, roomHtml({ room: roomPayload.data, messages: messagesPayload.data }));
    } catch {
      sendHtml(res, 502, "<h1>API недоступно</h1>");
    }

    return true;
  }

  if (req.url?.startsWith("/invite/")) {
    const inviteCode = req.url.replace("/invite/", "");

    try {
      const response = await apiFetch(`/api/invite-preview?code=${inviteCode}`);

      if (response.status !== 200) {
        sendHtml(res, 404, "<h1>Инвайт не найден</h1>");
        return true;
      }

      const payload = await response.json();
      sendHtml(res, 200, inviteHtml(payload.data));
    } catch {
      sendHtml(res, 502, "<h1>API недоступно</h1>");
    }

    return true;
  }

  return false;
}
