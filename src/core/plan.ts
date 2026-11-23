/**
 * Plan formulas. These keep the results of the original app:
 * - shared costs (house + unexpected) split by income, rounded to whole dollars, the rest to Sofía;
 * - one transfer evens out who paid which shared bill;
 * - leftover = income − share of the house − own fixed + free spending − own contributions.
 */
import { splitProportional, sumCents, type Cents } from './money';
import {
  AJUSTE_CASA,
  PERSONAS,
  mesDe,
  otra,
  type AporteMes,
  type Categoria,
  type Deuda,
  type Meta,
  type Movimiento,
  type Persona,
  type Plan,
} from './model';

/** The plan in force for a month: the latest version starting on or before it, else the earliest one. */
export function planDelMes(versiones: readonly Plan[], mes: string): Plan | null {
  if (!versiones.length) return null;
  const orden = [...versiones].sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
  let elegido = orden[0] as Plan;
  for (const v of orden) if (v.vigenteDesde <= mes) elegido = v;
  return elegido;
}

const activas = (cats: readonly Categoria[]) => cats.filter((c) => !c.archivada);

export function categoriasCompartidas(cats: readonly Categoria[]): Categoria[] {
  return activas(cats).filter((c) => c.grupo === 'casa' || c.grupo === 'imprevisto');
}

export function categoriasDe(cats: readonly Categoria[], p: Persona): Categoria[] {
  return activas(cats).filter((c) => c.grupo === 'personal' && c.persona === p);
}

const presupuestoDe = (plan: Plan, cs: readonly Categoria[]): Cents =>
  sumCents(cs.map((c) => plan.presupuesto[c.id]));

export function totalCompartido(plan: Plan, cats: readonly Categoria[]): Cents {
  return presupuestoDe(plan, categoriasCompartidas(cats));
}

export function totalGrupo(plan: Plan, cats: readonly Categoria[], grupo: 'casa' | 'imprevisto'): Cents {
  return presupuestoDe(
    plan,
    activas(cats).filter((c) => c.grupo === grupo),
  );
}

export function presupuestoPersonal(plan: Plan, cats: readonly Categoria[], p: Persona): Cents {
  return presupuestoDe(plan, categoriasDe(cats, p));
}

/** Each person's share of the shared budget. */
export function partesCasa(plan: Plan, cats: readonly Categoria[]): Record<Persona, Cents> {
  const total = totalCompartido(plan, cats);
  let carlos: Cents, sofia: Cents;
  const r = plan.reparto;
  if (r.tipo === 'proporcional' && plan.ingresos.carlos + plan.ingresos.sofia <= 0) {
    // Original app: with no incomes Carlos's share rounds to 0 and Sofía takes the rest.
    [carlos, sofia] = [0, total];
  } else if (r.tipo === 'proporcional') {
    // Whole dollars, as the original app did.
    [carlos, sofia] = splitProportional(total, [plan.ingresos.carlos, plan.ingresos.sofia], 100) as [
      number,
      number,
    ];
  } else if (r.tipo === 'mitad') {
    [carlos, sofia] = splitProportional(total, [1, 1]) as [number, number];
  } else {
    const pct = Math.min(100, Math.max(0, r.carlosPct));
    [carlos, sofia] = splitProportional(total, [pct, 100 - pct]) as [number, number];
  }
  return { carlos, sofia };
}

/** The transfer that evens out the shared bills each person pays from their own account. */
export function ajusteCasa(plan: Plan, cats: readonly Categoria[]): { de: Persona; montoCents: Cents } {
  const pagadoPorCarlos = sumCents(
    categoriasCompartidas(cats)
      .filter((c) => (plan.pagosCompartidos[c.id] ?? plan.pagaResto) === 'carlos')
      .map((c) => plan.presupuesto[c.id]),
  );
  const d = partesCasa(plan, cats).carlos - pagadoPorCarlos;
  return { de: d >= 0 ? 'carlos' : 'sofia', montoCents: Math.abs(d) };
}

/** Planned monthly contributions of a person, only the ones above zero. */
export function aportesPlan(plan: Plan, p: Persona): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const [k, v] of Object.entries(plan.aportes[p] ?? {})) if (v > 0) out[k] = v;
  return out;
}

export function sobrante(plan: Plan, cats: readonly Categoria[], p: Persona): Cents {
  return (
    plan.ingresos[p] -
    partesCasa(plan, cats)[p] -
    presupuestoPersonal(plan, cats, p) -
    sumCents(Object.values(aportesPlan(plan, p)))
  );
}

export interface ItemChecklist {
  persona: Persona;
  clave: string;
  tipo: 'meta' | 'deuda' | 'ajuste';
  montoCents: Cents;
  hecho: boolean;
}

