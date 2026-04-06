import { authFormShell } from "../../layout/auth-shell.js";

export function loginHtml() {
  return authFormShell({
    title: "Вход",
    subtitle: "Вход по email и паролю.",
    formAction: "/auth/login",
    fields: `
      <label class="stack">
        <span class="label">Email</span>
        <input class="field" type="email" name="email" required />
      </label>
      <label class="stack">
        <span class="label">Пароль</span>
        <input class="field" type="password" name="password" required />
      </label>
    `,
    footer: 'Нет аккаунта? <a href="/register">Зарегистрируйся</a>.'
  });
}
