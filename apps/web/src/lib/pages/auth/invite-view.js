import { authShell } from "../../layout/auth-shell.js";
import { escapeHtml } from "../../shared/utils.js";

export function inviteHtml(invite) {
  return authShell({
    title: "mashenin · invite",
    bodyClass: "invite-shell",
    content: `
      <section class="invite-card">
        <div class="invite-side">
          <div class="eyebrow">Приглашение</div>
          <h1 style="font-size:42px;line-height:1.02;">${escapeHtml(invite.groupName)}</h1>
          <p class="invite-copy">
            Пространство для постоянных комнат, регулярных созвонов и спокойного общения команды или сообщества без перегруженного интерфейса.
          </p>
          <div class="kpis">
            <article class="stat-card">
              <strong>${escapeHtml(invite.availableSlots)}</strong>
              <span class="label">свободных мест</span>
            </article>
            <article class="stat-card">
              <strong>${escapeHtml(invite.invitedBy)}</strong>
              <span class="label">пригласил</span>
            </article>
          </div>
        </div>
        <div class="invite-form">
          <div class="eyebrow">Вход</div>
          <h2 style="font-size:30px;margin-top:4px;">Войти по коду ${escapeHtml(invite.code)}</h2>
          <p class="helper">После входа ты сразу попадешь в пространство, где легко понять: кто на связи, куда идти и как быстро подключиться к голосу.</p>
          <form class="form-grid" method="POST" action="/auth/invite">
            <label class="stack">
              <span class="label">Имя в сервере</span>
              <input class="field" type="text" name="name" placeholder="Например, Артем" required />
            </label>
            <input type="hidden" name="code" value="${escapeHtml(invite.code)}" />
            <label class="stack">
              <span class="label">Инвайт-код</span>
              <input class="field" type="text" value="${escapeHtml(invite.code)}" readonly />
            </label>
            <button class="button" type="submit">Зайти в mashenin</button>
          </form>
        </div>
      </section>
    `
  });
}
