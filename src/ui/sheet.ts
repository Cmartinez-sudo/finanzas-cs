/**
 * Bottom sheets on the native <dialog> element: showModal() traps focus, makes the page inert
 * and closes on Escape. Focus returns to the control that opened it. Drag the grabber down to close.
 */
import { html, type Html } from './html';
import { icon } from './icons';
import { t } from '../strings';

export function sheetMarkup(id: string, titulo: string, cuerpo: Html, accionFin?: Html): Html {
  return html`<dialog class="sheet" id="${id}" aria-labelledby="${id}-t">
    <div class="sheet-head">
      <span class="grabber" data-grab aria-hidden="true"></span>
      <button type="button" class="link" data-cerrar>${t.cancelar}</button>
      <h2 id="${id}-t">${titulo}</h2>
      <span class="end">${accionFin ?? ''}</span>
    </div>
    <div class="sheet-body">${cuerpo}</div>
  </dialog>`;
}

const origen = new WeakMap<HTMLDialogElement, Element | null>();

export function abrirSheet(markup: Html, alAbrir?: (d: HTMLDialogElement) => void): HTMLDialogElement {
  const host = document.getElementById('sheets') as HTMLElement;
  host.insertAdjacentHTML('beforeend', markup.s);
  const d = host.lastElementChild as HTMLDialogElement;
  origen.set(d, document.activeElement);
  d.addEventListener('click', (e) => {
    if (e.target === d) cerrarSheet(d); // tap on the backdrop
    if ((e.target as Element).closest('[data-cerrar]')) cerrarSheet(d);
  });
  d.addEventListener('close', () => {
    const o = origen.get(d);
    d.remove();
    if (o instanceof HTMLElement && o.isConnected) o.focus();
  });
  arrastrar(d);
  d.showModal();
  alAbrir?.(d);
  return d;
}

export function cerrarSheet(d: HTMLDialogElement): void {
  if (d.open) d.close();
}

function arrastrar(d: HTMLDialogElement) {
  const g = d.querySelector<HTMLElement>('[data-grab]');
  const head = d.querySelector<HTMLElement>('.sheet-head');
  if (!g || !head) return;
  let y0 = 0,
    dy = 0,
    activo = false;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return;
    activo = true;
    y0 = e.clientY;
    dy = 0;
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!activo) return;
    dy = Math.max(0, e.clientY - y0);
    d.style.transform = `translateY(${dy}px)`;
  });
  const fin = () => {
    if (!activo) return;
    activo = false;
    d.style.transform = '';
    if (dy > 120) cerrarSheet(d);
  };
  head.addEventListener('pointerup', fin);
  head.addEventListener('pointercancel', fin);
}

export const botonCerrar = (): Html =>
  html`<button type="button" class="icon-btn" data-cerrar aria-label="${t.cerrar}">
    ${icon('cerrar')}
  </button>`;
