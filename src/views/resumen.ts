/** Resumen: all charts with view (together / each), period, comparison and stage filters. */
import { ingresosVsGastos, type Base, type Vista } from '../core/agregados';
import {
  etiquetaPeriodo,
  mesActual,
  mesCorto,
  mesLargo,
  moverPeriodo,
  nombreMes,
  rangoMeses,
  rangoPeriodo,
  sumarMeses,
  type Periodo,
} from '../core/fechas';
import { fmtUSD } from '../core/money';
import { primerMes } from '../app/selectores';
import { get, set, type Estado } from '../app/store';
import type { Datos } from '../data/repo';
import { onChange, onClick } from '../ui/eventos';
import { haptic } from '../ui/feedback';
import { tarjetaGrafico } from '../ui/grafico';
import { html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { NOMBRE, t, tg } from '../strings';
import { cabecera } from './comunes';
import { grafico1, grafico2, grafico3, grafico4, grafico5 } from './graficos';

export const base = (d: Datos): Base => d;

/** Ranges for trend charts (several months) and snapshot charts (the selected period). */
export function rangos(
  d: Datos,
  e: Estado,
): { tendencia: [string, string]; corte: [string, string]; previo: [string, string] | null } {
  const hoy = mesActual();
  const primer = primerMes(d, hoy);
  const r = e.resumen;
  const clip = ([a, z]: [string, string]): [string, string] => [a < primer ? primer : a, z > hoy ? hoy : z];
  const etapa = r.etapa ? d.etapas.find((x) => x.id === r.etapa) : null;
  let tendencia: [string, string], corte: [string, string];
  if (etapa) {
    tendencia = corte = clip([etapa.desde, etapa.hasta ?? hoy]);
  } else if (r.periodo === 'mes') {
    corte = [r.ancla, r.ancla];
    tendencia = clip([sumarMeses(r.ancla, -11), r.ancla]);
  } else {
    tendencia = corte = clip(rangoPeriodo(r.periodo, r.ancla, primer));
  }
  let previo: [string, string] | null = null;
  if (r.comparar) {
    const n = rangoMeses(corte[0], corte[1]).length;
    previo = [sumarMeses(corte[0], -n), sumarMeses(corte[1], -n)];
  }
  return { tendencia, corte, previo };
}

/** Inicio card: this month's leftover with a sparkline of the last six months. */
export function tarjetaSobrante(d: Datos, e: Estado): Html {
  const hoy = mesActual();
  const fin = e.mes > hoy ? hoy : e.mes;
  const datos = ingresosVsGastos(base(d), sumarMeses(fin, -5), fin, e.verPersona, hoy);
  const ultimo = datos.at(-1);
  if (!ultimo || !datos.some((x) => x.ingreso)) return html``;
  const juntos = false;
  const conclusion =
    ultimo.sobrante >= 0
      ? tg.sobro(juntos, nombreMes(ultimo.mes), ultimo.sobrante, ultimo.parcial)
      : tg.falto(juntos, nombreMes(ultimo.mes), -ultimo.sobrante);
  const filas = datos.map((x) => ({
    m: mesCorto(x.mes),
    v: x.sobrante / 100,
    parcial: x.parcial,
    mes: x.mes,
    c: x.sobrante,
  }));
  const tarjeta = tarjetaGrafico({
    id: 'sob',
    titulo: e.verPersona === e.persona ? 'Tu sobrante' : `Sobrante de ${NOMBRE[e.verPersona]}`,
    conclusion,
    nota: 'Ingreso menos gastos (tu parte de la casa incluida) y aportes',
    dibujar: (P, ancho, c) =>
      P.plot({
        width: ancho,
        height: 110,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 22,
        style: { color: c['label-2'] as string, fontSize: '11px' },
        x: { domain: filas.map((f) => f.m), label: null, tickSize: 0, padding: 0.35 },
        y: { axis: null },
        marks: [
          P.barY(filas, {
            x: 'm',
            y: 'v',
            fill: (f: { v: number }) => (f.v < 0 ? c.bad : c.sobrante),
            fillOpacity: (f: { parcial: boolean }) => (f.parcial ? 0.5 : 1),
            rx: 3,
          }),
          P.ruleY([0], { stroke: c.separator }),
        ],
      }),
    scrub: {
      escala: 'x',
      puntos: filas.map((f) => ({ x: f.m, texto: `${mesLargo(f.mes)}: ${fmtUSD(f.c, 'whole')}` })),
    },
    tabla: {
      cols: ['Mes', 'Sobrante'],
      filas: datos.map((x) => [mesLargo(x.mes), fmtUSD(x.sobrante, 'whole')]),
    },
    extra: html`<button
      class="btn small secondary"
      data-on="ir-tab"
      data-tab="resumen"
      style="margin-top:10px"
    >
      ${icon('resumen')} Ver resumen completo
    </button>`,
  });
  return tarjeta;
}

export function vistaResumen(e: Estado): Html {
  const d = e.datos as Datos;
  const r = e.resumen;
  const b = base(d);
  const hoy = mesActual();
  const primer = primerMes(d, hoy);
  const { tendencia, corte, previo } = rangos(d, e);
  const vistas: Array<[Vista, string]> = [
    ['juntos', 'Juntos'],
    ['carlos', NOMBRE.carlos],
    ['sofia', NOMBRE.sofia],
  ];
  const periodos: Array<[Periodo, string]> = [
    ['mes', 'Mes'],
    ['trimestre', 'Trimestre'],
    ['año', 'Año'],
    ['todo', 'Todo'],
  ];
  const etapa = r.etapa ? d.etapas.find((x) => x.id === r.etapa) : null;
  const etiqueta = etapa ? etapa.nombre : etiquetaPeriodo(r.periodo, r.ancla, primer);
  const puedeAtras = !etapa && r.periodo !== 'todo' && rangoPeriodo(r.periodo, r.ancla, primer)[0] > primer;
  const puedeAdelante = !etapa && r.periodo !== 'todo' && rangoPeriodo(r.periodo, r.ancla, primer)[1] < hoy;
  return html`${cabecera(t.tabs.resumen)}
    <div class="stack">
      <div class="seg" role="group" aria-label="Ver">
        ${vistas.map(([k, n]) => html`<button data-on="vista" data-v="${k}" aria-pressed="${r.vista === k}">${n}</button>`)}
      </div>
      <div class="seg compact" role="group" aria-label="Periodo">
        ${periodos.map(([k, n]) => html`<button data-on="periodo" data-v="${k}" aria-pressed="${!etapa && r.periodo === k}">${n}</button>`)}
      </div>
      <div class="row" style="flex-wrap:wrap">
        <div class="stepper" role="group" aria-label="Periodo">
          <button
            data-on="mover-periodo"
            data-k="-1"
            aria-label="${t.periodoAnterior}"
            ${puedeAtras ? '' : 'disabled'}
          >
            ${icon('izq')}
          </button>
          <span class="lbl" aria-live="polite">${etiqueta}</span>
          <button
            data-on="mover-periodo"
            data-k="1"
            aria-label="${t.periodoSiguiente}"
            ${puedeAdelante ? '' : 'disabled'}
          >
            ${icon('der')}
          </button>
        </div>
        <label class="row t-sub" style="gap:8px;min-height:44px">
          <input
            type="checkbox"
            role="switch"
            data-change="comparar"
            ${r.comparar ? 'checked' : ''}
            style="width:1.3em;height:1.3em"
          />
          ${tg.comparar}
        </label>
      </div>
      ${
        etapa
          ? html`<p class="banner">
              ${icon('etapas')}<span
                >Etapa: <b>${etapa.nombre}</b> (${mesLargo(etapa.desde)} –
                ${etapa.hasta ? mesLargo(etapa.hasta) : 'hoy'})</span
              >
              <button class="link" data-on="etapa" data-id="" style="margin-left:auto">${tg.todas}</button>
            </p>`
          : ''
      }
      <div class="wide-2">
        <div class="stack">
          ${grafico1(b, tendencia[0], tendencia[1], r.vista, hoy, { comparar: previo, etapa: r.etapa })}
          ${grafico2(b, corte[0], corte[1], r.vista, previo)}
          ${grafico5(b, tendencia[0], tendencia[1], r.vista)}
        </div>
        <div class="stack">
          ${grafico3(b, corte[0], corte[1], r.vista)}
          ${grafico4(b, tendencia[0], tendencia[1], r.vista, { etapa: r.etapa })}
        </div>
      </div>
      <p class="t-foot muted" style="margin:0 4px">
        Todo en dólar real: lo pagado en bolívares vale lo que costó en dólares a tasa Binance del día.
      </p>
    </div>`;
}

const resumen = (patch: Partial<Estado['resumen']>) => set({ resumen: { ...get().resumen, ...patch } });

onClick('vista', (el) => resumen({ vista: el.dataset.v as Vista }));
onClick('periodo', (el) => resumen({ periodo: el.dataset.v as Periodo, etapa: null }));
onClick('mover-periodo', (el) => {
  haptic();
  const r = get().resumen;
  const ancla = moverPeriodo(r.periodo, r.ancla, Number(el.dataset.k));
  resumen({ ancla: ancla > mesActual() ? mesActual() : ancla });
});
onClick('etapa', (el) => {
  const id = el.dataset.id || null;
  const actual = get().resumen.etapa;
  set({ tab: 'resumen', resumen: { ...get().resumen, etapa: id === actual ? null : id } });
});
onChange('comparar', (el) => resumen({ comparar: (el as HTMLInputElement).checked }));
