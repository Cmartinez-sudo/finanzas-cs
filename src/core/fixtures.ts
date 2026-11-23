/**
 * Shared sample data for tests and the local demo mode.
 * The amounts are made up; the formula tests compare them against a verbatim copy of the
 * original app's formulas.
 */
import type { Categoria, Deuda, Meta, Plan } from './model';

const cat = (
  id: string,
  grupo: Categoria['grupo'],
  nombre: string,
  orden: number,
  persona: Categoria['persona'] = null,
): Categoria => ({
  id,
  grupo,
  persona,
  nombre,
  orden,
  archivada: false,
});

export const CATEGORIAS: Categoria[] = [
  cat('renta', 'casa', 'Renta', 1),
  cat('mercado', 'casa', 'Mercado', 2),
  cat('condominio', 'casa', 'Condominio', 3),
  cat('limpieza', 'casa', 'Limpieza', 4),
  cat('internet', 'casa', 'Internet', 5),
  cat('luz', 'casa', 'Luz', 6),
  cat('mascota', 'casa', 'Mascota', 7),
  cat('imprevisto', 'imprevisto', 'Imprevisto', 1),
  cat('c-gym', 'personal', 'Gym', 1, 'carlos'),
  cat('c-seguro', 'personal', 'Seguro', 2, 'carlos'),
  cat('c-hobby', 'personal', 'Golf', 3, 'carlos'),
  cat('c-gasolina', 'personal', 'Gasolina', 4, 'carlos'),
  cat('c-libre', 'personal', 'Libre', 5, 'carlos'),
  cat('s-gym', 'personal', 'Gym', 1, 'sofia'),
  cat('s-seguro', 'personal', 'Seguro', 2, 'sofia'),
  cat('s-belleza', 'personal', 'Belleza', 3, 'sofia'),
  cat('s-gasolina', 'personal', 'Gasolina', 4, 'sofia'),
  cat('s-libre', 'personal', 'Libre', 5, 'sofia'),
];

export const METAS: Meta[] = [
  {
    id: 'viaje',
    nombre: 'Viaje',
    tipo: 'viaje',
    persona: null,
    cuenta: 'Cuenta del viaje',
    topeCents: 500_000,
    saldoInicialCents: 0,
    orden: 1,
    archivada: false,
  },
  {
    id: 'emergencia',
    nombre: 'Emergencia',
    tipo: 'emergencia',
    persona: null,
    cuenta: 'Cuenta de emergencia',
    topeCents: 1_200_000,
    saldoInicialCents: 0,
    orden: 2,
    archivada: false,
  },
  {
    id: 'inv-carlos',
    nombre: 'Inversión de Carlos',
    tipo: 'inversion',
    persona: 'carlos',
    cuenta: 'Su cuenta de inversión',
    topeCents: null,
    saldoInicialCents: 0,
    orden: 3,
    archivada: false,
  },
  {
    id: 'inv-sofia',
    nombre: 'Inversión de Sofía',
    tipo: 'inversion',
    persona: 'sofia',
    cuenta: 'Su cuenta de inversión',
    topeCents: null,
    saldoInicialCents: 0,
    orden: 4,
    archivada: false,
  },
];

export const DEUDAS: Deuda[] = [
  {
    id: 'deuda-carlos',
    nombre: 'Deuda en Bs',
    persona: 'carlos',
    moneda: 'VES',
    saldoInicialCents: 150_000_000,
    fechaSaldo: '2026-06-01',
    archivada: false,
  },
  {
    id: 'deuda-sofia',
    nombre: 'Tarjeta de crédito',
    persona: 'sofia',
    moneda: 'USD',
    saldoInicialCents: 300_000,
    fechaSaldo: '2026-06-01',
    archivada: false,
  },
];

export const PLAN: Plan = {
  vigenteDesde: '2026-01',
  ingresos: { carlos: 285_000, sofia: 262_500 },
  presupuesto: {
    renta: 85_000,
    mercado: 45_000,
    condominio: 7_500,
    limpieza: 20_000,
    internet: 3_500,
    luz: 1_500,
    mascota: 9_000,
    imprevisto: 6_000,
    'c-gym': 18_000,
    'c-seguro': 12_000,
    'c-hobby': 25_000,
    'c-gasolina': 8_000,
    'c-libre': 35_000,
    's-gym': 18_000,
    's-seguro': 12_000,
    's-belleza': 22_000,
    's-gasolina': 4_000,
    's-libre': 35_000,
  },
  aportes: {
    carlos: { viaje: 15_000, emergencia: 12_500, 'inv-carlos': 15_000, 'deuda-carlos': 10_000 },
    sofia: { viaje: 15_000, emergencia: 12_500, 'inv-sofia': 15_000, 'deuda-sofia': 25_000 },
  },
  reparto: { tipo: 'proporcional' },
  pagosCompartidos: { renta: 'carlos' },
  pagaResto: 'sofia',
};
