/** Fondos: savings goals with their caps, and debts going down. */

import { usdABs } from '../core/fx';
import { fmtBs, fmtUSD, roundHalfAway, sumCents } from '../core/money';
import type { Deuda, Meta } from '../core/model';
import { aportesPlan, saldoDeuda, saldoMeta } from '../core/plan';
import { deudasActivas, iconoMeta, metasActivas, plan as planDe } from '../app/selectores';
import type { Estado } from '../app/store';
import type { Datos } from '../data/repo';
import { html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { NOMBRE, t } from '../strings';
import { cabecera, selectorMes, vacio } from './comunes';
import { graficosFondos } from './resumen-graficos';

function mensualMeta(d: Datos, e: Estado, id: string): number {
  const p = planDe(d, e.mes);
  return p ? (aportesPlan(p, 'carlos')[id] ?? 0) + (aportesPlan(p, 'sofia')[id] ?? 0) : 0;
}

function tarjetaMeta(d: Datos, e: Estado, m: Meta): Html {
  const s = saldoMeta(m, d.aportes, d.movimientos, e.mes);
  const mensual = mensualMeta(d, e, m.id);
  const tope = m.topeCents;
  const pct = tope ? Math.min(100, Math.max(0, (s.saldoCents / tope) * 100)) : null;
  const falta = tope ? Math.max(0, tope - s.saldoCents) : 0;
  const meses = falta && mensual ? Math.ceil(falta / mensual) : null;
  const dueño = m.persona ? NOMBRE[m.persona] : 'De los dos';
  return html`<article class="card goal k-${m.tipo}" aria-labelledby="meta-${m.id}">
    <div class="row" style="justify-content:flex-start">
      <span class="badge-icon">${icon(iconoMeta(m.tipo))}</span>
      <div class="grow" style="min-width:0">
        <h3 class="t-headline" id="meta-${m.id}">${m.nombre}</h3>
        <p class="t-foot muted">${dueño}${m.cuenta ? ` · ${m.cuenta}` : ''}</p>
      </div>
    </div>
    <p class="amount" style="margin-top:10px">
      ${fmtUSD(s.saldoCents)}
      <span class="t-sub muted" style="font-weight:400">${tope ? t.deTope(tope) : t.sinTope}</span>
    </p>
    ${
      pct !== null
        ? html`<div
              class="progress"
              role="progressbar"
              aria-label="${m.nombre}"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="${Math.round(pct)}"
              aria-valuetext="${Math.round(pct)} %, ${fmtUSD(s.saldoCents, 'whole')} ${t.deTope(tope as number)}"
            >
              <i style="width:${pct.toFixed(1)}%"></i>
            </div>
            <p class="t-foot ${falta ? 'muted' : 'good'}">
              ${falta ? t.faltaParaTope(falta, meses) : html`${icon('check')} ${t.llena}`}
            </p>`
        : ''
    }
    <details class="disclosure" style="margin-top:4px">
      <summary class="t-sub">Detalle</summary>
      <dl class="dl t-foot" style="padding-bottom:8px">
        ${
          s.inicialCents
            ? html`<dt>${t.saldoInicial}</dt>
                <dd>${fmtUSD(s.inicialCents)}</dd>`
            : ''
        }
        <dt>${t.aportadoPor('carlos')}</dt>
        <dd>${fmtUSD(s.aportadoCents.carlos)}</dd>
        <dt>${t.aportadoPor('sofia')}</dt>
        <dd>${fmtUSD(s.aportadoCents.sofia)}</dd>
        ${
          s.retiradoCents
            ? html`<dt>${t.retirado}</dt>
                <dd>−${fmtUSD(s.retiradoCents)}</dd>`
            : ''
        }
        <dt>${t.entraCadaMes}</dt>
        <dd>${fmtUSD(mensual, 'whole')}</dd>
      </dl>
    </details>
  </article>`;
}

function tarjetaDeuda(d: Datos, e: Estado, x: Deuda): Html {
  const s = saldoDeuda(x, d.aportes, d.movimientos, e.mes);
  const pagada = s.saldoCents === 0;
  const pct = x.saldoInicialCents ? ((x.saldoInicialCents - s.saldoCents) / x.saldoInicialCents) * 100 : 100;
  const bin = d.tasaHoy?.binance;
  const saldoTxt =
    x.moneda === 'USD'
      ? fmtUSD(s.saldoCents)
      : html`${fmtBs(s.saldoCents)}${bin && !pagada ? html` <span class="t-sub muted" style="font-weight:400">≈ ${fmtUSD(roundHalfAway(s.saldoCents / bin), 'whole')}</span>` : ''}`;
  return html`<article class="card goal k-deuda" aria-labelledby="deuda-${x.id}">
    <div class="row" style="justify-content:flex-start">
      <span class="badge-icon">${icon('tarjeta')}</span>
      <div class="grow">
        <h3 class="t-headline" id="deuda-${x.id}">${x.nombre}</h3>
        <p class="t-foot muted">${NOMBRE[x.persona]}</p>
      </div>
      ${pagada ? html`<span class="tag good">${icon('check')} ${t.pagada}</span>` : ''}
    </div>
    <p class="t-foot muted" style="margin-top:10px">${t.saldoPendiente}</p>
    <p class="amount">${saldoTxt}</p>
    <div
      class="progress"
      role="progressbar"
      aria-label="${x.nombre}: pagado"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${Math.round(pct)}"
    >
      <i style="width:${pct.toFixed(1)}%"></i>
    </div>
    <p class="t-foot muted">${t.pagadoReal}: ${fmtUSD(s.pagadoRealCents)}</p>
  </article>`;
}

export function vistaFondos(e: Estado): Html {
  const d = e.datos as Datos;
  const metas = metasActivas(d);
  const deudas = deudasActivas(d);
  const total = sumCents(metas.map((m) => saldoMeta(m, d.aportes, d.movimientos, e.mes).saldoCents));
  const bin = d.tasaHoy?.binance;
  return html`${cabecera(t.tabs.fondos)}
    <div class="stack">
      ${selectorMes()}
      <section class="hero" aria-label="${t.ahorrado}">
        <p class="eyebrow">${t.ahorrado}</p>
        <p class="big">${fmtUSD(total)}</p>
        <p>${t.ahorradoSub}</p>
      </section>
      ${graficosFondos(d, e)}
      ${
        metas.length
          ? html`<div class="wide-2">${metas.map((m) => tarjetaMeta(d, e, m))}</div>`
          : vacio('fondos', t.sinMetas, t.sinMetasSub)
      }
      ${
        deudas.length
          ? html`<h2 class="t-title3" style="margin:8px 4px 0">${t.deudas}</h2>
              <div class="wide-2">${deudas.map((x) => tarjetaDeuda(d, e, x))}</div>
              ${bin ? html`<p class="t-foot muted" style="margin:0 4px">Saldos en Bs convertidos a la tasa Binance de hoy (${fmtBs(usdABs(100, bin))} por $1).</p>` : ''}`
          : ''
      }
    </div>`;
}
