/**
 * Demo mode: made-up data generated deterministically from a seed, kept in this browser only.
 * Used when Supabase is not configured, for development and for the screenshots.
 */
import { costoReal, tasasDelDia, type Historial, type Moneda } from '../core/fx';
import { CATEGORIAS, METAS, PLAN } from '../core/fixtures';
import { roundHalfAway } from '../core/money';
import { mesDe, type AporteMes, type Deuda, type Movimiento, type Persona, type Plan } from '../core/model';
import { aportesPlan, ajusteCasa, planDelMes } from '../core/plan';
import type { Datos, Repo, Respaldo } from './repo';

const CLAVE = 'finanzas-demo-v1';
const CLAVE_PERSONA = 'finanzas-demo-persona';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DEUDAS_DEMO: Deuda[] = [
  {
    id: 'deuda-carlos',
    nombre: 'Préstamo en Bs',
    persona: 'carlos',
    moneda: 'VES',
    saldoInicialCents: 26_000_000,
    fechaSaldo: '2026-04-01',
    archivada: false,
  },
  {
    id: 'deuda-sofia',
    nombre: 'Tarjeta de crédito',
    persona: 'sofia',
    moneda: 'USD',
    saldoInicialCents: 190_000,
    fechaSaldo: '2026-04-01',
    archivada: false,
  },
];

