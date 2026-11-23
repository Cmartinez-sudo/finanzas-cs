/** Domain types shared by the logic, the data layer and the views. */
import type { Cents } from './money';
import type { Moneda } from './fx';

export type Persona = 'carlos' | 'sofia';
export const PERSONAS: readonly Persona[] = ['carlos', 'sofia'];
export const otra = (p: Persona): Persona => (p === 'carlos' ? 'sofia' : 'carlos');

/** casa and imprevisto are shared; personal belongs to one person. */
export type GrupoGasto = 'casa' | 'imprevisto' | 'personal';

export interface Categoria {
  id: string;
  grupo: GrupoGasto;
  persona: Persona | null; // set only for grupo 'personal'
  nombre: string;
  orden: number;
  archivada: boolean;
}

export type TipoMeta = 'viaje' | 'emergencia' | 'inversion' | 'otra';

export interface Meta {
  id: string;
  nombre: string;
  tipo: TipoMeta;
  /** null = shared by both (e.g. travel fund); a person = their own (e.g. their investment account). */
  persona: Persona | null;
  cuenta: string;
  topeCents: Cents | null;
  saldoInicialCents: Cents;
  orden: number;
  archivada: boolean;
}

export interface Deuda {
  id: string;
  nombre: string;
  persona: Persona;
  moneda: 'USD' | 'VES';
  /** Balance in the debt's own currency (US cents or céntimos) on fechaSaldo. */
  saldoInicialCents: Cents;
  fechaSaldo: string; // YYYY-MM-DD
  archivada: boolean;
}

export type ReglaReparto =
  { tipo: 'proporcional' } | { tipo: 'mitad' } | { tipo: 'manual'; carlosPct: number };

/** One version of the plan. A month uses the latest version that started on or before it. */
export interface Plan {
  vigenteDesde: string; // YYYY-MM
  ingresos: Record<Persona, Cents>;
  /** Monthly budget per category id. */
  presupuesto: Record<string, Cents>;
  /** Monthly contribution per person to each goal id or debt id. */
  aportes: Record<Persona, Record<string, Cents>>;
  reparto: ReglaReparto;
  /** Who pays each shared category out of their own account; missing ids are paid by pagaResto. */
  pagosCompartidos: Record<string, Persona>;
  pagaResto: Persona;
}

export interface Etapa {
  id: string;
  nombre: string;
  desde: string; // YYYY-MM
  hasta: string | null; // YYYY-MM, inclusive; null = still running
}

export type TipoMovimiento = 'gasto' | 'aporte' | 'retiro' | 'pago_deuda';

/** Anything that moves money: an expense, an extra contribution, a withdrawal from a fund, a debt payment. */
export interface Movimiento {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: TipoMovimiento;
  persona: Persona;
  categoriaId: string | null; // gasto
  metaId: string | null; // aporte, retiro
  deudaId: string | null; // pago_deuda
  moneda: Moneda;
  /** Amount as typed, in the quoted currency's cents. */
  montoCents: Cents;
  tasaBcv: number | null;
  tasaCompra: number | null;
  tasaManual: boolean;
  /** Frozen at save time: real cost in US cents. */
  realCents: Cents;
  bsCents: Cents | null;
  ahorroCents: Cents;
  nota: string;
  /** Part of an aporte that ticked the planned monthly contribution in the checklist. */
  planCubiertoCents: Cents;
  creadoEn: number;
}

/** A checklist line for one month: a planned contribution, debt payment or the house transfer. */
export interface AporteMes {
  mes: string;
  persona: Persona;
  clave: string; // goal id, debt id or AJUSTE_CASA
  montoCents: Cents;
  hecho: boolean;
  /** Binance rate on the day it was ticked, to reduce a debt in bolívares. */
  tasaCompra: number | null;
}

export const AJUSTE_CASA = 'ajuste-casa';

export const mesDe = (fecha: string): string => fecha.slice(0, 7);
