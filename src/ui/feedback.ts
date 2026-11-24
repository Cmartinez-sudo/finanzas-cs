/** Toast with optional undo (role=status), and haptics where the browser allows them. */
import { t } from '../strings';

let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string, accion?: { label: string; fn: () => void | Promise<void> }): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.replaceChildren();
  const span = document.createElement('span');
  span.textContent = msg;
  el.append(span);
  if (accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = accion.label;
    b.onclick = () => {
      ocultar();
      void accion.fn();
    };
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(timer);
  // Longer when there is something to act on, so VoiceOver users can reach the button.
  timer = setTimeout(ocultar, accion ? 8000 : 3500);
}

function ocultar() {
  const el = document.getElementById('toast');
  if (el) el.hidden = true;
}

export const toastError = (reintentar?: () => void | Promise<void>): void =>
  toast(t.sinConexion, reintentar ? { label: t.reintentar, fn: reintentar } : undefined);

/**
 * Light haptic tap. iOS Safari 18+ plays one when a native switch toggles, so we toggle a hidden one;
 * elsewhere we fall back to the Vibration API. Silent when neither exists.
 */
let sw: HTMLLabelElement | null = null;
export function haptic(): void {
  try {
    if ('vibrate' in navigator && !/iP(hone|ad)/.test(navigator.userAgent)) {
      navigator.vibrate(8);
      return;
    }
    if (!sw) {
      sw = document.createElement('label');
      sw.setAttribute('aria-hidden', 'true');
      sw.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      sw.append(input);
      document.body.append(sw);
    }
    sw.click();
  } catch {
    /* no haptics available */
  }
}
