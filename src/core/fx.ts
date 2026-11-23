/**
 * "Dólar real": what a payment actually cost out of the couple's US dollars.
 * They earn USD and get bolívares by selling USDT on Binance, so bolívares are worth
 * Binance dollars, never BCV dollars. $40 at the BCV rate costs fewer real dollars than $40 cash.
 */
import { roundHalfAway, type Cents } from './money';

/**
 * How the amount was quoted:
 * - USD: paid in dollars (Zelle, card, cash). Real cost = the amount.
 * - VES: paid in bolívares. Real cost = bolívares ÷ purchase rate.
 * - USD_BCV: priced in "$ at BCV" and charged in bolívares. Bolívares = dollars × BCV,
 *   then real cost = bolívares ÷ purchase rate.
 */
export type Moneda = 'USD' | 'VES' | 'USD_BCV';

export interface TasasDia {
  fecha: string; // YYYY-MM-DD
  bcv: number | null;
  binance: number | null;
}

export interface Costo {
  /** Real cost in US cents. */
  realCents: Cents;
  /** Bolívares paid (céntimos), when the payment was in bolívares. */
  bsCents: Cents | null;
  /** Rate the bolívares were bought at (Bs per $), when it applies. */
  tasaCompra: number | null;
  /** BCV rate used to turn a "$ BCV" price into bolívares. */
  tasaBcv: number | null;
  /** For USD_BCV: quoted dollars minus real cost — what paying in bolívares saved. */
  ahorroBrechaCents: Cents;
}

export class TasaFaltante extends Error {
  constructor(public readonly cual: 'bcv' | 'compra') {
    super(cual === 'bcv' ? 'Falta la tasa BCV del día' : 'Falta la tasa a la que compraron los bolívares');
  }
}

/**
 * @param montoCents amount in the quoted currency's cents (US cents for USD and USD_BCV, céntimos for VES)
 * @param tasas rates of the payment day
 * @param tasaCompraManual rate the bolívares were actually bought at, if not Binance's
 */
export function costoReal(
  moneda: Moneda,
  montoCents: Cents,
  tasas: Pick<TasasDia, 'bcv' | 'binance'> | null,
  tasaCompraManual?: number | null,
): Costo {
  if (moneda === 'USD')
    return { realCents: montoCents, bsCents: null, tasaCompra: null, tasaBcv: null, ahorroBrechaCents: 0 };

  const compra = tasaCompraManual && tasaCompraManual > 0 ? tasaCompraManual : (tasas?.binance ?? null);
  if (!compra || compra <= 0) throw new TasaFaltante('compra');

  if (moneda === 'VES') {
    return {
      realCents: roundHalfAway(montoCents / compra),
      bsCents: montoCents,
      tasaCompra: compra,
      tasaBcv: null,
      ahorroBrechaCents: 0,
    };
  }

  const bcv = tasas?.bcv ?? null;
  if (!bcv || bcv <= 0) throw new TasaFaltante('bcv');
  const bsCents = roundHalfAway(montoCents * bcv);
  const realCents = roundHalfAway(bsCents / compra);
  return { realCents, bsCents, tasaCompra: compra, tasaBcv: bcv, ahorroBrechaCents: montoCents - realCents };
}

/** Converts real US cents to bolívares at a rate, for showing equivalents. */
export function usdABs(usdCents: Cents, tasa: number): Cents {
  return roundHalfAway(usdCents * tasa);
}

export type Historial = Readonly<Record<string, { bcv: number | null; binance: number | null }>>;

/**
 * Rates for a date: that day's, or the closest earlier day that has each rate
 * (the BCV does not publish on weekends or holidays). Each rate is looked up on its own.
 */
export function tasasDelDia(historial: Historial, fecha: string): TasasDia {
  const dias = Object.keys(historial)
    .filter((d) => d <= fecha)
    .sort()
    .reverse();
  let bcv: number | null = null,
    binance: number | null = null;
  for (const d of dias) {
    const t = historial[d];
    if (!t) continue;
    if (bcv === null && t.bcv) bcv = t.bcv;
    if (binance === null && t.binance) binance = t.binance;
    if (bcv !== null && binance !== null) break;
  }
  return { fecha, bcv, binance };
}
