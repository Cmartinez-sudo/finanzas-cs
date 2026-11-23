/** What the views need from storage. Supabase in production, an in-memory demo otherwise. */
import type { Historial, TasasDia } from '../core/fx';
import type { AporteMes, Categoria, Deuda, Etapa, Meta, Movimiento, Persona, Plan } from '../core/model';

export interface TasasHoy extends TasasDia {
  fuente: string;
  manual: boolean;
}

export interface Datos {
  categorias: Categoria[];
  metas: Meta[];
  deudas: Deuda[];
  planes: Plan[];
  etapas: Etapa[];
  movimientos: Movimiento[];
  aportes: AporteMes[];
  /** Daily rates (automatic history merged with manual corrections). */
  historial: Historial;
  tasaHoy: TasasHoy | null;
  notas: string;
}

export interface Respaldo {
  version: 3;
  exportado: string;
  datos: Omit<Datos, 'historial' | 'tasaHoy'> & { tasasManual: Historial };
}

export interface Repo {
  readonly modo: 'supabase' | 'demo';
  /** Person signed in; in demo mode, the one picked on screen. */
  persona: Persona | null;
  cargar(): Promise<Datos>;
  /** Calls back when the other person changes something. Returns an unsubscribe function. */
  suscribir(cb: () => void): () => void;

  guardarMovimiento(m: Movimiento): Promise<void>;
  borrarMovimiento(id: string): Promise<void>;
  guardarAporte(a: AporteMes): Promise<void>;

  guardarPlan(p: Plan): Promise<void>;
  guardarCategorias(cs: Categoria[]): Promise<void>;
  guardarMeta(m: Meta): Promise<void>;
  guardarDeuda(d: Deuda): Promise<void>;
  guardarEtapa(e: Etapa): Promise<void>;
  borrarEtapa(id: string): Promise<void>;
  guardarNotas(notas: string): Promise<void>;
  guardarTasaManual(fecha: string, bcv: number, binance: number): Promise<void>;

  exportar(): Promise<Respaldo>;
  importar(r: Respaldo): Promise<void>;
}

export const nuevoId = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`)
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 20);
