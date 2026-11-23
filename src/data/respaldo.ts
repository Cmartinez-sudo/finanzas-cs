/** Validates a backup file before anything is written, so a wrong file cannot overwrite data. */
import type { Respaldo } from './repo';

export class RespaldoInvalido extends Error {}

const esObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const esPersona = (x: unknown) => x === 'carlos' || x === 'sofia';
const esMes = (x: unknown) => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
const esFecha = (x: unknown) => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(x);
const esCents = (x: unknown) => Number.isSafeInteger(x);
const esTexto = (x: unknown, max: number) => typeof x === 'string' && x.length <= max;

function lista(d: Record<string, unknown>, k: string, ok: (x: Record<string, unknown>) => boolean): void {
  const v = d[k];
  if (!Array.isArray(v)) throw new RespaldoInvalido(`Falta la lista "${k}".`);
  v.forEach((x, i) => {
    if (!esObj(x) || !ok(x))
      throw new RespaldoInvalido(`"${k}" tiene un elemento inválido (posición ${i + 1}).`);
  });
}

export function validarRespaldo(raw: unknown): Respaldo {
  if (!esObj(raw) || raw.version !== 3 || !esObj(raw.datos))
    throw new RespaldoInvalido('Ese archivo no es una copia de esta versión de la app.');
  const d = raw.datos;
  lista(
    d,
    'categorias',
    (x) =>
      typeof x.id === 'string' &&
      ['casa', 'imprevisto', 'personal'].includes(x.grupo as string) &&
      esTexto(x.nombre, 40),
  );
  lista(d, 'metas', (x) => typeof x.id === 'string' && esTexto(x.nombre, 40) && esCents(x.saldoInicialCents));
  lista(
    d,
    'deudas',
    (x) =>
      typeof x.id === 'string' &&
      esPersona(x.persona) &&
      esCents(x.saldoInicialCents) &&
      esFecha(x.fechaSaldo),
  );
  lista(
    d,
    'planes',
    (x) => esMes(x.vigenteDesde) && esObj(x.ingresos) && esObj(x.presupuesto) && esObj(x.aportes),
  );
  lista(
    d,
    'etapas',
    (x) => typeof x.id === 'string' && esMes(x.desde) && (x.hasta === null || esMes(x.hasta)),
  );
  lista(
    d,
    'movimientos',
    (x) =>
      typeof x.id === 'string' &&
      esFecha(x.fecha) &&
      esPersona(x.persona) &&
      ['gasto', 'aporte', 'retiro', 'pago_deuda'].includes(x.tipo as string) &&
      ['USD', 'VES', 'USD_BCV'].includes(x.moneda as string) &&
      esCents(x.montoCents) &&
      (x.montoCents as number) > 0 &&
      esCents(x.realCents) &&
      esTexto(x.nota, 120),
  );
  lista(
    d,
    'aportes',
    (x) => esMes(x.mes) && esPersona(x.persona) && typeof x.clave === 'string' && esCents(x.montoCents),
  );
  if (!esObj(d.tasasManual)) throw new RespaldoInvalido('Faltan las tasas corregidas.');
  if (typeof d.notas !== 'string') throw new RespaldoInvalido('Faltan las notas.');
  return raw as unknown as Respaldo;
}
