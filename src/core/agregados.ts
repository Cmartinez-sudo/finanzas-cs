/**
 * Chart data. Pure functions over the domain data, kept apart from the views so they can be tested.
 * All amounts are real-dollar cents. A person's view counts their own categories plus their share
 * of shared spending (the same share the plan gives them of the house budget that month).
 */
import { rangoMeses, sumarMeses } from './fechas';
import { roundHalfAway, sumCents, type Cents } from './money';
import {
  AJUSTE_CASA,
  mesDe,
  type AporteMes,
  type Categoria,
  type Deuda,
  type Etapa,
  type Meta,
  type Movimiento,
  type Persona,
  type Plan,
} from './model';
import { partesCasa, planDelMes, saldoDeuda, saldoMeta, totalCompartido } from './plan';

export type Vista = 'juntos' | Persona;

export interface Base {
  planes: readonly Plan[];
  categorias: readonly Categoria[];
  metas: readonly Meta[];
  deudas: readonly Deuda[];
  movimientos: readonly Movimiento[];
  aportes: readonly AporteMes[];
  etapas: readonly Etapa[];
}

/** Share of shared spending that belongs to a person in a month (0..1). */
export function fraccionCompartida(b: Base, mes: string, p: Persona): number {
  const plan = planDelMes(b.planes, mes);
  if (!plan) return 0.5;
  const total = totalCompartido(plan, b.categorias);
  return total > 0 ? partesCasa(plan, b.categorias)[p] / total : 0.5;
}

function indiceCategorias(b: Base) {
  return new Map(b.categorias.map((c) => [c.id, c]));
}

/** Real spending of a movement as seen from a view (whole, a share, or nothing). */
function pesoGasto(b: Base, cats: Map<string, Categoria>, m: Movimiento, vista: Vista): number {
  if (m.tipo !== 'gasto') return 0;
  if (vista === 'juntos') return 1;
  const c = m.categoriaId ? cats.get(m.categoriaId) : undefined;
  if (!c || c.grupo === 'personal') return (c?.persona ?? m.persona) === vista ? 1 : 0;
  return fraccionCompartida(b, mesDe(m.fecha), vista);
}

/** Money put into goals and debts in a month (ticked checklist + extras + debt payments). */
export function aportadoMes(b: Base, mes: string, vista: Vista): Cents {
  const quien = (p: Persona) => vista === 'juntos' || vista === p;
  let t = 0;
  for (const a of b.aportes)
    if (a.mes === mes && a.hecho && a.clave !== AJUSTE_CASA && quien(a.persona)) t += a.montoCents;
  for (const m of b.movimientos) {
    if (mesDe(m.fecha) !== mes || !quien(m.persona)) continue;
    if (m.tipo === 'aporte') {
      const marcado = b.aportes.some(
        (a) => a.mes === mes && a.persona === m.persona && a.clave === m.metaId && a.hecho,
      );
      t += m.realCents - (marcado ? m.planCubiertoCents : 0);
    } else if (m.tipo === 'pago_deuda') t += m.realCents;
  }
  return t;
}

export interface PuntoMes {
  mes: string;
  ingreso: Cents;
  gasto: Cents;
  aportado: Cents;
  /** ingreso − gasto − aportado */
  sobrante: Cents;
  parcial: boolean;
}

/** Chart 1: income vs spending per month and what was left. */
export function ingresosVsGastos(
  b: Base,
  desde: string,
  hasta: string,
  vista: Vista,
  mesHoy: string,
): PuntoMes[] {
  const cats = indiceCategorias(b);
  const gastos = new Map<string, number>();
  for (const m of b.movimientos) {
    const w = pesoGasto(b, cats, m, vista);
    if (w) gastos.set(mesDe(m.fecha), (gastos.get(mesDe(m.fecha)) ?? 0) + m.realCents * w);
  }
  return rangoMeses(desde, hasta)
    .filter((mes) => mes <= mesHoy)
    .map((mes) => {
      const plan = planDelMes(b.planes, mes);
      const ingreso = plan
        ? vista === 'juntos'
          ? plan.ingresos.carlos + plan.ingresos.sofia
          : plan.ingresos[vista]
        : 0;
      const gasto = roundHalfAway(gastos.get(mes) ?? 0);
      const aportado = aportadoMes(b, mes, vista);
      return { mes, ingreso, gasto, aportado, sobrante: ingreso - gasto - aportado, parcial: mes === mesHoy };
    });
}

