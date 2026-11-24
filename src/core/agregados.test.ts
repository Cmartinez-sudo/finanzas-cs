import { describe, expect, it } from 'vitest';
import {
  aportadoMes,
  etapasEnRango,
  fraccionCompartida,
  gastosPorCategoria,
  ingresosVsGastos,
  planVsReal,
  progresoMetas,
  saldoDeudas,
  variacion,
  type Base,
} from './agregados';
import { CATEGORIAS, DEUDAS, METAS, PLAN } from './fixtures';
import type { AporteMes, Movimiento } from './model';

const mov = (o: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(36),
  fecha: '2026-10-10',
  tipo: 'gasto',
  persona: 'carlos',
  categoriaId: null,
  metaId: null,
  deudaId: null,
  moneda: 'USD',
  montoCents: 1,
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
  mes: '2026-10',
  persona: 'carlos',
  clave: 'viaje',
  montoCents: 15_000,
  hecho: true,
  tasaCompra: null,
  ...o,
});

const base = (o: Partial<Base> = {}): Base => ({
  planes: [PLAN],
  categorias: CATEGORIAS,
  metas: METAS,
  deudas: DEUDAS,
  movimientos: [],
  aportes: [],
  etapas: [],
  ...o,
});

// Shared budget 1,775; Carlos's share 924 → 52.06 % of shared spending.
const fC = 92_400 / 177_500;

describe('fraccionCompartida', () => {
  it('follows the plan split', () => {
    expect(fraccionCompartida(base(), '2026-10', 'carlos')).toBeCloseTo(fC, 10);
    expect(fraccionCompartida(base(), '2026-10', 'sofia')).toBeCloseTo(1 - fC, 10);
  });
  it('splits evenly without a plan', () =>
    expect(fraccionCompartida(base({ planes: [] }), '2026-10', 'carlos')).toBe(0.5));
});

describe('ingresosVsGastos (chart 1)', () => {
  const b = base({
    movimientos: [
      mov({ categoriaId: 'mercado', realCents: 10_000, persona: 'sofia' }),
      mov({ categoriaId: 'c-libre', realCents: 5_000 }),
      mov({ categoriaId: 's-libre', realCents: 7_000, persona: 'sofia' }),
      mov({ tipo: 'aporte', metaId: 'viaje', realCents: 20_000, planCubiertoCents: 15_000 }),
      mov({ tipo: 'pago_deuda', deudaId: 'deuda-sofia', realCents: 3_000, persona: 'sofia' }),
      mov({ categoriaId: 'luz', realCents: 999, fecha: '2026-11-02' }),
    ],
    aportes: [ap({}), ap({ clave: 'ajuste-casa', montoCents: 7_400 })],
  });

  it('adds income, real spending and contributions; leftover is what remains', () => {
    const [oct] = ingresosVsGastos(b, '2026-10', '2026-10', 'juntos', '2026-11');
    expect(oct).toEqual({
      mes: '2026-10',
      ingreso: 547_500,
      gasto: 22_000,
      // ticked 150 + extra (200 − 150 covered) + debt payment 30; the house transfer is not a contribution
      aportado: 15_000 + 5_000 + 3_000,
      sobrante: 547_500 - 22_000 - 23_000,
      parcial: false,
    });
  });

  it('gives a person their own spending plus their share of the house', () => {
    const [oct] = ingresosVsGastos(b, '2026-10', '2026-10', 'carlos', '2026-11');
    expect(oct?.ingreso).toBe(285_000);
    expect(oct?.gasto).toBe(Math.round(5_000 + 10_000 * fC));
    expect(oct?.aportado).toBe(20_000);
  });

  it('marks the current month as partial and stops there', () => {
    const r = ingresosVsGastos(b, '2026-10', '2026-12', 'juntos', '2026-11');
    expect(r.map((x) => [x.mes, x.parcial])).toEqual([
      ['2026-10', false],
      ['2026-11', true],
    ]);
  });

  it('uses each month’s own plan version', () => {
    const v2 = { ...PLAN, vigenteDesde: '2026-11', ingresos: { carlos: 100_000, sofia: 100_000 } };
    const r = ingresosVsGastos(base({ planes: [PLAN, v2] }), '2026-10', '2026-11', 'juntos', '2026-11');
    expect(r.map((x) => x.ingreso)).toEqual([547_500, 200_000]);
  });
});

describe('aportadoMes', () => {
  it('ignores unticked items', () =>
    expect(aportadoMes(base({ aportes: [ap({ hecho: false })] }), '2026-10', 'juntos')).toBe(0));
});

