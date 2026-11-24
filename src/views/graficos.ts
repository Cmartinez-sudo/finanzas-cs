/** The five charts. Each turns aggregates (core/agregados) into a chart card spec. */
import {
  etapasEnRango,
  gastosPorCategoria,
  ingresosVsGastos,
  planVsReal,
  progresoMetas,
  saldoDeudas,
  variacion,
  type Base,
  type Vista,
} from '../core/agregados';
import { mesCorto, mesLargo, nombreMes, rangoMeses } from '../core/fechas';
import { fmtBs, fmtUSD, sumCents, type Cents } from '../core/money';
import { html, type Html } from '../ui/html';
import { patrones, tarjetaGrafico, type Colores } from '../ui/grafico';
import { icon } from '../ui/icons';
import { tg } from '../strings';

const usd = (c: Cents) => c / 100;
const ejeUSD = (v: number) => fmtUSD(Math.round(v * 100), 'compact');
const pct = (v: number) => `${Math.round(v * 100)} %`;
const SIMBOLOS = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross'] as const;

function etiquetas(meses: string[]): Map<string, string> {
  const años = new Set(meses.map((m) => m.slice(0, 4)));
  return new Map(meses.map((m) => [m, mesCorto(m, años.size > 1)]));
}

function vacioGrafico(titulo: string): Html {
  return html`<section class="card chart-card" aria-label="${titulo}">
    <p class="t-foot muted">${titulo}</p>
    <div class="empty" style="padding:20px 8px">
      ${icon('grafica')}
      <h3>${tg.vacio}</h3>
      <p>${tg.vacioSub}</p>
    </div>
  </section>`;
}

/** Stage strip under a time chart: one button per stage, as wide as its months. */
function franjaEtapas(b: Base, desde: string, hasta: string, activa: string | null): Html {
  const etapas = etapasEnRango(b, desde, hasta);
  if (!etapas.length) return html``;
  const n = (a: string, z: string) => rangoMeses(a, z).length;
  return html`<div class="stages" role="group" aria-label="${tg.etapas}">
    ${etapas.map(
      (e) =>
        html`<button
          class="stage"
          style="flex:${n(e.a, e.z)}"
          data-on="etapa"
          data-id="${e.id}"
          aria-pressed="${activa === e.id}"
          title="${e.nombre}"
        >
          ${e.nombre}
        </button>`,
    )}
  </div>`;
}

