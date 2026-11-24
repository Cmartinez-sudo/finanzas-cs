/** Charts shown in context: planned vs. actual in Gastos, goals and debts in Fondos. */
import type { Vista } from '../core/agregados';
import { mesActual, sumarMeses } from '../core/fechas';
import { primerMes } from '../app/selectores';
import type { Estado } from '../app/store';
import type { Datos } from '../data/repo';
import { html, type Html } from '../ui/html';
import { grafico3, grafico4, grafico5 } from './graficos';

const vistaGastos = (e: Estado): Vista =>
  e.filtro === 'todos'
    ? 'juntos'
    : e.filtro === 'otro'
      ? e.persona === 'carlos'
        ? 'sofia'
        : 'carlos'
      : e.persona;

export function graficoPlanVsReal(d: Datos, e: Estado): Html {
  if (e.mes > mesActual()) return html``;
  return grafico3(d, e.mes, e.mes, vistaGastos(e), 'gx3');
}

export function graficosFondos(d: Datos, e: Estado): Html {
  const hasta = e.mes > mesActual() ? mesActual() : e.mes;
  const primer = primerMes(d, hasta);
  const desde = sumarMeses(hasta, -11) < primer ? primer : sumarMeses(hasta, -11);
  return html`<div class="wide-2">
    ${grafico4(d, desde, hasta, 'juntos', { id: 'fx4' })}${grafico5(d, desde, hasta, 'juntos', 'fx5')}
  </div>`;
}
