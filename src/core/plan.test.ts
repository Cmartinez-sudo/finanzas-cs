import { describe, expect, it } from 'vitest';
import { CATEGORIAS, DEUDAS, METAS, PLAN } from './fixtures';
import { AJUSTE_CASA, type AporteMes, type Movimiento, type Plan } from './model';
import {
  ajusteCasa,
  categoriasPasadas,
  checklistDe,
  gastadoPorCategoria,
  partesCasa,
  planDelMes,
  saldoDeuda,
  saldoMeta,
  sobrante,
  totalCompartido,
} from './plan';

/* Verbatim copy of the original formulas (index.html:472-505), working in dollars. */
function legacy(plan: Plan) {
  const d = (c: number) => c / 100;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + (+b || 0), 0);
  const pick = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, d(plan.presupuesto[id] ?? 0)]));
  const ids = (f: (c: (typeof CATEGORIAS)[number]) => boolean) => CATEGORIAS.filter(f).map((c) => c.id);
  const cfg = {
    ingresos: { carlos: d(plan.ingresos.carlos), sofia: d(plan.ingresos.sofia) },
    presupuesto: {
      casa: pick(ids((c) => c.grupo === 'casa')),
      imprevisto: pick(ids((c) => c.grupo === 'imprevisto')),
      carlos: pick(ids((c) => c.persona === 'carlos')),
      sofia: pick(ids((c) => c.persona === 'sofia')),
    },
    aportes: {
      carlos: Object.fromEntries(Object.entries(plan.aportes.carlos).map(([k, v]) => [k, d(v)])),
      sofia: Object.fromEntries(Object.entries(plan.aportes.sofia).map(([k, v]) => [k, d(v)])),
    },
  };
  const totalCompartido = () => sum(cfg.presupuesto.casa) + sum(cfg.presupuesto.imprevisto);
  function casaShare(p: 'carlos' | 'sofia') {
    const tot = totalCompartido(),
      ing = cfg.ingresos;
    const s = Math.round((tot * ing.carlos) / (ing.carlos + ing.sofia || 1));
    return p === 'carlos' ? s : tot - s;
  }
  function ajusteCasa() {
    const dd = casaShare('carlos') - (+(cfg.presupuesto.casa.renta ?? 0) || 0);
    return { de: dd >= 0 ? 'carlos' : 'sofia', monto: Math.abs(dd) };
  }
  const planAportes = (p: 'carlos' | 'sofia') => Object.values(cfg.aportes[p]).filter((v) => v > 0);
  const sobrante = (p: 'carlos' | 'sofia') =>
    cfg.ingresos[p] - casaShare(p) - sum(cfg.presupuesto[p]) - planAportes(p).reduce((a, b) => a + b, 0);
  return { totalCompartido, casaShare, ajusteCasa, sobrante };
}

const conIngresos = (carlos: number, sofia: number): Plan => ({ ...PLAN, ingresos: { carlos, sofia } });

describe('plan formulas match the original app', () => {
  const casos: Array<[number, number]> = [
    [285_000, 262_500],
    [330_000, 300_000],
    [100_000, 0],
    [123_400, 98_700],
    [500_000, 500_000],
    [0, 0],
  ];
  it.each(casos)('incomes %d / %d', (c, s) => {
    const plan = conIngresos(c, s);
    const old = legacy(plan);
    expect(totalCompartido(plan, CATEGORIAS)).toBe(old.totalCompartido() * 100);
    expect(partesCasa(plan, CATEGORIAS)).toEqual({
      carlos: old.casaShare('carlos') * 100,
      sofia: old.casaShare('sofia') * 100,
    });
    expect(ajusteCasa(plan, CATEGORIAS)).toEqual({
      de: old.ajusteCasa().de,
      montoCents: Math.round(old.ajusteCasa().monto * 100),
    });
    expect(sobrante(plan, CATEGORIAS, 'carlos')).toBe(Math.round(old.sobrante('carlos') * 100));
    expect(sobrante(plan, CATEGORIAS, 'sofia')).toBe(Math.round(old.sobrante('sofia') * 100));
  });
});

describe('house split rules', () => {
  it('splits in half', () =>
    expect(partesCasa({ ...PLAN, reparto: { tipo: 'mitad' } }, CATEGORIAS)).toEqual({
      carlos: 88_750,
      sofia: 88_750,
    }));
  it('splits by a manual percentage', () =>
    expect(partesCasa({ ...PLAN, reparto: { tipo: 'manual', carlosPct: 60 } }, CATEGORIAS)).toEqual({
      carlos: 106_500,
      sofia: 71_000,
    }));
  it('ignores archived categories', () => {
    const cats = CATEGORIAS.map((c) => (c.id === 'mascota' ? { ...c, archivada: true } : c));
    expect(totalCompartido(PLAN, cats)).toBe(177_500 - 9_000);
  });
});