/* ---------- 1. Ingresos vs. gastos y sobrante ---------- */
export function grafico1(
  b: Base,
  desde: string,
  hasta: string,
  vista: Vista,
  hoy: string,
  opts: { comparar?: [string, string] | null; etapa?: string | null; id?: string } = {},
): Html {
  const datos = ingresosVsGastos(b, desde, hasta, vista, hoy);
  if (!datos.some((d) => d.ingreso || d.gasto)) return vacioGrafico(tg.t1);
  const juntos = vista === 'juntos';
  const lbl = etiquetas(datos.map((d) => d.mes));
  const ultimo = datos.at(-1) as (typeof datos)[number];
  const conclusion =
    ultimo.sobrante >= 0
      ? tg.sobro(juntos, nombreMes(ultimo.mes), ultimo.sobrante, ultimo.parcial)
      : tg.falto(juntos, nombreMes(ultimo.mes), -ultimo.sobrante);
  const cerrados = datos.filter((d) => !d.parcial);
  let nota =
    cerrados.length > 1
      ? tg.promedio(Math.round(sumCents(cerrados.map((d) => d.sobrante)) / cerrados.length))
      : undefined;
  if (opts.comparar) {
    const prev = ingresosVsGastos(b, opts.comparar[0], opts.comparar[1], vista, hoy);
    const v = variacion(sumCents(datos.map((d) => d.gasto)), sumCents(prev.map((d) => d.gasto)));
    if (v !== null) nota = `Gastos: ${tg.vsAnterior(v)}`;
  }
  const filas = datos.map((d) => ({ m: lbl.get(d.mes) as string, ...d }));
  const id = opts.id ?? 'g1';
  return tarjetaGrafico({
    id,
    titulo: tg.t1,
    conclusion,
    nota,
    leyenda: [
      { k: 'ingreso', label: 'Ingreso', estilo: 'line' },
      { k: vista === 'juntos' ? 'casa' : vista, label: 'Gastos' },
      { k: 'viaje', label: 'Aportes y pagos', estilo: 'striped' },
      { k: 'sobrante', label: 'Sobrante', estilo: 'line' },
    ],
    dibujar: (P, ancho, c) => {
      const kg = vista === 'juntos' ? 'casa' : vista;
      const stack = filas.flatMap((d) => [
        { m: d.m, serie: 'Gastos', v: usd(d.gasto), parcial: d.parcial },
        { m: d.m, serie: 'Aportes', v: usd(d.aportado), parcial: d.parcial },
      ]);
      const svg = P.plot({
        width: ancho,
        height: 240,
        marginLeft: 48,
        style: { color: c.label as string, fontSize: '12px' },
        x: { domain: filas.map((d) => d.m), label: null, padding: 0.25 },
        y: { label: null, grid: true, tickFormat: ejeUSD, ticks: 5 },
        marks: [
          P.barY(stack, {
            x: 'm',
            y: 'v',
            fill: (d: { serie: string }) => (d.serie === 'Gastos' ? c[kg] : 'url(#rayas-viaje)'),
            fillOpacity: (d: { parcial: boolean }) => (d.parcial ? 0.55 : 1),
            insetLeft: 6,
            insetRight: 6,
          }),
          P.barY(filas, {
            x: 'm',
            y: (d: { ingreso: number }) => usd(d.ingreso),
            fill: 'none',
            stroke: c.ingreso,
            strokeWidth: 1.5,
          }),
          P.ruleY([0], { stroke: c.separator }),
          P.line(filas, {
            x: 'm',
            y: (d: { sobrante: number }) => usd(d.sobrante),
            stroke: c.sobrante,
            strokeWidth: 2.5,
            curve: 'monotone-x',
          }),
          P.dot(filas, {
            x: 'm',
            y: (d: { sobrante: number }) => usd(d.sobrante),
            fill: c.surface,
            stroke: c.sobrante,
            strokeWidth: 2,
            r: 3.5,
          }),
        ],
      });
      patrones(svg as SVGSVGElement, c as Colores, ['viaje']);
      return svg;
    },
    scrub: {
      escala: 'x',
      puntos: filas.map((d) => ({
        x: d.m,
        texto: `${mesLargo(d.mes)}${d.parcial ? ` (${tg.enCurso})` : ''}: ingreso ${fmtUSD(d.ingreso, 'whole')}, gastos ${fmtUSD(d.gasto, 'whole')}, aportes ${fmtUSD(d.aportado, 'whole')}, sobrante ${fmtUSD(d.sobrante, 'whole')}`,
      })),
    },
    tabla: {
      cols: ['Mes', 'Ingreso', 'Gastos', 'Aportes', 'Sobrante'],
      filas: datos.map((d) => [
        mesLargo(d.mes),
        fmtUSD(d.ingreso, 'whole'),
        fmtUSD(d.gasto, 'whole'),
        fmtUSD(d.aportado, 'whole'),
        fmtUSD(d.sobrante, 'whole'),
      ]),
    },
    extra: franjaEtapas(b, desde, hasta, opts.etapa ?? null),
  });
}

