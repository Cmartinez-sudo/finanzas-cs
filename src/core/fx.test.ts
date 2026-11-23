import { describe, expect, it } from 'vitest';
import { TasaFaltante, costoReal, tasasDelDia, usdABs } from './fx';

const hoy = { bcv: 919.82, binance: 1089.56 };

describe('costoReal (dólar real)', () => {
  it('USD costs exactly what was paid', () => {
    expect(costoReal('USD', 4000, hoy).realCents).toBe(4000);
  });

  it('$40 at BCV costs fewer real dollars than $40 cash', () => {
    const c = costoReal('USD_BCV', 4000, hoy);
    expect(c.bsCents).toBe(3_679_280); // Bs 36.792,80
    expect(c.realCents).toBe(3377); // 36.792,80 / 1.089,56 = $33.77
    expect(c.ahorroBrechaCents).toBe(623);
    expect(c.tasaBcv).toBe(919.82);
    expect(c.tasaCompra).toBe(1089.56);
  });

  it('bolívares are always worth Binance dollars', () => {
    const c = costoReal('VES', 3_679_280, hoy);
    expect(c.realCents).toBe(3377);
    expect(c.ahorroBrechaCents).toBe(0);
  });

  it('a manual purchase rate overrides Binance', () => {
    expect(costoReal('VES', 1_000_000, hoy, 1000).realCents).toBe(1000);
  });

  it('asks for the missing rate', () => {
    expect(() => costoReal('VES', 100, { bcv: 900, binance: null })).toThrow(TasaFaltante);
    expect(() => costoReal('USD_BCV', 100, { bcv: null, binance: 1000 })).toThrow(/BCV/);
  });

  it('converts real dollars to bolívares', () => expect(usdABs(1000, 1089.56)).toBe(1_089_560));
});

describe('tasasDelDia', () => {
  const h = {
    '2026-11-20': { bcv: 910, binance: 1080 },
    '2026-11-21': { bcv: null, binance: 1085 }, // BCV publishes nothing on Saturday
    '2026-11-23': { bcv: 919.82, binance: 1089.56 },
  };
  it('uses the exact day', () => expect(tasasDelDia(h, '2026-11-23')).toMatchObject(hoy));
  it('falls back per rate to the closest earlier day', () =>
    expect(tasasDelDia(h, '2026-11-22')).toEqual({ fecha: '2026-11-22', bcv: 910, binance: 1085 }));
  it('returns nulls before history starts', () =>
    expect(tasasDelDia(h, '2026-01-01')).toEqual({ fecha: '2026-01-01', bcv: null, binance: null }));
});
