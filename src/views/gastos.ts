/** Gastos: the month's movements grouped by day, with filters. */
import { diaLegible } from '../core/fechas';
import { fmtBs, fmtUSD, sumCents } from '../core/money';
import { otra, type Movimiento } from '../core/model';
import { destino, movsDelMes } from '../app/selectores';
import { set, type Estado, type Filtro } from '../app/store';
import type { Datos } from '../data/repo';
import { onClick } from '../ui/eventos';
import { html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { NOMBRE, t } from '../strings';
import { cabecera, selectorMes, vacio } from './comunes';
import { abrirMovimiento } from './movimiento';
import { graficoPlanVsReal } from './resumen-graficos';

function pasaFiltro(d: Datos, e: Estado, m: Movimiento): boolean {
  const c = m.categoriaId ? d.categorias.find((x) => x.id === m.categoriaId) : null;
  const compartido = c ? c.grupo !== 'personal' : false;
  switch (e.filtro) {
    case 'mios':
      return compartido || m.persona === e.persona;
    case 'casa':
      return compartido;
    case 'otro':
      return m.persona === otra(e.persona) && !compartido;
    default:
      return true;
  }
}

export function vistaGastos(e: Estado): Html {
  const d = e.datos as Datos;
  const items = movsDelMes(d, e.mes)
    .filter((m) => pasaFiltro(d, e, m))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn - a.creadoEn);
  const total = sumCents(items.filter((m) => m.tipo === 'gasto').map((m) => m.realCents));
  const filtros: Array<[Filtro, string]> = [
    ['mios', t.filtros.mios],
    ['casa', t.filtros.casa],
    ['otro', t.filtros.otro(otra(e.persona))],
    ['todos', t.filtros.todos],
  ];
  const dias: Array<{ f: string; xs: Movimiento[] }> = [];
  for (const m of items) {
    const last = dias.at(-1);
    if (last && last.f === m.fecha) last.xs.push(m);
    else dias.push({ f: m.fecha, xs: [m] });
  }
  const fila = (m: Movimiento) => {
    const x = destino(d, m);
    const mio = m.persona === e.persona;
    const quien = mio ? t.tu : NOMBRE[m.persona];
    const signo = m.tipo === 'retiro' ? '−' : '';
    const bs =
      m.bsCents !== null
        ? html`<small
            >${fmtBs(m.bsCents)}${m.moneda === 'USD_BCV' ? ` · ${fmtUSD(m.montoCents)} BCV` : ''}</small
          >`
        : '';
    const inner = html`<span class="badge-icon k-${x.k}">${icon(x.icono)}</span>
      <span class="grow">
        <span class="title">${x.nombre}${m.nota ? ` · ${m.nota}` : ''}</span>
        <span class="subtitle">${x.grupo} · ${quien}</span>
      </span>
      <span class="amount">${signo}${fmtUSD(m.realCents)}${bs}</span>`;
    const label = `${x.nombre}, ${fmtUSD(m.realCents)}, ${quien}`;
    return mio
      ? html`<button
          class="cell has-icon mov"
          data-on="editar-mov"
          data-id="${m.id}"
          aria-label="Editar: ${label}"
        >
          ${inner}
        </button>`
      : html`<div class="cell has-icon mov" aria-label="${label}">${inner}</div>`;
  };
  return html`${cabecera(t.tabs.gastos)}
    <div class="stack">
      ${selectorMes()} ${graficoPlanVsReal(d, e)}
      <div class="chips" role="group" aria-label="Filtrar">
        ${filtros.map(([k, n]) => html`<button class="chip" data-on="filtro" data-f="${k}" aria-pressed="${e.filtro === k}">${n}</button>`)}
      </div>
      <div class="row" style="margin:0 4px">
        <span class="t-foot muted">${t.nGastos(items.length)}</span>
        <b class="num">${fmtUSD(total)}</b>
      </div>
      ${
        dias.length
          ? dias.map(
              (g) =>
                html`<section>
                  <h2 class="day-head">
                    <span>${diaLegible(g.f)}</span
                    ><span class="num"
                      >${fmtUSD(sumCents(g.xs.filter((m) => m.tipo === 'gasto').map((m) => m.realCents)))}</span
                    >
                  </h2>
                  <div class="list">${g.xs.map(fila)}</div>
                </section>`,
            )
          : vacio(
              'gastos',
              t.sinGastos,
              t.sinGastosSub,
              html`<button class="btn" data-on="anotar">${t.anotarUno}</button>`,
            )
      }
      ${items.some((m) => m.persona === e.persona) ? html`<p class="t-foot muted" style="text-align:center">${t.tocaParaEditar}</p>` : ''}
    </div>`;
}

onClick('filtro', (el) => set({ filtro: el.dataset.f as Filtro }));
onClick('editar-mov', (el) => abrirMovimiento(el.dataset.id ?? null));
onClick('anotar', () => abrirMovimiento(null));