/* ---------- 2. Gastos por categoría ---------- */
export function grafico2(
  b: Base,
  desde: string,
  hasta: string,
  vista: Vista,
  comparar: [string, string] | null,
): Html {
  const r = gastosPorCategoria(b, desde, hasta, vista);
  if (!r.items.length) return vacioGrafico(tg.t2);
  const top = r.items[0] as (typeof r.items)[number];
  let nota = `Total: ${fmtUSD(r.total, 'whole')}${r.ingreso ? ` · ${pct(r.total / r.ingreso)} del ingreso` : ''}`;
  const prev = comparar ? gastosPorCategoria(b, comparar[0], comparar[1], vista) : null;
  if (prev) {
    const v = variacion(r.total, prev.total);
    if (v !== null) nota += ` · ${tg.vsAnterior(v)}`;
  }
  const filas = r.items.map((x) => ({
    ...x,
    v: usd(x.realCents),
    prev: usd(prev?.items.find((p) => p.clave === x.clave)?.realCents ?? 0),
  }));
  return tarjetaGrafico({
    id: 'g2',
    titulo: tg.t2,
    conclusion: r.ingreso
      ? tg.top(top.nombre, top.pctIngreso)
      : `${top.nombre}: ${fmtUSD(top.realCents, 'whole')}`,
    nota,
    leyenda: prev ? [{ k: 'otra', label: 'Periodo anterior', estilo: 'dashed' }] : undefined,
    dibujar: (P, ancho, c) =>
      P.plot({
        width: ancho,
        height: 40 + filas.length * 40,
        marginLeft: Math.min(150, 12 + Math.max(...filas.map((f) => f.nombre.length)) * 7),
        marginRight: 92,
        style: { color: c.label as string, fontSize: '12px' },
        x: { axis: null },
        y: { domain: filas.map((f) => f.nombre), label: null, tickSize: 0 },
        marks: [
          P.barX(filas, {
            y: 'nombre',
            x: 'v',
            fill: (d: { k: string }) => c[d.k],
            insetTop: 6,
            insetBottom: 6,
            rx: 4,
          }),
          ...(prev
            ? [
                P.tickX(filas, {
                  y: 'nombre',
                  x: 'prev',
                  stroke: c['label-2'],
                  strokeWidth: 2,
                  strokeDasharray: '3,2',
                }),
              ]
            : []),
          P.text(filas, {
            y: 'nombre',
            x: 'v',
            text: (d: { realCents: number; pctIngreso: number }) =>
              `${fmtUSD(d.realCents, 'whole')} · ${pct(d.pctIngreso)}`,
            textAnchor: 'start',
            dx: 6,
            fill: c.label,
          }),
        ],
      }),
    scrub: {
      escala: 'y',
      puntos: filas.map((f) => ({
        x: f.nombre,
        texto: `${f.nombre}: ${fmtUSD(f.realCents)} (${pct(f.pctIngreso)} del ingreso)`,
      })),
    },
    tabla: {
      cols: ['Categoría', 'Gastado', '% del ingreso'],
      filas: r.items.map((x) => [x.nombre, fmtUSD(x.realCents), pct(x.pctIngreso)]),
    },
  });
}

/* ---------- 3. Planificado vs. real ---------- */
export function grafico3(b: Base, desde: string, hasta: string, vista: Vista, id = 'g3'): Html {
  const lineas = planVsReal(b, desde, hasta, vista);
  if (!lineas.length) return vacioGrafico(tg.t3);
  const pasadas = lineas.filter((l) => l.real > l.plan);
  const filas = lineas.map((l) => ({ ...l, p: usd(l.plan), r: usd(l.real), over: l.real > l.plan }));
  return tarjetaGrafico({
    id,
    titulo: tg.t3,
    conclusion: pasadas.length
      ? tg.pasadas(pasadas.length, pasadas.map((l) => l.nombre).join(', '))
      : tg.dentro,
    nota: `Gastado ${fmtUSD(sumCents(lineas.map((l) => l.real)), 'whole')} de ${fmtUSD(sumCents(lineas.map((l) => l.plan)), 'whole')} planificados`,
    leyenda: [
      { k: 'casa', label: 'Gastado' },
      { k: 'ingreso', label: 'Presupuesto', estilo: 'line' },
      { k: 'emergencia', label: 'Pasado', estilo: 'striped' },
    ],
    dibujar: (P, ancho, c) => {
      const svg = P.plot({
        width: ancho,
        height: 30 + filas.length * 34,
        marginLeft: Math.min(130, 12 + Math.max(...filas.map((f) => f.nombre.length)) * 7),
        marginRight: 70,
        style: { color: c.label as string, fontSize: '12px' },
        x: { axis: null },
        y: { domain: filas.map((f) => f.nombre), label: null, tickSize: 0 },
        marks: [
          P.barX(filas, { y: 'nombre', x: 'p', fill: c.fill, insetTop: 7, insetBottom: 7, rx: 3 }),
          P.barX(filas, {
            y: 'nombre',
            x: 'r',
            fill: (d: { over: boolean; k: string }) => (d.over ? 'url(#rayas-emergencia)' : c[d.k]),
            insetTop: 7,
            insetBottom: 7,
            rx: 3,
          }),
          P.tickX(filas, {
            y: 'nombre',
            x: 'p',
            stroke: c.label,
            strokeWidth: 2,
            insetTop: 3,
            insetBottom: 3,
          }),
          P.text(filas, {
            y: 'nombre',
            x: (d: { p: number; r: number }) => Math.max(d.p, d.r),
            text: (d: { real: number; over: boolean }) => `${fmtUSD(d.real, 'whole')}${d.over ? ' ▲' : ''}`,
            textAnchor: 'start',
            dx: 6,
            fill: (d: { over: boolean }) => (d.over ? c.bad : c['label-2']),
            fontWeight: 600,
          }),
        ],
      });
      patrones(svg as SVGSVGElement, c as Colores, ['emergencia']);
      return svg;
    },
    scrub: {
      escala: 'y',
      puntos: filas.map((f) => ({
        x: f.nombre,
        texto: `${f.nombre}: ${fmtUSD(f.real)} de ${fmtUSD(f.plan, 'whole')}${f.over ? ` (pasado por ${fmtUSD(f.real - f.plan)})` : ''}`,
      })),
    },
    tabla: {
      cols: ['Categoría', 'Presupuesto', 'Gastado', 'Diferencia'],
      filas: lineas.map((l) => [l.nombre, fmtUSD(l.plan, 'whole'), fmtUSD(l.real), fmtUSD(l.plan - l.real)]),
    },
  });
}

