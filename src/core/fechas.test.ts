import { describe, expect, it } from 'vitest';
import {
  diaLegible,
  diasDelMes,
  etiquetaPeriodo,
  mesCorto,
  mesLargo,
  moverPeriodo,
  rangoMeses,
  rangoPeriodo,
  sumarMeses,
} from './fechas';

describe('fechas', () => {
  it('moves across years', () => {
    expect(sumarMeses('2026-12', 1)).toBe('2027-01');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
  });
  it('lists month ranges', () =>
    expect(rangoMeses('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']));
  it('knows month lengths', () => {
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2028-02')).toBe(29);
  });
  it('labels months and days in Spanish', () => {
    expect(mesLargo('2026-11')).toBe('noviembre 2026');
    expect(mesCorto('2026-11', true)).toBe('nov 26');
    const ref = new Date(2026, 10, 23);
    expect(diaLegible('2026-11-23', ref)).toBe('Hoy');
    expect(diaLegible('2026-11-22', ref)).toBe('Ayer');
    expect(diaLegible('2026-11-18', ref)).toBe('miércoles 18 nov');
  });
  it('builds periods', () => {
    expect(rangoPeriodo('trimestre', '2026-11', '2026-04')).toEqual(['2026-10', '2026-12']);
    expect(rangoPeriodo('año', '2026-11', '2026-04')).toEqual(['2026-01', '2026-12']);
    expect(rangoPeriodo('todo', '2026-11', '2026-04')).toEqual(['2026-04', '2026-11']);
    expect(moverPeriodo('trimestre', '2026-11', -1)).toBe('2026-08');
    expect(etiquetaPeriodo('trimestre', '2026-11', '2026-04')).toBe('T4 2026');
    expect(etiquetaPeriodo('todo', '2026-11', '2026-04')).toBe('abr 26 – nov 26');
  });
});
