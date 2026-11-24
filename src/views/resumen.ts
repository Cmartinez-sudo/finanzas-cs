/** Resumen: charts. Filled in by the charts stage. */
import type { Estado } from '../app/store';
import type { Datos } from '../data/repo';
import { html, type Html } from '../ui/html';
import { t } from '../strings';
import { cabecera } from './comunes';

export function tarjetaSobrante(_d: Datos, _e: Estado): Html {
  return html``;
}

export function vistaResumen(_e: Estado): Html {
  return cabecera(t.tabs.resumen);
}
