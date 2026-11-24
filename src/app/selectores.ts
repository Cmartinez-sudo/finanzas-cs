/** Derived data the views share. Pure functions over Datos. */
import { mesDe, type Categoria, type Movimiento, type Persona, type Plan } from '../core/model';
import { categoriasDe, planDelMes } from '../core/plan';
import type { Datos } from '../data/repo';
import { NOMBRE } from '../strings';

export const plan = (d: Datos, mes: string): Plan | null => planDelMes(d.planes, mes);

const porOrden = <T extends { orden: number }>(xs: T[]) => [...xs].sort((a, b) => a.orden - b.orden);

export const catsGrupo = (d: Datos, g: 'casa' | 'imprevisto'): Categoria[] =>
  porOrden(d.categorias.filter((c) => c.grupo === g && !c.archivada));
export const catsPersona = (d: Datos, p: Persona): Categoria[] => porOrden(categoriasDe(d.categorias, p));
export const metasActivas = (d: Datos) => porOrden(d.metas.filter((m) => !m.archivada));
export const deudasActivas = (d: Datos) => d.deudas.filter((x) => !x.archivada);

export const movsDelMes = (d: Datos, mes: string): Movimiento[] =>
  d.movimientos.filter((m) => mesDe(m.fecha) === mes);

/** First month with any data, to bound charts and the "Todo" period. */
export function primerMes(d: Datos, fallback: string): string {
  const meses = [
    ...d.movimientos.map((m) => mesDe(m.fecha)),
    ...d.aportes.map((a) => a.mes),
    ...d.planes.map((p) => p.vigenteDesde),
  ].sort();
  return meses[0] ?? fallback;
}

/** Display name and icon/color key for any movement target. */
export function destino(
  d: Datos,
  m: Movimiento,
): { nombre: string; grupo: string; k: string; icono: string } {
  if (m.tipo === 'gasto') {
    const c = d.categorias.find((x) => x.id === m.categoriaId);
    const g = c?.grupo ?? 'casa';
    const k = g === 'personal' ? (c?.persona ?? m.persona) : g;
    const grupo = g === 'personal' ? NOMBRE[c?.persona ?? m.persona] : g === 'casa' ? 'Casa' : 'Imprevisto';
    return {
      nombre: c?.nombre ?? 'Gasto',
      grupo,
      k,
      icono: g === 'personal' ? 'persona' : g === 'casa' ? 'casa' : 'imprevisto',
    };
  }
  if (m.tipo === 'pago_deuda') {
    const x = d.deudas.find((y) => y.id === m.deudaId);
    return { nombre: x?.nombre ?? 'Deuda', grupo: 'Pago de deuda', k: 'deuda', icono: 'tarjeta' };
  }
  const meta = d.metas.find((y) => y.id === m.metaId);
  return {
    nombre: meta?.nombre ?? 'Fondo',
    grupo: m.tipo === 'aporte' ? 'Aporte' : 'Retiro',
    k: meta?.tipo ?? 'otra',
    icono: iconoMeta(meta?.tipo),
  };
}

export const iconoMeta = (tipo?: string): string =>
  tipo === 'viaje' ? 'avion' : tipo === 'emergencia' ? 'escudo' : tipo === 'inversion' ? 'inversion' : 'meta';

/** Name for a checklist key: goal, debt or the house transfer. */
export function nombreClave(d: Datos, clave: string): string {
  return d.metas.find((m) => m.id === clave)?.nombre ?? d.deudas.find((x) => x.id === clave)?.nombre ?? clave;
}
