/** App state: one object, replaced on every change; views re-render from it. */
import type { Periodo } from '../core/fechas';
import { mesActual } from '../core/fechas';
import type { Persona } from '../core/model';
import type { Datos, Repo } from '../data/repo';

export type Tab = 'inicio' | 'gastos' | 'resumen' | 'fondos' | 'ajustes';
export type Filtro = 'mios' | 'casa' | 'otro' | 'todos';
export type Vista = 'juntos' | Persona;

export interface Estado {
  datos: Datos | null;
  error: string | null;
  persona: Persona;
  mes: string;
  tab: Tab;
  /** Sub-page inside Ajustes, e.g. 'plan', 'categorias'. */
  pagina: string | null;
  verPersona: Persona;
  filtro: Filtro;
  resumen: { vista: Vista; periodo: Periodo; ancla: string; comparar: boolean; etapa: string | null };
}

const leer = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const recordar = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: remembering is only a convenience */
  }
};

const TABS: Tab[] = ['inicio', 'gastos', 'resumen', 'fondos'];
const tabGuardada = leer('tab') as Tab | null;

let estado: Estado = {
  datos: null,
  error: null,
  persona: 'carlos',
  mes: mesActual(),
  tab: tabGuardada && TABS.includes(tabGuardada) ? tabGuardada : 'inicio',
  pagina: null,
  verPersona: 'carlos',
  filtro: 'mios',
  resumen: { vista: 'juntos', periodo: 'mes', ancla: mesActual(), comparar: false, etapa: null },
};

const oyentes = new Set<(e: Estado) => void>();

export const get = (): Estado => estado;

export function set(patch: Partial<Estado>): void {
  estado = { ...estado, ...patch };
  for (const f of oyentes) f(estado);
}

export function alCambiar(f: (e: Estado) => void): void {
  oyentes.add(f);
}

let repo: Repo | null = null;
export const setRepo = (r: Repo): void => {
  repo = r;
};
export function getRepo(): Repo {
  if (!repo) throw new Error('Repo not ready');
  return repo;
}

/** Reloads everything from storage and keeps the current screen. */
export async function recargar(): Promise<void> {
  try {
    set({ datos: await getRepo().cargar(), error: null });
  } catch (e) {
    console.error(e);
    const rls = /row-level security|42501|permission/i.test(
      String((e as { message?: string })?.message ?? e),
    );
    set({ error: rls ? 'sin-acceso' : 'carga' });
  }
}