describe('planDelMes (versioned plan)', () => {
  const v1 = { ...PLAN, vigenteDesde: '2026-01' };
  const v2 = { ...PLAN, vigenteDesde: '2026-06', ingresos: { carlos: 1, sofia: 1 } };
  it('picks the latest version that started on or before the month', () => {
    expect(planDelMes([v2, v1], '2026-05')).toBe(v1);
    expect(planDelMes([v2, v1], '2026-06')).toBe(v2);
    expect(planDelMes([v2, v1], '2027-01')).toBe(v2);
  });
  it('uses the earliest version for months before any plan', () =>
    expect(planDelMes([v2, v1], '2025-12')).toBe(v1));
  it('returns null without versions', () => expect(planDelMes([], '2026-01')).toBeNull());
});

const mov = (o: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(36),
  fecha: '2026-11-10',
  tipo: 'gasto',
  persona: 'carlos',
  categoriaId: null,
  metaId: null,
  deudaId: null,
  moneda: 'USD',
  montoCents: 0,
  tasaBcv: null,
  tasaCompra: null,
  tasaManual: false,
  realCents: 0,
  bsCents: null,
  ahorroCents: 0,
  nota: '',
  planCubiertoCents: 0,
  creadoEn: 0,
  ...o,
});
const ap = (o: Partial<AporteMes>): AporteMes => ({
  mes: '2026-11',
  persona: 'carlos',
  clave: 'viaje',
  montoCents: 15_000,
  hecho: true,
  tasaCompra: null,
  ...o,
});

describe('checklist', () => {
  it('lists planned contributions, debts and the house transfer for the payer', () => {
    const items = checklistDe(PLAN, CATEGORIAS, [ap({})], '2026-11', 'carlos', DEUDAS);
    expect(items.map((i) => [i.clave, i.tipo, i.hecho])).toEqual([
      ['viaje', 'meta', true],
      ['emergencia', 'meta', false],
      ['inv-carlos', 'meta', false],
      ['deuda-carlos', 'deuda', false],
      [AJUSTE_CASA, 'ajuste', false],
    ]);
    // Carlos's share 924 − rent 850 = 74 to Sofía
    expect(items.at(-1)?.montoCents).toBe(7_400);
    expect(
      checklistDe(PLAN, CATEGORIAS, [], '2026-11', 'sofia', DEUDAS).some((i) => i.tipo === 'ajuste'),
    ).toBe(false);
  });
});

describe('spending', () => {
  const movs = [
    mov({ categoriaId: 'mercado', realCents: 30_000 }),
    mov({ categoriaId: 'mercado', realCents: 20_000 }),
    mov({ categoriaId: 'luz', realCents: 1_000, fecha: '2026-10-30' }),
    mov({ tipo: 'aporte', metaId: 'viaje', realCents: 99_999 }),
  ];
  it('adds real dollars per category for the month only', () => {
    const g = gastadoPorCategoria(movs, '2026-11');
    expect(g.get('mercado')).toBe(50_000);
    expect(g.has('luz')).toBe(false);
    expect(g.size).toBe(1);
  });
  it('flags categories over budget', () =>
    expect(categoriasPasadas(PLAN, movs, '2026-11', CATEGORIAS).map((c) => c.id)).toEqual(['mercado']));
});

describe('goal and debt balances', () => {
  const viaje = METAS[0] as (typeof METAS)[number];
  it('adds ticked contributions and extras, minus the covered part and withdrawals', () => {
    const aportes = [ap({}), ap({ persona: 'sofia', mes: '2026-10' })];
    const movs = [
      mov({ tipo: 'aporte', metaId: 'viaje', realCents: 20_000, planCubiertoCents: 15_000 }), // ticked Nov: +5,000 extra
      mov({ tipo: 'retiro', metaId: 'viaje', realCents: 4_000 }),
    ];
    const s = saldoMeta({ ...viaje, saldoInicialCents: 10_000 }, aportes, movs);
    expect(s.aportadoCents).toEqual({ carlos: 20_000, sofia: 15_000 });
    expect(s.saldoCents).toBe(10_000 + 35_000 - 4_000);
    expect(saldoMeta(viaje, aportes, movs, '2026-10').saldoCents).toBe(15_000);
  });

  it('pays down a dollar debt and a bolívar debt at the rate of the day', () => {
    const [deudaBs, deudaUsd] = DEUDAS as [(typeof DEUDAS)[0], (typeof DEUDAS)[0]];
    const aportes = [
      ap({ clave: 'deuda-sofia', persona: 'sofia', montoCents: 25_000 }),
      ap({ clave: 'deuda-carlos', montoCents: 10_000, tasaCompra: 1000 }),
    ];
    const movs = [
      mov({
        tipo: 'pago_deuda',
        deudaId: 'deuda-carlos',
        moneda: 'VES',
        bsCents: 5_000_000,
        realCents: 5_000,
      }),
    ];
    expect(saldoDeuda(deudaUsd, aportes, movs).saldoCents).toBe(300_000 - 25_000);
    const bs = saldoDeuda(deudaBs, aportes, movs);
    expect(bs.saldoCents).toBe(150_000_000 - 10_000_000 - 5_000_000);
    expect(bs.pagadoRealCents).toBe(15_000);
  });
});