/* ---------- 4. Progreso de metas ---------- */
export function grafico4(
  b: Base,
  desde: string,
  hasta: string,
  vista: Vista,
  opts: { etapa?: string | null; id?: string } = {},
): Html {
  const series = progresoMetas(b, desde, hasta, vista);
  if (!series.length) return vacioGrafico(tg.t4);
  const meses = rangoMeses(desde, hasta);
  const lbl = etiquetas(meses);
  const conTope = series.filter((s) => s.pct !== null).sort((a, z) => (a.pct as number) - (z.pct as number));
  const conclusion = conTope.length
    ? tg.meta(conTope[0]?.meta.nombre as string, conTope[0]?.pct as number)
    : tg.metaSinTope(sumCents(series.map((s) => s.saldo)));
  const puntos = series.flatMap((s, i) =>
    s.puntos.map((p) => ({
      m: lbl.get(p.mes) as string,
      mes: p.mes,
      v: usd(p.saldo),
      meta: s.meta.nombre,
      k: s.meta.tipo,
      i,
    })),
  );
  const topes = series
    .filter((s) => s.meta.topeCents)
    .map((s) => ({ meta: s.meta.nombre, k: s.meta.tipo, v: usd(s.meta.topeCents as number) }));
  return tarjetaGrafico({
    id: opts.id ?? 'g4',
    titulo: tg.t4,
    conclusion,
    nota: topes.length ? 'La línea punteada es el tope de cada fondo' : undefined,
    leyenda: series.map((s) => ({
      k: s.meta.tipo,
      label: `${s.meta.nombre}${s.pct !== null ? ` · ${pct(s.pct)}` : ''}`,
      estilo: 'line' as const,
    })),
    dibujar: (P, ancho, c) =>
      P.plot({
        width: ancho,
        height: 240,
        marginLeft: 48,
        style: { color: c.label as string, fontSize: '12px' },
        x: { domain: meses.map((m) => lbl.get(m) as string), label: null },
        y: { label: null, grid: true, tickFormat: ejeUSD, ticks: 5, zero: true },
        color: {
          domain: series.map((s) => s.meta.nombre),
          range: series.map((s) => c[s.meta.tipo] as string),
        },
        symbol: {
          domain: series.map((s) => s.meta.nombre),
          range: series.map((_, i) => SIMBOLOS[i % SIMBOLOS.length] as string),
        },
        marks: [
          P.ruleY(topes, { y: 'v', stroke: 'meta', strokeDasharray: '4,3', strokeOpacity: 0.8 }),
          P.line(puntos, { x: 'm', y: 'v', stroke: 'meta', strokeWidth: 2.5, curve: 'monotone-x' }),
          P.dot(puntos, {
            x: 'm',
            y: 'v',
            stroke: 'meta',
            fill: c.surface,
            symbol: 'meta',
            r: 3.5,
            strokeWidth: 1.8,
          }),
        ],
      }),
    scrub: {
      escala: 'x',
      puntos: meses.map((m) => ({
        x: lbl.get(m) as string,
        texto: `${mesLargo(m)}: ${series.map((s) => `${s.meta.nombre} ${fmtUSD(s.puntos.find((p) => p.mes === m)?.saldo ?? 0, 'whole')}`).join(', ')}`,
      })),
    },
    tabla: {
      cols: ['Mes', ...series.map((s) => s.meta.nombre)],
      filas: meses.map((m) => [
        mesLargo(m),
        ...series.map((s) => fmtUSD(s.puntos.find((p) => p.mes === m)?.saldo ?? 0, 'whole')),
      ]),
    },
    extra: franjaEtapas(b, desde, hasta, opts.etapa ?? null),
  });
}

