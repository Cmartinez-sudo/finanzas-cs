import { describe, expect, it } from 'vitest';
import { generarDemo } from './demo';
import { RespaldoInvalido, validarRespaldo } from './respaldo';
import { combinarTasas } from './tasas';
import { saldoDeuda } from '../core/plan';

describe('combinarTasas', () => {
  const publicadas = {
    hoy: { fecha: '2026-11-23', bcv: 919.82, binance: 1089.56, fuente: 'BCV; Binance' },
    historial: { '2026-11-22': { bcv: null, binance: 1080 } },
  };
  it('adds today to the history and shows it', () => {
    const r = combinarTasas(publicadas, {});
    expect(r.historial['2026-11-23']).toEqual({ bcv: 919.82, binance: 1089.56 });
    expect(r.tasaHoy).toMatchObject({ fecha: '2026-11-23', manual: false, fuente: 'BCV; Binance' });
  });
  it('lets a manual correction win for its day', () => {
    const r = combinarTasas(publicadas, { '2026-11-23': { bcv: 920, binance: 1100 } });
    expect(r.historial['2026-11-23']).toEqual({ bcv: 920, binance: 1100 });
    expect(r.tasaHoy).toMatchObject({ bcv: 920, manual: true });
  });
  it('handles no rates at all', () =>
    expect(combinarTasas({ hoy: null, historial: {} }, {}).tasaHoy).toBeNull());
});

describe('demo data', () => {
  const d = generarDemo(new Date(2026, 10, 23));
  it('is deterministic', () => expect(generarDemo(new Date(2026, 10, 23))).toEqual(d));
  it('covers April to November with real-dollar costs', () => {
    expect(d.movimientos.length).toBeGreaterThan(200);
    expect(d.movimientos.every((m) => m.fecha >= '2026-04-01' && m.fecha <= '2026-11-23')).toBe(true);
    const bs = d.movimientos.filter((m) => m.moneda !== 'USD');
    expect(bs.length).toBeGreaterThan(20);
    expect(bs.every((m) => m.tasaCompra && m.realCents > 0)).toBe(true);
  });
  it('pays the bolívar loan off while the plan is in its first stage', () => {
    const deuda = d.deudas.find((x) => x.moneda === 'VES');
    expect(deuda).toBeDefined();
    if (deuda) expect(saldoDeuda(deuda, d.aportes, d.movimientos).saldoCents).toBe(0);
  });
  it('round-trips through backup validation', () => {
    const { historial: _h, ...datos } = d;
    expect(() => validarRespaldo({ version: 3, exportado: '', datos })).not.toThrow();
  });
});

describe('validarRespaldo', () => {
  it('rejects other files', () => {
    expect(() => validarRespaldo({ version: 2, docs: [] })).toThrow(RespaldoInvalido);
    expect(() => validarRespaldo(null)).toThrow(RespaldoInvalido);
  });
  it('rejects bad movements', () => {
    const { historial: _h, ...datos } = generarDemo(new Date(2026, 4, 2));
    const malo = { ...datos, movimientos: [{ ...datos.movimientos[0], montoCents: -5 }] };
    expect(() => validarRespaldo({ version: 3, exportado: '', datos: malo })).toThrow(/movimientos/);
  });
});
