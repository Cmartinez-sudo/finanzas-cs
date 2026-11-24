/**
 * Line icons drawn in the spirit of SF Symbols (SF Symbols themselves may only be used on
 * Apple platforms). 24×24 grid, 1.8 stroke, round caps. Decorative: always aria-hidden.
 */
import { raw, type Html } from './html';

const P: Record<string, string> = {
  inicio: '<path d="M3.5 10.2 12 3.5l8.5 6.7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
  gastos: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>',
  resumen:
    '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6.5" rx="1"/><rect x="10.5" y="6.5" width="3" height="11" rx="1"/><rect x="15.5" y="9" width="3" height="8.5" rx="1"/>',
  fondos:
    '<path d="M4 9.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 9.5 6.5 5h11L20 9.5"/><path d="M10 13.5h4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  ajustes:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="7"/>',
  izq: '<path d="m14.5 18-6-6 6-6"/>',
  der: '<path d="m9.5 18 6-6-6-6"/>',
  cerrar: '<path d="M17 7 7 17M7 7l10 10"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alerta:
    '<path d="M12 9v4.5M12 17h.01"/><path d="M10.3 4 2.4 17.7A2 2 0 0 0 4.1 20.7h15.8a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/>',
  casa: '<path d="M3.5 10.5 12 4l8.5 6.5V20h-17z"/><path d="M9.5 20v-5h5v5"/>',
  persona: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
  avion:
    '<path d="M10.5 13.5 4 11l1.4-1.4 7 .9 4.3-4.3a1.8 1.8 0 0 1 2.6 2.6L15 13.1l.9 7-1.4 1.4-2.5-6.5-3.2 3.2.3 2.3-1 1-1.6-3.1L3.4 17l1-1 2.3.3z"/>',
  escudo: '<path d="M12 21s7.5-3.6 7.5-9.5V5.6L12 3 4.5 5.6v5.9C4.5 17.4 12 21 12 21z"/>',
  grafica: '<path d="M4 19.5h16"/><path d="m5 15 4.5-4.5 3.5 3 6-6.5"/><path d="M15 7h4v4"/>',
  tarjeta: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  intercambio: '<path d="M7 4v15M7 4 3.5 7.5M7 4l3.5 3.5M17 20V5M17 20l-3.5-3.5M17 20l3.5-3.5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  luna: '<path d="M20.5 13A8.5 8.5 0 1 1 11 3.5a6.6 6.6 0 0 0 9.5 9.5z"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  lista:
    '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
  imprevisto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>',
  inversion: '<path d="M4 19.5h16"/><path d="m5.5 15 4-4 3 2.5 6-6.5"/>',
  meta: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  salir:
    '<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  descargar: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  subir: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  editar: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>',
  basura: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  etapas:
    '<path d="M4 6h7M4 12h11M4 18h16"/><circle cx="14" cy="6" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
  notas:
    '<path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20z"/><path d="M14.5 3.5V8h4.5M9 12.5h6M9 16h6"/>',
  dolar:
    '<path d="M12 3v18M16.5 7.5c-.6-1.6-2.4-2.5-4.5-2.5-2.5 0-4.5 1.3-4.5 3.4 0 4.7 9.5 2.4 9.5 7.2 0 2.1-2 3.4-4.8 3.4-2.3 0-4.2-1-4.9-2.7"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
};

export function icon(name: keyof typeof P | string, cls = 'i'): Html {
  return raw(
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] ?? P.info}</svg>`,
  );
}