export interface PorCategoria {
  clave: string;
  nombre: string;
  /** Color key: casa, imprevisto, carlos, sofia */
  k: string;
  realCents: Cents;
  /** Share of income in the period, 0..1 */
  pctIngreso: number;
}

/** Chart 2: where the money goes. Together: by group. One person: their categories + their part of shared. */
export function gastosPorCategoria(
  b: Base,
  desde: string,
  hasta: string,
  vista: Vista,
): { items: PorCategoria[]; total: Cents; ingreso: Cents } {
  const cats = indiceCategorias(b);
  const acc = new Map<string, { nombre: string; k: string; v: number }>();
  const sumar = (clave: string, nombre: string, k: string, v: number) => {
    const x = acc.get(clave) ?? { nombre, k, v: 0 };
    x.v += v;
    acc.set(clave, x);
  };
  for (const m of b.movimientos) {
    const mes = mesDe(m.fecha);
    if (m.tipo !== 'gasto' || mes < desde || mes > hasta) continue;
    const c = m.categoriaId ? cats.get(m.categoriaId) : undefined;
    const w = pesoGasto(b, cats, m, vista);
    if (!w || !c) continue;
    const v = m.realCents * w;
    if (vista === 'juntos') {
      if (c.grupo === 'personal')
        sumar(
          `p-${c.persona}`,
          `Fijos + libre de ${c.persona === 'carlos' ? 'Carlos' : 'Sofía'}`,
          c.persona as string,
          v,
        );
      else sumar(c.grupo, c.grupo === 'casa' ? 'Casa' : 'Imprevistos', c.grupo, v);
    } else if (c.grupo === 'personal') sumar(c.id, c.nombre, vista, v);
    else sumar(c.grupo, c.grupo === 'casa' ? 'Casa (tu parte)' : 'Imprevistos (tu parte)', c.grupo, v);
  }
  const ingreso = sumCents(
    rangoMeses(desde, hasta).map((mes) => {
      const p = planDelMes(b.planes, mes);
      return p ? (vista === 'juntos' ? p.ingresos.carlos + p.ingresos.sofia : p.ingresos[vista]) : 0;
    }),
  );
  const items = [...acc.entries()]
    .map(([clave, x]) => ({
      clave,
      nombre: x.nombre,
      k: x.k,
      realCents: roundHalfAway(x.v),
      pctIngreso: ingreso ? x.v / ingreso : 0,
    }))
    .filter((x) => x.realCents > 0)
    .sort((a, z) => z.realCents - a.realCents);
  return { items, total: sumCents(items.map((x) => x.realCents)), ingreso };
}

export interface LineaPlan {
  id: string;
  nombre: string;
  k: string;
  plan: Cents;
  real: Cents;
}

/** Chart 3: budget vs actual per category in a range of months (budgets add up month by month). */
export function planVsReal(b: Base, desde: string, hasta: string, vista: Vista): LineaPlan[] {
  const meses = rangoMeses(desde, hasta);
  const cats = b.categorias.filter(
    (c) => !c.archivada && (c.grupo !== 'personal' || vista === 'juntos' || c.persona === vista),
  );
  const real = new Map<string, number>();
  for (const m of b.movimientos) {
    const mes = mesDe(m.fecha);
    if (m.tipo === 'gasto' && m.categoriaId && mes >= desde && mes <= hasta)
      real.set(m.categoriaId, (real.get(m.categoriaId) ?? 0) + m.realCents);
  }
  return cats
    .map((c) => ({
      id: c.id,
      // Together, both people may have a 'Gym': add the name so rows stay distinct.
      nombre:
        vista === 'juntos' && c.persona
          ? `${c.nombre} · ${c.persona === 'carlos' ? 'Carlos' : 'Sofía'}`
          : c.nombre,
      k: c.grupo === 'personal' ? (c.persona as string) : c.grupo,
      plan: sumCents(meses.map((mes) => planDelMes(b.planes, mes)?.presupuesto[c.id])),
      real: real.get(c.id) ?? 0,
    }))
    .filter((x) => x.plan > 0 || x.real > 0)
    .sort((a, z) => z.plan - a.plan || z.real - a.real);
}

