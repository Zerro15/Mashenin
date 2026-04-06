import { authFormShell } from "../../layout/auth-shell.js";

export function registerHtml() {
  return authFormShell({
    title: "Регистрация",
    subtitle: "Создай аккаунт и зайди в продукт.",
    formAction: "/auth/register",
    fields: `
      <label class="stack">
        <span class="label">Имя</span>
        <input class="field" type="text" name="display_name" required />
      </label>
      <label class="stack">
        <span class="label">Email</span>
        <input class="field" type="email" name="email" required />
      </label>
      <label class="stack">
        <span class="label">Пароль</span>
        <input class="field" type="password" name="password" minlength="6" required />
      </label>
      <label class="stack">
        <span class="label">О себе</span>
        <input class="field" type="text" name="about" placeholder="Коротко о себе" />
      </label>
      <label class="stack">
        <span class="label">Инвайт-код</span>
        <input class="field" type="text" name="code" value="mashenin-2026" required />
      </label>
    `,
    footer: 'Уже есть аккаунт? <a href="/login">Войди</a>.'
  });
}
