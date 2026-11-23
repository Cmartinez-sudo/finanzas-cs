/**
 * Money is stored and added as integer cents, never as floating dollars.
 * The same type holds US cents and bolívar céntimos; the field name says which.
 */
export type Cents = number;

/** Rounds half away from zero, so −0.5 → −1 like 0.5 → 1 (Math.round sends −0.5 to 0). */
export function roundHalfAway(n: number): number {
  const r = Math.round(Math.abs(n) + Number.EPSILON * Math.abs(n));
  return n < 0 ? -r : r;
}

/** Converts a decimal amount (12.34) to cents (1234). */
export function toCents(amount: number): Cents {
  return roundHalfAway(amount * 100);
}

export function fromCents(c: Cents): number {
  return c / 100;
}

export function sumCents(values: Iterable<Cents | null | undefined>): Cents {
  let t = 0;
  for (const v of values) t += v ?? 0;
  return t;
}

/**
 * Reads a number the way people type it: "1.234,56", "1,234.56", "1234,5", "$ 20", "0.125".
 * One separator followed by exactly three digits reads as thousands ("1.500" → 1500),
 * except after a lone zero ("0.125" → 0.125), which can only be a decimal.
 */
export function parseDecimal(input: string | null | undefined): number | null {
  const s = String(input ?? '')
    .trim()
    .replace(/[^\d.,-]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const neg = s.startsWith('-');
  const body = s.replace(/-/g, '');
  const lc = body.lastIndexOf(','),
    ld = body.lastIndexOf('.');
  let dec = -1;
  if (lc > -1 && ld > -1) dec = Math.max(lc, ld);
  else if (lc > -1 || ld > -1) {
    const p = Math.max(lc, ld);
    const ch = body[p] as string;
    const after = body.length - p - 1;
    const count = body.split(ch).length - 1;
    const intPart = body.slice(0, p);
    if (count === 1 && (after !== 3 || intPart === '' || /^0+$/.test(intPart))) dec = p;
  }
  const int = (dec > -1 ? body.slice(0, dec) : body).replace(/[.,]/g, '') || '0';
  const frac = dec > -1 ? body.slice(dec + 1).replace(/[.,]/g, '') : '';
  const n = Number(int + (frac ? '.' + frac : ''));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** parseDecimal straight to cents. */
export function parseMonto(input: string | null | undefined): Cents | null {
  const n = parseDecimal(input);
  return n === null ? null : toCents(n);
}

/**
 * Splits a total into parts proportional to the weights, rounding with the largest-remainder
 * method so the parts always add up to the total exactly.
 */
export function splitProportional(total: Cents, weights: readonly number[], unit: Cents = 1): Cents[] {
  const w = weights.map((x) => Math.max(0, x));
  const W = w.reduce((a, b) => a + b, 0);
  if (W === 0)
    return splitProportional(
      total,
      weights.map(() => 1),
      unit,
    );
  const units = Math.trunc(total / unit);
  const raw = w.map((x) => (units * x) / W);
  const base = raw.map(Math.floor);
  let left = units - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    base[i] = (base[i] as number) + 1;
    left--;
  }
  const parts = base.map((b) => b * unit);
  // Any amount smaller than one unit goes to the first part.
  parts[0] = (parts[0] as number) + (total - units * unit);
  return parts;
}

const MINUS = '−';
const usd0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const bs2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type UsdStyle = 'whole' | 'auto' | 'exact' | 'compact';

/**
 * Formats US cents. 'whole' rounds to dollars ($1,235), 'exact' always shows cents ($1,234.50),
 * 'auto' shows cents only when there are any, 'compact' is for chart axes ($1.2K).
 */
export function fmtUSD(c: Cents, style: UsdStyle = 'auto'): string {
  const sign = c < 0 ? MINUS : '';
  const a = Math.abs(c);
  let body: string;
  if (style === 'whole') body = usd0.format(roundHalfAway(a / 100));
  else if (style === 'compact')
    body = a < 100_000 ? usd0.format(roundHalfAway(a / 100)) : usdCompact.format(a / 100);
  else if (style === 'exact' || a % 100 !== 0) body = usd2.format(a / 100);
  else body = usd0.format(a / 100);
  return `${sign}$${body}`;
}

export function fmtBs(c: Cents): string {
  return `${c < 0 ? MINUS : ''}Bs ${bs2.format(Math.abs(c) / 100)}`;
}

export function fmtTasa(n: number | null | undefined): string {
  return n ? bs2.format(n) : '—';
}

/** Shows a stored value in an input without thousands separators, using a decimal comma. */
export function centsToInput(c: Cents | null | undefined): string {
  if (!c) return '';
  const a = Math.abs(c);
  const s = a % 100 === 0 ? String(a / 100) : (a / 100).toFixed(2).replace('.', ',');
  return (c < 0 ? '-' : '') + s;
}