/** Generates the demo dataset from April 2026 up to `hoy`. */
export function generarDemo(hoy = new Date()): Omit<Datos, 'tasaHoy'> & { tasasManual: Historial } {
  const rnd = mulberry32(20260401);
  const inicio = new Date(2026, 3, 1);

  const historial: Record<string, { bcv: number | null; binance: number | null }> = {};
  const dias = Math.max(0, Math.round((hoy.getTime() - inicio.getTime()) / 864e5));
  for (let i = 0; i <= dias; i++) {
    const d = new Date(2026, 3, 1 + i);
    const bcv = 480 * Math.pow(919.82 / 480, i / Math.max(1, dias)) * (1 + (rnd() - 0.5) * 0.01);
    const brecha = 1.13 + 0.05 * Math.sin(i / 23) + (rnd() - 0.5) * 0.02;
    const finde = d.getDay() === 0 || d.getDay() === 6;
    historial[isoDia(d)] = {
      bcv: finde ? null : Math.round(bcv * 100) / 100,
      binance: Math.round(bcv * brecha * 100) / 100,
    };
  }

  const v1: Plan = { ...PLAN, vigenteDesde: '2026-04' };
  const v2: Plan = {
    ...PLAN,
    vigenteDesde: '2026-09',
    ingresos: { carlos: 300_000, sofia: 262_500 },
    aportes: {
      carlos: { viaje: 25_000, emergencia: 15_000, 'inv-carlos': 15_000, 'deuda-carlos': 0 },
      sofia: { viaje: 20_000, emergencia: 12_500, 'inv-sofia': 15_000, 'deuda-sofia': 25_000 },
    },
  };
  const planes = [v1, v2];
  const metas = METAS.map((m) => (m.id === 'emergencia' ? { ...m, saldoInicialCents: 80_000 } : m));

  const movimientos: Movimiento[] = [];
  const aportes: AporteMes[] = [];
  let n = 0;
  const veces: Record<string, [number, number]> = {
    mercado: [4, 6],
    limpieza: [2, 2],
    mascota: [1, 2],
    imprevisto: [0, 2],
    'c-hobby': [1, 3],
    's-belleza': [1, 3],
    'c-gasolina': [2, 4],
    's-gasolina': [1, 2],
    'c-libre': [3, 7],
    's-libre': [3, 7],
  };
  const enBs = new Set(['mercado', 'condominio', 'luz', 'c-gasolina', 's-gasolina', 'limpieza', 'mascota']);
  const notas: Record<string, string[]> = {
    mercado: ['Automercado', 'Frutas y verduras', 'Carnicería', ''],
    'c-libre': ['Cena', 'Café', 'Cine', ''],
    's-libre': ['Almuerzo', 'Regalo', 'Libro', ''],
    imprevisto: ['Plomero', 'Farmacia'],
  };

  const agregar = (o: {
    fecha: string;
    tipo: Movimiento['tipo'];
    persona: Persona;
    categoriaId?: string;
    metaId?: string;
    deudaId?: string;
    usdCents: number;
    moneda?: Moneda;
    nota?: string;
  }) => {
    const t = tasasDelDia(historial, o.fecha);
    const moneda = o.moneda ?? 'USD';
    const monto = moneda === 'VES' ? roundHalfAway(o.usdCents * (t.binance ?? 1)) : o.usdCents;
    const c = costoReal(moneda, monto, t);
    movimientos.push({
      id: `demo${++n}`,
      fecha: o.fecha,
      tipo: o.tipo,
      persona: o.persona,
      categoriaId: o.categoriaId ?? null,
      metaId: o.metaId ?? null,
      deudaId: o.deudaId ?? null,
      moneda,
      montoCents: monto,
      tasaBcv: c.tasaBcv,
      tasaCompra: c.tasaCompra,
      tasaManual: false,
      realCents: c.realCents,
      bsCents: c.bsCents,
      ahorroCents: c.ahorroBrechaCents,
      nota: o.nota ?? '',
      planCubiertoCents: 0,
      creadoEn: Date.parse(o.fecha) + n,
    });
  };

  for (let m = new Date(inicio); m <= hoy; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const mes = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
    const esActual = mes === mesDe(isoDia(hoy));
    const diasMes = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const ultimoDia = esActual ? hoy.getDate() : diasMes;
    const plan = planDelMes(planes, mes) as Plan;
    const fechaDia = (d: number) => `${mes}-${pad(Math.min(d, ultimoDia))}`;

    for (const c of CATEGORIAS) {
      const pres = plan.presupuesto[c.id] ?? 0;
      if (!pres) continue;
      const persona: Persona = c.persona ?? (c.id === 'renta' ? 'carlos' : 'sofia');
      const [a, b] = veces[c.id] ?? [1, 1];
      const k = a + Math.floor(rnd() * (b - a + 1));
      const fijo = ['renta', 'internet', 'c-gym', 's-gym', 'c-seguro', 's-seguro'].includes(c.id);
      const total = fijo ? pres : pres * (0.72 + rnd() * 0.45);
      for (let i = 0; i < k; i++) {
        const dia = 1 + Math.floor(((i + rnd()) / k) * diasMes);
        if (dia > ultimoDia) continue;
        const moneda: Moneda = enBs.has(c.id) ? (rnd() < 0.5 ? 'VES' : 'USD_BCV') : 'USD';
        const lista = notas[c.id];
        agregar({
          fecha: fechaDia(dia),
          tipo: 'gasto',
          persona,
          categoriaId: c.id,
          usdCents: Math.max(100, roundHalfAway(total / k)),
          moneda,
          nota: lista ? (lista[Math.floor(rnd() * lista.length)] ?? '') : '',
        });
      }
    }

    // Checklist: past months fully ticked except for the odd miss; this month, the first days only.
    const t15 = tasasDelDia(historial, fechaDia(15));
    for (const p of ['carlos', 'sofia'] as const) {
      for (const [clave, monto] of Object.entries(aportesPlan(plan, p))) {
        const hecho = esActual ? ultimoDia >= 5 && rnd() < 0.5 : rnd() > 0.06;
        aportes.push({ mes, persona: p, clave, montoCents: monto, hecho, tasaCompra: t15.binance });
      }
    }
    const aj = ajusteCasa(plan, CATEGORIAS);
    aportes.push({
      mes,
      persona: aj.de,
      clave: 'ajuste-casa',
      montoCents: aj.montoCents,
      hecho: !esActual,
      tasaCompra: null,
    });

    if (mes === '2026-07')
      agregar({
        fecha: fechaDia(20),
        tipo: 'aporte',
        persona: 'sofia',
        metaId: 'viaje',
        usdCents: 30_000,
        nota: 'Bono',
      });
    if (mes === '2026-10')
      agregar({
        fecha: fechaDia(8),
        tipo: 'retiro',
        persona: 'carlos',
        metaId: 'viaje',
        usdCents: 62_000,
        nota: 'Pasajes',
      });
  }

  return {
    categorias: CATEGORIAS,
    metas,
    deudas: DEUDAS_DEMO,
    planes,
    etapas: [
      { id: 'e1', nombre: 'Pagando deudas', desde: '2026-04', hasta: '2026-08' },
      { id: 'e2', nombre: 'Ahorro de viaje', desde: '2026-09', hasta: null },
    ],
    movimientos,
    aportes,
    historial,
    tasasManual: {},
    notas:
      'Datos de ejemplo. Aquí anotan dónde está cada cosa: qué cuenta paga la casa, dónde está cada fondo…',
  };
}