export function checklistDe(
  plan: Plan,
  cats: readonly Categoria[],
  aportes: readonly AporteMes[],
  mes: string,
  p: Persona,
  deudas: readonly Deuda[],
): ItemChecklist[] {
  const marcado = (k: string) =>
    aportes.some((a) => a.mes === mes && a.persona === p && a.clave === k && a.hecho);
  const esDeuda = new Set(deudas.map((d) => d.id));
  const items: ItemChecklist[] = Object.entries(aportesPlan(plan, p)).map(([k, v]) => ({
    persona: p,
    clave: k,
    tipo: esDeuda.has(k) ? 'deuda' : 'meta',
    montoCents: v,
    hecho: marcado(k),
  }));
  const aj = ajusteCasa(plan, cats);
  if (aj.de === p && aj.montoCents > 0)
    items.push({
      persona: p,
      clave: AJUSTE_CASA,
      tipo: 'ajuste',
      montoCents: aj.montoCents,
      hecho: marcado(AJUSTE_CASA),
    });
  return items;
}

export function itemHecho(aportes: readonly AporteMes[], mes: string, p: Persona, clave: string): boolean {
  return aportes.some((a) => a.mes === mes && a.persona === p && a.clave === clave && a.hecho);
}

/** Real dollars spent per category in a month (only movements of type 'gasto'). */
export function gastadoPorCategoria(movs: readonly Movimiento[], mes: string): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const x of movs)
    if (x.tipo === 'gasto' && x.categoriaId && mesDe(x.fecha) === mes)
      m.set(x.categoriaId, (m.get(x.categoriaId) ?? 0) + x.realCents);
  return m;
}

export function gastadoEn(movs: readonly Movimiento[], mes: string, cs: readonly Categoria[]): Cents {
  const g = gastadoPorCategoria(movs, mes);
  return sumCents(cs.map((c) => g.get(c.id)));
}

/** Names of the categories of a set that went over budget this month. */
export function categoriasPasadas(
  plan: Plan,
  movs: readonly Movimiento[],
  mes: string,
  cs: readonly Categoria[],
): Categoria[] {
  const g = gastadoPorCategoria(movs, mes);
  return cs.filter((c) => (g.get(c.id) ?? 0) > (plan.presupuesto[c.id] ?? 0));
}

export interface SaldoMeta {
  saldoCents: Cents;
  inicialCents: Cents;
  aportadoCents: Record<Persona, Cents>;
  retiradoCents: Cents;
}

/**
 * Goal balance up to and including a month: starting balance + ticked monthly contributions
 * + extra contributions (minus the part that already ticked the checklist) − withdrawals.
 */
export function saldoMeta(
  meta: Meta,
  aportes: readonly AporteMes[],
  movs: readonly Movimiento[],
  hastaMes = '9999-12',
): SaldoMeta {
  const aportado: Record<Persona, Cents> = { carlos: 0, sofia: 0 };
  for (const a of aportes)
    if (a.clave === meta.id && a.hecho && a.mes <= hastaMes) aportado[a.persona] += a.montoCents;
  let retirado = 0;
  for (const x of movs) {
    if (x.metaId !== meta.id || mesDe(x.fecha) > hastaMes) continue;
    if (x.tipo === 'aporte') {
      const cubierto = itemHecho(aportes, mesDe(x.fecha), x.persona, meta.id) ? x.planCubiertoCents : 0;
      aportado[x.persona] += x.realCents - cubierto;
    } else if (x.tipo === 'retiro') retirado += x.realCents;
  }
  return {
    saldoCents: meta.saldoInicialCents + aportado.carlos + aportado.sofia - retirado,
    inicialCents: meta.saldoInicialCents,
    aportadoCents: aportado,
    retiradoCents: retirado,
  };
}

export interface SaldoDeuda {
  /** Remaining balance in the debt's currency, never below zero. */
  saldoCents: Cents;
  /** Paid so far in real US cents. */
  pagadoRealCents: Cents;
}

export function saldoDeuda(
  deuda: Deuda,
  aportes: readonly AporteMes[],
  movs: readonly Movimiento[],
  hastaMes = '9999-12',
): SaldoDeuda {
  const desde = mesDe(deuda.fechaSaldo);
  let baja = 0,
    pagadoReal = 0;
  for (const a of aportes) {
    if (a.clave !== deuda.id || !a.hecho || a.mes < desde || a.mes > hastaMes) continue;
    pagadoReal += a.montoCents;
    baja += deuda.moneda === 'USD' ? a.montoCents : Math.round(a.montoCents * (a.tasaCompra ?? 0));
  }
  for (const x of movs) {
    if (
      x.tipo !== 'pago_deuda' ||
      x.deudaId !== deuda.id ||
      x.fecha < deuda.fechaSaldo ||
      mesDe(x.fecha) > hastaMes
    )
      continue;
    pagadoReal += x.realCents;
    if (deuda.moneda === 'USD') baja += x.realCents;
    else baja += x.bsCents ?? Math.round(x.realCents * (x.tasaCompra ?? 0));
  }
  return { saldoCents: Math.max(0, deuda.saldoInicialCents - baja), pagadoRealCents: pagadoReal };
}

export const sobrantes = (plan: Plan, cats: readonly Categoria[]): Record<Persona, Cents> => ({
  carlos: sobrante(plan, cats, 'carlos'),
  sofia: sobrante(plan, cats, 'sofia'),
});

export { PERSONAS, otra };