/* ---------- 5. Saldo de deudas ---------- */
export function grafico5(b: Base, desde: string, hasta: string, vista: Vista, id = 'g5'): Html {
  const series = saldoDeudas(b, desde, hasta, vista).filter((s) => s.puntos.length);
  if (!series.length) return html``;
  const meses = rangoMeses(series.map((s) => s.puntos[0]?.mes as string).sort()[0] as string, hasta);
  const lbl = etiquetas(meses);
  const pendientes = series.filter((s) => s.saldo > 0);
  const proxima = pendientes
    .filter((s) => s.estimado)
    .sort((a, z) => (a.estimado as string).localeCompare(z.estimado as string))[0];
  const conclusion = !pendientes.length
    ? tg.deudasPagadas
    : proxima
      ? tg.deudaFin(proxima.deuda.nombre, mesLargo(proxima.estimado as string))
      : tg.deudasSinRitmo;
  const fmtSaldo = (s: (typeof series)[number], c: Cents) =>
    s.deuda.moneda === 'USD' ? fmtUSD(c, 'whole') : fmtBs(c);
  const puntos = series.flatMap((s) =>
    s.puntos.map((p) => ({ m: lbl.get(p.mes) as string, v: p.restante, deuda: s.deuda.nombre })),
  );
  const colores = ['carlos', 'sofia', 'imprevisto', 'inversion'];
  return tarjetaGrafico({
    id,
    titulo: tg.t5,
    conclusion,
    nota: 'Porcentaje que queda de cada deuda, para comparar deudas en dólares y en bolívares',
    leyenda: series.map((s, i) => ({
      k: colores[i % colores.length] as string,
      label: `${s.deuda.nombre}: ${fmtSaldo(s, s.saldo)}`,
      estilo: 'line' as const,
    })),
    dibujar: (P, ancho, c) =>
      P.plot({
        width: ancho,
        height: 200,
        marginLeft: 44,
        style: { color: c.label as string, fontSize: '12px' },
        x: { domain: meses.map((m) => lbl.get(m) as string), label: null },
        y: { domain: [0, 1], label: null, grid: true, tickFormat: (v: number) => pct(v), ticks: 4 },
        color: {
          domain: series.map((s) => s.deuda.nombre),
          range: series.map((_, i) => c[colores[i % colores.length] as string] as string),
        },
        symbol: {
          domain: series.map((s) => s.deuda.nombre),
          range: series.map((_, i) => SIMBOLOS[i % SIMBOLOS.length] as string),
        },
        marks: [
          P.ruleY([0], { stroke: c.separator }),
          P.line(puntos, { x: 'm', y: 'v', stroke: 'deuda', strokeWidth: 2.5 }),
          P.dot(puntos, {
            x: 'm',
            y: 'v',
            stroke: 'deuda',
            fill: c.surface,
            symbol: 'deuda',
            r: 3.5,
            strokeWidth: 1.8,
          }),
        ],
      }),
    scrub: {
      escala: 'x',
      puntos: meses.map((m) => ({
        x: lbl.get(m) as string,
        texto: `${mesLargo(m)}: ${series
          .map((s) => {
            const p = s.puntos.find((q) => q.mes === m);
            return p ? `${s.deuda.nombre} ${fmtSaldo(s, p.saldo)}` : '';
          })
          .filter(Boolean)
          .join(', ')}`,
      })),
    },
    tabla: {
      cols: ['Mes', ...series.map((s) => s.deuda.nombre)],
      filas: meses.map((m) => [
        mesLargo(m),
        ...series.map((s) => {
          const p = s.puntos.find((q) => q.mes === m);
          return p ? fmtSaldo(s, p.saldo) : '—';
        }),
      ]),
    },
  });
}
