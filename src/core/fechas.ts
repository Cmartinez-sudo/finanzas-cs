/** Dates as plain strings in local time: months 'YYYY-MM', days 'YYYY-MM-DD'. */
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pad = (n: number) => String(n).padStart(2, '0');

export const mesKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const diaKey = (d: Date): string => `${mesKey(d)}-${pad(d.getDate())}`;
export const hoy = (): string => diaKey(new Date());
export const mesActual = (): string => mesKey(new Date());

export function haceDias(n: number, desde = new Date()): string {
  const d = new Date(desde);
  d.setDate(d.getDate() - n);
  return diaKey(d);
}

export function sumarMeses(m: string, k: number): string {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return mesKey(new Date(y, mm - 1 + k, 1));
}

/** Months from a to b inclusive. */
export function rangoMeses(a: string, b: string): string[] {
  const out: string[] = [];
  for (let m = a; m <= b && out.length < 600; m = sumarMeses(m, 1)) out.push(m);
  return out;
}

export function diasDelMes(m: string): number {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return new Date(y, mm, 0).getDate();
}

/** "noviembre 2026" */
export function mesLargo(m: string): string {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return `${MESES[mm - 1]} ${y}`;
}

/** "nov" or "nov 26" when the year matters. */
export function mesCorto(m: string, conAño = false): string {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  const s = (MESES[mm - 1] as string).slice(0, 3);
  return conAño ? `${s} ${String(y).slice(2)}` : s;
}

export const nombreMes = (m: string): string => MESES[Number(m.slice(5, 7)) - 1] as string;

/** "Hoy", "Ayer", or "martes 18 nov". */
export function diaLegible(f: string, ref = new Date()): string {
  if (f === diaKey(ref)) return 'Hoy';
  if (f === haceDias(1, ref)) return 'Ayer';
  const [y, m, d] = f.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} ${(MESES[m - 1] as string).slice(0, 3)}`;
}

/** "20 nov" */
export function diaCorto(f: string): string {
  const [, m, d] = f.split('-').map(Number) as [number, number, number];
  return `${d} ${(MESES[m - 1] as string).slice(0, 3)}`;
}

export type Periodo = 'mes' | 'trimestre' | 'año' | 'todo';

/** First and last month of the period that contains `m`. */
export function rangoPeriodo(p: Periodo, m: string, primerMes: string): [string, string] {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  if (p === 'mes') return [m, m];
  if (p === 'trimestre') {
    const q = Math.floor((mm - 1) / 3) * 3 + 1;
    return [`${y}-${pad(q)}`, `${y}-${pad(q + 2)}`];
  }
  if (p === 'año') return [`${y}-01`, `${y}-12`];
  return [primerMes < m ? primerMes : m, m];
}

/** Moves a period one step back or forward. */
export function moverPeriodo(p: Periodo, m: string, k: number): string {
  return sumarMeses(m, k * (p === 'mes' ? 1 : p === 'trimestre' ? 3 : 12));
}

export function etiquetaPeriodo(p: Periodo, m: string, primerMes: string): string {
  const [a, b] = rangoPeriodo(p, m, primerMes);
  if (p === 'mes') return mesLargo(m);
  if (p === 'trimestre') return `T${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1} ${m.slice(0, 4)}`;
  if (p === 'año') return m.slice(0, 4);
  return `${mesCorto(a, true)} – ${mesCorto(b, true)}`;
}
