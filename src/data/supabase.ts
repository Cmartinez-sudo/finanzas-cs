/** Supabase storage. Row Level Security (supabase/migrations) decides who can read and write. */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Historial } from '../core/fx';
import type { AporteMes, Categoria, Deuda, Etapa, Meta, Movimiento, Persona, Plan } from '../core/model';
import type { Datos, Repo, Respaldo } from './repo';
import { cargarTasasPublicadas, combinarTasas } from './tasas';

type Row = Record<string, unknown>;
const num = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x));
const int = (x: unknown): number => Number(x ?? 0);

const aCategoria = (r: Row): Categoria => ({
  id: String(r.id),
  grupo: r.grupo as Categoria['grupo'],
  persona: (r.persona as Persona | null) ?? null,
  nombre: String(r.nombre),
  orden: int(r.orden),
  archivada: Boolean(r.archivada),
});
const deCategoria = (c: Categoria): Row => ({ ...c });

const aMeta = (r: Row): Meta => ({
  id: String(r.id),
  nombre: String(r.nombre),
  tipo: r.tipo as Meta['tipo'],
  persona: (r.persona as Persona | null) ?? null,
  cuenta: String(r.cuenta ?? ''),
  topeCents: num(r.tope_cents),
  saldoInicialCents: int(r.saldo_inicial_cents),
  orden: int(r.orden),
  archivada: Boolean(r.archivada),
});
const deMeta = (m: Meta): Row => ({
  id: m.id,
  nombre: m.nombre,
  tipo: m.tipo,
  persona: m.persona,
  cuenta: m.cuenta,
  tope_cents: m.topeCents,
  saldo_inicial_cents: m.saldoInicialCents,
  orden: m.orden,
  archivada: m.archivada,
});

const aDeuda = (r: Row): Deuda => ({
  id: String(r.id),
  nombre: String(r.nombre),
  persona: r.persona as Persona,
  moneda: r.moneda as Deuda['moneda'],
  saldoInicialCents: int(r.saldo_inicial_cents),
  fechaSaldo: String(r.fecha_saldo),
  archivada: Boolean(r.archivada),
});
const deDeuda = (d: Deuda): Row => ({
  id: d.id,
  nombre: d.nombre,
  persona: d.persona,
  moneda: d.moneda,
  saldo_inicial_cents: d.saldoInicialCents,
  fecha_saldo: d.fechaSaldo,
  archivada: d.archivada,
});

const aPlan = (r: Row): Plan => ({
  ...(r.data as Omit<Plan, 'vigenteDesde'>),
  vigenteDesde: String(r.vigente_desde),
});
const dePlan = ({ vigenteDesde, ...data }: Plan): Row => ({ vigente_desde: vigenteDesde, data });

const aEtapa = (r: Row): Etapa => ({
  id: String(r.id),
  nombre: String(r.nombre),
  desde: String(r.desde),
  hasta: (r.hasta as string | null) ?? null,
});

const aMovimiento = (r: Row): Movimiento => ({
  id: String(r.id),
  fecha: String(r.fecha),
  tipo: r.tipo as Movimiento['tipo'],
  persona: r.persona as Persona,
  categoriaId: (r.categoria_id as string | null) ?? null,
  metaId: (r.meta_id as string | null) ?? null,
  deudaId: (r.deuda_id as string | null) ?? null,
  moneda: r.moneda as Movimiento['moneda'],
  montoCents: int(r.monto_cents),
  tasaBcv: num(r.tasa_bcv),
  tasaCompra: num(r.tasa_compra),
  tasaManual: Boolean(r.tasa_manual),
  realCents: int(r.real_cents),
  bsCents: num(r.bs_cents),
  ahorroCents: int(r.ahorro_cents),
  nota: String(r.nota ?? ''),
  planCubiertoCents: int(r.plan_cubierto_cents),
  creadoEn: Date.parse(String(r.creado_en)) || 0,
});
const deMovimiento = (m: Movimiento): Row => ({
  id: m.id,
  fecha: m.fecha,
  tipo: m.tipo,
  persona: m.persona,
  categoria_id: m.categoriaId,
  meta_id: m.metaId,
  deuda_id: m.deudaId,
  moneda: m.moneda,
  monto_cents: m.montoCents,
  tasa_bcv: m.tasaBcv,
  tasa_compra: m.tasaCompra,
  tasa_manual: m.tasaManual,
  real_cents: m.realCents,
  bs_cents: m.bsCents,
  ahorro_cents: m.ahorroCents,
  nota: m.nota,
  plan_cubierto_cents: m.planCubiertoCents,
  creado_en: new Date(m.creadoEn || Date.now()).toISOString(),
  updated_at: new Date().toISOString(),
});

const aAporte = (r: Row): AporteMes => ({
  mes: String(r.mes),
  persona: r.persona as Persona,
  clave: String(r.clave),
  montoCents: int(r.monto_cents),
  hecho: Boolean(r.hecho),
  tasaCompra: num(r.tasa_compra),
});
const deAporte = (a: AporteMes): Row => ({
  mes: a.mes,
  persona: a.persona,
  clave: a.clave,
  monto_cents: a.montoCents,
  hecho: a.hecho,
  tasa_compra: a.tasaCompra,
  updated_at: new Date().toISOString(),
});

