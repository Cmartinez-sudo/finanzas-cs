/** Rates published by the daily GitHub Action (public/tasas.json and public/tasas-historial.json). */
import type { Historial } from '../core/fx';
import type { TasasHoy } from './repo';

interface TasasJson {
  bcv: number | null;
  binance: number | null;
  fecha: string;
  fuente?: string;
  manual?: boolean;
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function cargarTasasPublicadas(): Promise<{ hoy: TasasJson | null; historial: Historial }> {
  const [hoy, historial] = await Promise.all([
    json<TasasJson>('tasas.json'),
    json<Historial>('tasas-historial.json'),
  ]);
  return { hoy, historial: historial ?? {} };
}

/**
 * Merges automatic history, today's file and manual corrections (manual wins for its day).
 * Returns the merged history and the rates to show as "today": the newest day available.
 */
export function combinarTasas(
  publicadas: { hoy: TasasJson | null; historial: Historial },
  manual: Historial,
): { historial: Historial; tasaHoy: TasasHoy | null } {
  const h: Record<string, { bcv: number | null; binance: number | null }> = { ...publicadas.historial };
  const hoy = publicadas.hoy;
  if (hoy?.fecha) h[hoy.fecha] = { bcv: hoy.bcv, binance: hoy.binance };
  for (const [fecha, t] of Object.entries(manual)) {
    const base = h[fecha];
    h[fecha] = { bcv: t.bcv ?? base?.bcv ?? null, binance: t.binance ?? base?.binance ?? null };
  }
  const ultimo = Object.keys(h).sort().at(-1);
  if (!ultimo) return { historial: h, tasaHoy: null };
  const t = h[ultimo] as { bcv: number | null; binance: number | null };
  const esManual = ultimo in manual;
  return {
    historial: h,
    tasaHoy: {
      fecha: ultimo,
      bcv: t.bcv,
      binance: t.binance,
      manual: esManual,
      fuente: esManual ? 'Corregida a mano' : ultimo === hoy?.fecha ? (hoy.fuente ?? '') : 'Historial',
    },
  };
}
