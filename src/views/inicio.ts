/** Inicio: what is left to spend this month, pending transfers, and the budget per category. */

import { fmtUSD, sumCents } from '../core/money';
import { AJUSTE_CASA, otra, type Persona } from '../core/model';
import {
  aportesPlan,
  categoriasPasadas,
  checklistDe,
  gastadoEn,
  partesCasa,
  presupuestoPersonal,
  sobrante,
  type ItemChecklist,
} from '../core/plan';
import { catsGrupo, catsPersona, nombreClave, plan as planDe } from '../app/selectores';
import { get, getRepo, set, type Estado } from '../app/store';
import type { Datos } from '../data/repo';
import { onChange, onClick } from '../ui/eventos';
import { haptic, toast, toastError } from '../ui/feedback';
import { cx, html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { NOMBRE, t } from '../strings';
import { bloquePresupuesto, cabecera, diasRestantes, selectorMes, vacio } from './comunes';
import { tarjetaSobrante } from './resumen';

function itemTexto(d: Datos, i: ItemChecklist): { titulo: string; sub: string } {
  if (i.tipo === 'ajuste') return { titulo: t.ajusteCasa(otra(i.persona)), sub: t.ajusteCasaSub };
  if (i.tipo === 'deuda') return { titulo: t.pagoDeuda(nombreClave(d, i.clave)), sub: '' };
  const meta = d.metas.find((m) => m.id === i.clave);
  return { titulo: t.aporteA(meta?.nombre ?? i.clave), sub: meta?.cuenta ?? '' };
}

function pendientes(d: Datos, e: Estado): Html {
  const plan = planDe(d, e.mes);
  if (!plan) return html``;
  const mios = checklistDe(plan, d.categorias, d.aportes, e.mes, e.persona, d.deudas);
  const otros = checklistDe(plan, d.categorias, d.aportes, e.mes, otra(e.persona), d.deudas);
  const falta = sumCents(mios.filter((i) => !i.hecho).map((i) => i.montoCents));
  const hechos = mios.filter((i) => i.hecho).length;
  const fila = (i: ItemChecklist, editable: boolean) => {
    const { titulo, sub } = itemTexto(d, i);
    const id = `ck-${i.persona}-${i.clave}`;
    return html`<label class="${cx('check', i.hecho && 'done')}" for="${id}">
      <input
        type="checkbox"
        id="${id}"
        data-change="marcar"
        data-clave="${i.clave}"
        data-monto="${i.montoCents}"
        ${i.hecho ? 'checked' : ''}
        ${editable ? '' : 'disabled'}
      />
      <span class="grow"
        ><span class="title">${titulo}</span>${sub ? html`<span class="subtitle">${sub}</span>` : ''}</span
      >
      <span class="num">${fmtUSD(i.montoCents, 'whole')}</span>
    </label>`;
  };
  const otrosHechos = otros.filter((i) => i.hecho).length;
  return html`<section aria-labelledby="pend-t">
    <div class="row" style="margin:0 16px 6px">
      <h2 id="pend-t" class="t-title3">${t.pendientes}</h2>
      <span class="tag ${hechos === mios.length ? 'good' : ''}">${hechos} de ${mios.length}</span>
    </div>
    <div class="list">
      ${mios.length ? mios.map((i) => fila(i, true)) : html`<p class="cell muted">${t.pendientesListo}</p>`}
    </div>
    <p class="section-foot">${falta ? t.pendientesFalta(falta) : t.pendientesListo}</p>
    ${
      otros.length
        ? html`<details class="disclosure card" style="margin-top:12px;padding-block:4px">
            <summary>${t.pendientesOtro(otra(e.persona), otrosHechos, otros.length)}</summary>
            <div class="list" style="box-shadow:none;margin:0 -16px">${otros.map((i) => fila(i, false))}</div>
            <p class="t-foot muted" style="padding:8px 0">${t.soloOtro(otra(e.persona))}</p>
          </details>`
        : ''
    }
  </section>`;
}

export function vistaInicio(e: Estado): Html {
  const d = e.datos as Datos;
  const v = e.verPersona,
    mio = v === e.persona;
  const plan = planDe(d, e.mes);
  const head = cabecera(t.hola(e.persona));
  if (!plan)
    return html`${head}${selectorMes()}${vacio('lista', t.sinPlan, '', html`<button class="btn" data-on="ir-ajustes" data-pagina="plan">${t.ajustes}</button>`)}`;

  const cats = catsPersona(d, v);
  const pres = presupuestoPersonal(plan, d.categorias, v);
  const gastado = gastadoEn(d.movimientos, e.mes, cats);
  const queda = pres - gastado;
  const dr = diasRestantes(e.mes);
  const pasadas = [
    ...categoriasPasadas(plan, d.movimientos, e.mes, catsGrupo(d, 'casa')).map((c) => `${c.nombre} (casa)`),
    ...categoriasPasadas(plan, d.movimientos, e.mes, cats).map((c) => c.nombre),
  ];
  const aportes = sumCents(Object.values(aportesPlan(plan, v)));

  return html`${head}
    <div class="stack">
      ${selectorMes()}
      <div class="seg" role="group" aria-label="Ver presupuesto de">
        <button data-on="ver-persona" data-p="${e.persona}" aria-pressed="${mio}">${t.loMio}</button>
        <button data-on="ver-persona" data-p="${otra(e.persona)}" aria-pressed="${!mio}">
          ${t.loDe(otra(e.persona))}
        </button>
      </div>

      <section class="${cx('hero', queda < 0 && 'neg')}" aria-label="${mio ? t.teQueda : t.leQueda(v)}">
        <p class="eyebrow">${mio ? t.teQueda : t.leQueda(v)}</p>
        <p class="big">${fmtUSD(queda)}</p>
        <p>${t.dePresupuesto(pres)}${dr ? t.diasRestantes(dr) : ''}</p>
        <div class="meter" aria-hidden="true">
          <i style="width:${pres ? Math.min(100, Math.max(0, (gastado / pres) * 100)).toFixed(1) : 0}%"></i>
        </div>
      </section>

      ${pasadas.length ? html`<p class="notice" role="note">${icon('alerta')}<span>${t.pasados} ${pasadas.join(', ')}</span></p>` : ''}

      <div class="wide-2">
        <div class="stack">${tarjetaSobrante(d, e)} ${pendientes(d, e)}</div>
        <div class="stack">
          ${bloquePresupuesto(mio ? t.tusFijos : t.fijosDe(v), NOMBRE[v], v, cats, plan, d.movimientos, e.mes)}
          ${bloquePresupuesto(t.casa, t.compartido, 'casa', catsGrupo(d, 'casa'), plan, d.movimientos, e.mes)}
          ${bloquePresupuesto(t.imprevisto, t.compartido, 'imprevisto', catsGrupo(d, 'imprevisto'), plan, d.movimientos, e.mes)}
          <details class="card disclosure" style="padding-block:4px">
            <summary>${t.comoSeReparte(mio, v)}</summary>
            <dl class="dl" style="padding-bottom:12px">
              <dt>${t.ingreso}</dt>
              <dd>${fmtUSD(plan.ingresos[v], 'whole')}</dd>
              <dt>${t.parteCasa}</dt>
              <dd>−${fmtUSD(partesCasa(plan, d.categorias)[v], 'whole')}</dd>
              <dt>${t.fijosLibre}</dt>
              <dd>−${fmtUSD(pres, 'whole')}</dd>
              <dt>${t.aportesMes}</dt>
              <dd>−${fmtUSD(aportes, 'whole')}</dd>
              <dt class="total">${t.sobrantePlan}</dt>
              <dd class="total">${fmtUSD(sobrante(plan, d.categorias, v), 'whole')}</dd>
            </dl>
          </details>
        </div>
      </div>
    </div>`;
}

onClick('ver-persona', (el) => set({ verPersona: el.dataset.p as Persona }));

onChange('marcar', async (el) => {
  const input = el as HTMLInputElement;
  const e = get(),
    d = e.datos;
  if (!d) return;
  const clave = input.dataset.clave as string;
  const aporte = {
    mes: e.mes,
    persona: e.persona,
    clave,
    montoCents: Number(input.dataset.monto),
    hecho: input.checked,
    tasaCompra: clave === AJUSTE_CASA ? null : (d.tasaHoy?.binance ?? null),
  };
  haptic();
  const antes = d.aportes;
  const aportes = [
    ...antes.filter((a) => !(a.mes === aporte.mes && a.persona === aporte.persona && a.clave === clave)),
    aporte,
  ];
  set({ datos: { ...d, aportes } });
  try {
    await getRepo().guardarAporte(aporte);
    const plan = planDe(d, e.mes);
    if (
      input.checked &&
      plan &&
      checklistDe(plan, d.categorias, aportes, e.mes, e.persona, d.deudas).every((i) => i.hecho)
    )
      toast(t.pendientesListo);
  } catch (err) {
    console.error(err);
    set({ datos: { ...d, aportes: antes } });
    toastError();
  }
});