type Guardado = ReturnType<typeof generarDemo>;

function leer(): Guardado | null {
  try {
    const s = localStorage.getItem(CLAVE);
    return s ? (JSON.parse(s) as Guardado) : null;
  } catch {
    return null;
  }
}

export class DemoRepo implements Repo {
  readonly modo = 'demo' as const;
  persona: Persona | null;
  private d: Guardado;

  constructor(hoy?: Date) {
    this.d = leer() ?? generarDemo(hoy);
    let p: string | null = null;
    try {
      p = localStorage.getItem(CLAVE_PERSONA);
    } catch {
      /* private mode */
    }
    this.persona = p === 'sofia' ? 'sofia' : 'carlos';
  }

  elegirPersona(p: Persona) {
    this.persona = p;
    try {
      localStorage.setItem(CLAVE_PERSONA, p);
    } catch {
      /* private mode */
    }
  }

  reiniciar() {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* private mode */
    }
    this.d = generarDemo();
  }

  private guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(this.d));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }

  async cargar(): Promise<Datos> {
    const ultimo = Object.keys(this.d.historial).sort().at(-1);
    const t = ultimo ? tasasDelDia(this.d.historial, ultimo) : null;
    return structuredClone({
      ...this.d,
      tasaHoy: t ? { ...t, fuente: 'Datos de ejemplo', manual: false } : null,
    });
  }

  suscribir(cb: () => void): () => void {
    const f = (e: StorageEvent) => {
      if (e.key !== CLAVE) return;
      this.d = leer() ?? this.d;
      cb();
    };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }

  private upsert<T>(lista: T[], x: T, igual: (a: T) => boolean) {
    const i = lista.findIndex(igual);
    if (i >= 0) lista[i] = x;
    else lista.push(x);
    this.guardar();
  }

  async guardarMovimiento(m: Movimiento) {
    this.upsert(this.d.movimientos, structuredClone(m), (x) => x.id === m.id);
  }
  async borrarMovimiento(id: string) {
    this.d.movimientos = this.d.movimientos.filter((x) => x.id !== id);
    this.guardar();
  }
  async guardarAporte(a: AporteMes) {
    this.upsert(
      this.d.aportes,
      { ...a },
      (x) => x.mes === a.mes && x.persona === a.persona && x.clave === a.clave,
    );
  }
  async guardarPlan(p: Plan) {
    this.upsert(this.d.planes, structuredClone(p), (x) => x.vigenteDesde === p.vigenteDesde);
  }
  async guardarCategorias(cs: typeof this.d.categorias) {
    for (const c of cs) this.upsert(this.d.categorias, { ...c }, (x) => x.id === c.id);
  }
  async guardarMeta(m: (typeof this.d.metas)[number]) {
    this.upsert(this.d.metas, { ...m }, (x) => x.id === m.id);
  }
  async guardarDeuda(d: Deuda) {
    this.upsert(this.d.deudas, { ...d }, (x) => x.id === d.id);
  }
  async guardarEtapa(e: (typeof this.d.etapas)[number]) {
    this.upsert(this.d.etapas, { ...e }, (x) => x.id === e.id);
  }
  async borrarEtapa(id: string) {
    this.d.etapas = this.d.etapas.filter((x) => x.id !== id);
    this.guardar();
  }
  async guardarNotas(notas: string) {
    this.d.notas = notas;
    this.guardar();
  }
  async guardarTasaManual(fecha: string, bcv: number, binance: number) {
    this.d.tasasManual = { ...this.d.tasasManual, [fecha]: { bcv, binance } };
    this.d.historial = { ...this.d.historial, [fecha]: { bcv, binance } };
    this.guardar();
  }
  async exportar(): Promise<Respaldo> {
    const { historial: _h, ...datos } = structuredClone(this.d);
    return { version: 3, exportado: new Date().toISOString(), datos };
  }
  async importar(r: Respaldo) {
    this.d = { ...structuredClone(r.datos), historial: { ...this.d.historial, ...r.datos.tasasManual } };
    this.guardar();
  }
}