describe('gastosPorCategoria (chart 2)', () => {
  const b = base({
    movimientos: [
      mov({ categoriaId: 'mercado', realCents: 40_000 }),
      mov({ categoriaId: 'imprevisto', realCents: 6_000 }),
      mov({ categoriaId: 'c-hobby', realCents: 20_000 }),
      mov({ categoriaId: 's-belleza', realCents: 9_000, persona: 'sofia' }),
    ],
  });
  it('groups by house, unexpected and each person when together', () => {
    const r = gastosPorCategoria(b, '2026-10', '2026-10', 'juntos');
    expect(r.items.map((x) => [x.clave, x.realCents])).toEqual([
      ['casa', 40_000],
      ['p-carlos', 20_000],
      ['p-sofia', 9_000],
      ['imprevisto', 6_000],
    ]);
    expect(r.total).toBe(75_000);
    expect(r.items[0]?.pctIngreso).toBeCloseTo(40_000 / 547_500, 10);
  });
  it('shows a person their categories and their part of shared', () => {
    const r = gastosPorCategoria(b, '2026-10', '2026-10', 'carlos');
    expect(r.items.map((x) => x.clave)).toEqual(['casa', 'c-hobby', 'imprevisto']);
    expect(r.items[0]?.nombre).toBe('Casa (tu parte)');
    expect(r.items[0]?.realCents).toBe(Math.round(40_000 * fC));
    expect(r.ingreso).toBe(285_000);
  });
});

describe('planVsReal (chart 3)', () => {
  it('adds budgets across the months of the range', () => {
    const b = base({
      movimientos: [
        mov({ categoriaId: 'mercado', realCents: 50_000 }),
        mov({ categoriaId: 'mercado', realCents: 30_000, fecha: '2026-11-05' }),
      ],
    });
    const mercado = planVsReal(b, '2026-10', '2026-11', 'juntos').find((x) => x.id === 'mercado');
    expect(mercado).toEqual({ id: 'mercado', nombre: 'Mercado', k: 'casa', plan: 90_000, real: 80_000 });
  });
  it("hides the other person's categories", () => {
    const ids = planVsReal(base(), '2026-10', '2026-10', 'carlos').map((x) => x.id);
    expect(ids.some((id) => id.startsWith('s-'))).toBe(false);
    expect(ids).toContain('renta');
  });
});

describe('progresoMetas (chart 4)', () => {
  it('tracks month-end balances and progress to the cap', () => {
    const b = base({ aportes: [ap({ mes: '2026-09' }), ap({ mes: '2026-10', persona: 'sofia' })] });
    const viaje = progresoMetas(b, '2026-09', '2026-10', 'juntos')[0];
    expect(viaje?.puntos).toEqual([
      { mes: '2026-09', saldo: 15_000 },
      { mes: '2026-10', saldo: 30_000 },
    ]);
    expect(viaje?.pct).toBeCloseTo(30_000 / 500_000, 10);
  });
  it("leaves out the other person's own goals", () =>
    expect(progresoMetas(base(), '2026-10', '2026-10', 'carlos').map((s) => s.meta.id)).toEqual([
      'viaje',
      'emergencia',
      'inv-carlos',
    ]));
});

describe('saldoDeudas (chart 5)', () => {
  it('shows % remaining and estimates the payoff month', () => {
    const aportes = ['2026-07', '2026-08', '2026-09', '2026-10'].map((mes) =>
      ap({ mes, persona: 'sofia', clave: 'deuda-sofia', montoCents: 50_000 }),
    );
    const s = saldoDeudas(base({ aportes }), '2026-06', '2026-10', 'sofia')[0];
    expect(s?.puntos.map((p) => p.saldo)).toEqual([300_000, 250_000, 200_000, 150_000, 100_000]);
    expect(s?.puntos.at(-1)?.restante).toBeCloseTo(1 / 3, 10);
    expect(s?.estimado).toBe('2026-12');
  });
  it('starts each line at the date of its balance', () => {
    const s = saldoDeudas(base(), '2026-01', '2026-07', 'juntos')[0];
    expect(s?.puntos[0]?.mes).toBe('2026-06');
    expect(s?.estimado).toBeNull();
  });
});

describe('etapas and comparisons', () => {
  it('clips stages to the range', () => {
    const etapas = [
      { id: 'a', nombre: 'Deudas', desde: '2026-01', hasta: '2026-05' },
      { id: 'b', nombre: 'Viaje', desde: '2026-06', hasta: null },
    ];
    expect(etapasEnRango(base({ etapas }), '2026-04', '2026-08').map((e) => [e.nombre, e.a, e.z])).toEqual([
      ['Deudas', '2026-04', '2026-05'],
      ['Viaje', '2026-06', '2026-08'],
    ]);
  });
  it('computes changes between periods', () => {
    expect(variacion(88, 100)).toBeCloseTo(-0.12, 10);
    expect(variacion(10, 0)).toBeNull();
  });
});