export interface SerieMeta {
  meta: Meta;
  puntos: Array<{ mes: string; saldo: Cents }>;
  saldo: Cents;
  pct: number | null;
}

/** Chart 4: each goal's balance at the end of every month, against its cap. */
export function progresoMetas(b: Base, desde: string, hasta: string, vista: Vista): SerieMeta[] {
  return b.metas
    .filter((m) => !m.archivada && (vista === 'juntos' || m.persona === null || m.persona === vista))
    .sort((a, z) => a.orden - z.orden)
    .map((meta) => {
      const puntos = rangoMeses(desde, hasta).map((mes) => ({
        mes,
        saldo: saldoMeta(meta, b.aportes, b.movimientos, mes).saldoCents,
      }));
      const saldo = puntos.at(-1)?.saldo ?? meta.saldoInicialCents;
      return {
        meta,
        puntos,
        saldo,
        pct: meta.topeCents ? Math.min(1, Math.max(0, saldo / meta.topeCents)) : null,
      };
    });
}

export interface SerieDeuda {
  deuda: Deuda;
  /** Remaining balance in the debt's currency and as a share of the starting balance */
  puntos: Array<{ mes: string; saldo: Cents; restante: number }>;
  saldo: Cents;
  /** Estimated payoff month at the pace of the last three months, null if paid or not moving */
  estimado: string | null;
}

/** Chart 5: debts going down. Lines are % remaining so dollar and bolívar debts share one axis. */
export function saldoDeudas(b: Base, desde: string, hasta: string, vista: Vista): SerieDeuda[] {
  return b.deudas
    .filter((x) => !x.archivada && (vista === 'juntos' || x.persona === vista))
    .map((deuda) => {
      const inicio = mesDe(deuda.fechaSaldo);
      const puntos = rangoMeses(desde < inicio ? inicio : desde, hasta).map((mes) => {
        const saldo = saldoDeuda(deuda, b.aportes, b.movimientos, mes).saldoCents;
        return { mes, saldo, restante: deuda.saldoInicialCents ? saldo / deuda.saldoInicialCents : 0 };
      });
      const saldo = puntos.at(-1)?.saldo ?? deuda.saldoInicialCents;
      let estimado: string | null = null;
      if (saldo > 0 && puntos.length >= 2) {
        const atras = puntos.at(-Math.min(4, puntos.length)) as { saldo: number };
        const pasos = Math.min(3, puntos.length - 1);
        const ritmo = (atras.saldo - saldo) / pasos;
        if (ritmo > 0) estimado = sumarMeses(hasta, Math.ceil(saldo / ritmo));
      }
      return { deuda, puntos, saldo, estimado };
    });
}

/** Stage labels over a range of months, clipped to it. */
export function etapasEnRango(
  b: Base,
  desde: string,
  hasta: string,
): Array<Etapa & { a: string; z: string }> {
  return b.etapas
    .map((e) => ({
      ...e,
      a: e.desde < desde ? desde : e.desde,
      z: !e.hasta || e.hasta > hasta ? hasta : e.hasta,
    }))
    .filter((e) => e.a <= e.z)
    .sort((x, y) => x.a.localeCompare(y.a));
}

/** Change between two totals as a fraction (−0.12 = 12 % less), null when there is nothing to compare. */
export function variacion(actual: Cents, anterior: Cents): number | null {
  return anterior > 0 ? (actual - anterior) / anterior : null;
}
