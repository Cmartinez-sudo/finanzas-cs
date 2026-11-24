/** Email + password sign-in for the two accounts. */
import { html, type Html } from '../ui/html';
import { t } from '../strings';

export function vistaLogin(): Html {
  return html`<main class="fullscreen">
    <p class="t-foot muted">${t.app}</p>
    <h1 class="t-large" tabindex="-1">${t.bienvenidos}</h1>
    <form id="login" class="stack" novalidate>
      <div>
        <label class="field-label" for="l-email">${t.correo}</label>
        <input
          id="l-email"
          class="text-input"
          type="email"
          autocomplete="username"
          inputmode="email"
          required
        />
      </div>
      <div>
        <label class="field-label" for="l-pass">${t.contrasena}</label>
        <input id="l-pass" class="text-input" type="password" autocomplete="current-password" required />
      </div>
      <p class="error-text" id="l-err" role="alert" hidden></p>
      <button class="btn wide" id="l-btn" type="submit">${t.entrar}</button>
      <p class="t-foot muted" style="text-align:center">${t.sesionAbierta}</p>
    </form>
  </main>`;
}
