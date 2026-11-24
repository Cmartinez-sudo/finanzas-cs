/** Pieces several screens share: header, month stepper, budget block, empty state. */
import { diasDelMes, mesActual, mesLargo } from '../core/fechas';
import { fmtUSD, sumCents, type Cents } from '../core/money';
import type { Categoria, Movimiento, Persona, Plan } from '../core/model';
import { gastadoPorCategoria } from '../core/plan';
import { get } from '../app/store';
import { cx, html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { NOMBRE, t } from '../strings';

export function cabecera(titulo: string, sub?: string, acciones?: Html): Html {
  const p = get().persona;
  return html`<header class="nav-head">
    <div class="titles">
      ${sub ? html`<p class="sub">${sub}</p>` : ''}
      <h1 class="t-large" tabindex="-1">${titulo}</h1>
    </div>
    <div class="nav-actions">
      ${acciones ?? ''}
      <button class="icon-btn" data-on="ir-ajustes" aria-label="${t.ajustes}">${icon('ajustes')}</button>
      <button class="avatar p-${p}" data-on="cambiar-persona" aria-label="${t.cambiarPersona}: ${NOMBRE[p]}">
        ${NOMBRE[p][0]}
      </button>
    </div>
  </header>`;
}

export function selectorMes(): Html {
  const { mes } = get();
  const esHoy = mes === mesActual();
  return html`<div class="row" style="justify-content:flex-start;flex-wrap:wrap">
    <div class="stepper" role="group" aria-label="Mes">
      <button data-on="mes" data-k="-1" aria-label="${t.mesAnterior}">${icon('izq')}</button>
      <span class="lbl" aria-live="polite">${mesLargo(mes)}</span>
      <button data-on="mes" data-k="1" aria-label="${t.mesSiguiente}">${icon('der')}</button>
    </div>
    ${esHoy ? '' : html`<button class="btn small secondary" data-on="mes-hoy">${t.volverHoy}</button>`}
  </div>`;
}

export function diasRestantes(mes: string): number | null {
  if (mes !== mesActual()) return null;
  return diasDelMes(mes) - new Date().getDate() + 1;
}

/** Budget card: one line per category with spent / budget and a bar; stripes and a label when over. */
export function bloquePresupuesto(
  titulo: string,
  eyebrow: string,
  k: string,
  cats: Categoria[],
  plan: Plan,
  movs: Movimiento[],
  mes: string,
): Html {
  const g = gastadoPorCategoria(movs, mes);
  const total = sumCents(cats.map((c) => plan.presupuesto[c.id]));
  const gastado = sumCents(cats.map((c) => g.get(c.id)));
  const resto = total - gastado;
  const lineas = cats.map((c) => {
    const b = plan.presupuesto[c.id] ?? 0,
      s = g.get(c.id) ?? 0;
    const pct = b ? Math.min(100, (s / b) * 100) : s ? 100 : 0;
    const over = s > b;
    return html`<div class="${cx('bline', over && 'over')}">
      <div class="row">
        <span class="name">${c.nombre}${over ? html` <span class="tag bad">pasado</span>` : ''}</span>
        <span class="vals"><b>${fmtUSD(s)}</b> / ${fmtUSD(b, 'whole')}</span>
      </div>
      <div class="bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>
    </div>`;
  });
  return html`<section class="card k-${k}" aria-label="${titulo}">
    <div class="card-head">
      <div>
        <p class="t-foot muted">${eyebrow}</p>
        <h2 class="t-title3">${titulo}</h2>
      </div>
      <div style="text-align:right">
        <p class="num"><b>${fmtUSD(gastado)}</b> <span class="muted">de ${fmtUSD(total, 'whole')}</span></p>
        <span class="tag ${resto < 0 ? 'bad' : 'good'}"
          >${resto < 0 ? t.pasadoPor(-resto) : t.quedan(resto)}</span
        >
      </div>
    </div>
    ${lineas}
  </section>`;
}

export function vacio(iconName: string, titulo: string, sub: string, accion?: Html): Html {
  return html`<div class="card empty">
    ${icon(iconName)}
    <h3>${titulo}</h3>
    <p>${sub}</p>
    ${accion ?? ''}
  </div>`;
}

export const nombrePersona = (p: Persona): string => NOMBRE[p];
export const sumar = (xs: Cents[]): Cents => sumCents(xs);