const TABLAS = [
  'categorias',
  'metas',
  'deudas',
  'planes',
  'etapas',
  'ajustes',
  'movimientos',
  'aportes_mes',
  'tasas_manual',
] as const;

export class SupabaseRepo implements Repo {
  readonly modo = 'supabase' as const;
  persona: Persona | null = null;
  readonly sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private async q<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw error;
    return data as T;
  }

  /** Resolves the signed-in user's person from the pareja table; null if the account is not allowed. */
  async resolverPersona(user: User | null): Promise<Persona | null> {
    this.persona = null;
    if (!user?.email) return null;
    const rows = await this.q<Row[]>(this.sb.from('pareja').select('persona').eq('email', user.email));
    this.persona = (rows[0]?.persona as Persona | undefined) ?? null;
    return this.persona;
  }

  private async tasasManual(): Promise<Historial> {
    const rows = await this.q<Row[]>(this.sb.from('tasas_manual').select('fecha,bcv,binance'));
    return Object.fromEntries(
      rows.map((r) => [String(r.fecha), { bcv: num(r.bcv), binance: num(r.binance) }]),
    );
  }

  async cargar(): Promise<Datos> {
    const s = (t: string) => this.q<Row[]>(this.sb.from(t).select('*'));
    const [cats, metas, deudas, planes, etapas, ajustes, movs, aportes, manual, publicadas] =
      await Promise.all([
        s('categorias'),
        s('metas'),
        s('deudas'),
        s('planes'),
        s('etapas'),
        s('ajustes'),
        s('movimientos'),
        s('aportes_mes'),
        this.tasasManual(),
        cargarTasasPublicadas(),
      ]);
    const { historial, tasaHoy } = combinarTasas(publicadas, manual);
    return {
      categorias: cats.map(aCategoria),
      metas: metas.map(aMeta),
      deudas: deudas.map(aDeuda),
      planes: planes.map(aPlan),
      etapas: etapas.map(aEtapa),
      movimientos: movs.map(aMovimiento),
      aportes: aportes.map(aAporte),
      historial,
      tasaHoy,
      notas: String(ajustes[0]?.notas ?? ''),
    };
  }

  suscribir(cb: () => void): () => void {
    let t: ReturnType<typeof setTimeout> | undefined;
    const avisar = () => {
      clearTimeout(t);
      t = setTimeout(cb, 300);
    };
    let canal = this.sb.channel('cambios');
    for (const table of TABLAS)
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table }, avisar);
    canal.subscribe();
    return () => {
      clearTimeout(t);
      void this.sb.removeChannel(canal);
    };
  }

  async guardarMovimiento(m: Movimiento) {
    await this.q(this.sb.from('movimientos').upsert(deMovimiento(m)));
  }
  async borrarMovimiento(id: string) {
    await this.q(this.sb.from('movimientos').delete().eq('id', id));
  }
  async guardarAporte(a: AporteMes) {
    await this.q(this.sb.from('aportes_mes').upsert(deAporte(a)));
  }
  async guardarPlan(p: Plan) {
    await this.q(this.sb.from('planes').upsert({ ...dePlan(p), updated_at: new Date().toISOString() }));
  }
  async guardarCategorias(cs: Categoria[]) {
    if (cs.length) await this.q(this.sb.from('categorias').upsert(cs.map(deCategoria)));
  }
  async guardarMeta(m: Meta) {
    await this.q(this.sb.from('metas').upsert(deMeta(m)));
  }
  async guardarDeuda(d: Deuda) {
    await this.q(this.sb.from('deudas').upsert(deDeuda(d)));
  }
  async guardarEtapa(e: Etapa) {
    await this.q(this.sb.from('etapas').upsert(e));
  }
  async borrarEtapa(id: string) {
    await this.q(this.sb.from('etapas').delete().eq('id', id));
  }
  async guardarNotas(notas: string) {
    await this.q(this.sb.from('ajustes').upsert({ id: 'app', notas, updated_at: new Date().toISOString() }));
  }
  async guardarTasaManual(fecha: string, bcv: number, binance: number) {
    await this.q(this.sb.from('tasas_manual').upsert({ fecha, bcv, binance, por: this.persona }));
  }

  async exportar(): Promise<Respaldo> {
    const d = await this.cargar();
    const { historial: _h, tasaHoy: _t, ...resto } = d;
    return {
      version: 3,
      exportado: new Date().toISOString(),
      datos: { ...resto, tasasManual: await this.tasasManual() },
    };
  }

  /** Restores a validated backup. Movements and checklist rows of the other person are skipped by RLS. */
  async importar(r: Respaldo) {
    const d = r.datos;
    const up = async (t: string, rows: Row[]) => {
      for (let i = 0; i < rows.length; i += 500) await this.q(this.sb.from(t).upsert(rows.slice(i, i + 500)));
    };
    await up('categorias', d.categorias.map(deCategoria));
    await up('metas', d.metas.map(deMeta));
    await up('deudas', d.deudas.map(deDeuda));
    await up('planes', d.planes.map(dePlan));
    await up('etapas', d.etapas as unknown as Row[]);
    await this.guardarNotas(d.notas);
    const mias = <T extends { persona: Persona }>(xs: T[]) => xs.filter((x) => x.persona === this.persona);
    await up('movimientos', mias(d.movimientos).map(deMovimiento));
    await up('aportes_mes', mias(d.aportes).map(deAporte));
  }
}
