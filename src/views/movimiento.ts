/**
 * Sheet to add or edit a movement: expense, extra contribution, withdrawal or debt payment.
 * The cost is valued in real dollars with the rates of the movement's date and frozen on save.
 */
import { costoReal, TasaFaltante, tasasDelDia, type Moneda } from '../core/fx';
import { diaCorto, hoy, haceDias, mesActual, mesLargo } from '../core/fechas';
import { centsToInput, fmtTasa, fmtUSD, parseDecimal, parseMonto } from '../core/money';
import { mesDe, type Movimiento, type Persona, type TipoMovimiento } from '../core/model';
import { aportesPlan, itemHecho } from '../core/plan';
import { catsGrupo, catsPersona, deudasActivas, metasActivas, plan as planDe } from '../app/selectores';
import { get, getRepo, recargar, recordar, set } from '../app/store';
import { nuevoId } from '../data/repo';
import { haptic, toast, toastError } from '../ui/feedback';
import { $, html } from '../ui/html';
import { abrirSheet, cerrarSheet, sheetMarkup } from '../ui/sheet';
import { t } from '../strings';

type GrupoSel = 'casa' | 'mio' | 'imprevisto';

interface Form {
  editando: Movimiento | null;
  tipo: TipoMovimiento;
  moneda: Moneda;
  grupo: GrupoSel;
  destino: string | null;
  fecha: string;
  otraTasa: boolean;
}

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

let f: Form;
let dlg: HTMLDialogElement | null = null;

function grupoDe(catId: string | null, p: Persona): GrupoSel {
  const c = get().datos?.categorias.find((x) => x.id === catId);
  if (!c) return 'casa';
  return c.grupo === 'personal' ? (c.persona === p ? 'mio' : 'casa') : c.grupo;
}

export function abrirMovimiento(id: string | null): void {
  const e = get(),
    d = e.datos;
  if (!d) return;
  const m = id ? (d.movimientos.find((x) => x.id === id) ?? null) : null;
  if (m && m.persona !== e.persona) return;
  const ultimoGrupo = (leer(`grupo-${e.persona}`) as GrupoSel | null) ?? 'casa';
  f = {
    editando: m,
    tipo: m?.tipo ?? 'gasto',
    moneda: m?.moneda ?? (leer('moneda') as Moneda | null) ?? 'USD',
    grupo: m ? grupoDe(m.categoriaId, e.persona) : ultimoGrupo,
    destino: m ? (m.categoriaId ?? m.metaId ?? m.deudaId) : null,
    fecha: m?.fecha ?? (e.mes === mesActual() ? hoy() : `${e.mes}-01`),
    otraTasa: m?.tasaManual ?? false,
  };
  if (!f.destino && f.tipo === 'gasto') f.destino = leer(`cat-${f.grupo}`);

  const cuerpo = html` <div class="seg" role="group" aria-label="Tipo" id="mv-tipo"></div>
    <div>
      <div class="seg compact" role="group" aria-label="Moneda" id="mv-moneda"></div>
      <p class="t-foot muted" id="mv-moneda-ayuda" style="margin:6px 4px 0"></p>
    </div>
    <div>
      <label class="amount-field" for="mv-monto">
        <span class="cur" id="mv-cur">$</span>
        <input
          id="mv-monto"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
          aria-label="${t.monto}"
          value="${m ? centsToInput(m.montoCents) : ''}"
          aria-describedby="mv-equiv"
        />
      </label>
      <p class="equiv" id="mv-equiv" aria-live="polite"></p>
    </div>
    <div id="mv-tasa" class="stack" style="gap:8px">
      <p class="t-foot muted" id="mv-tasa-info" style="margin:0 4px"></p>
      <div class="list">
        <label class="cell"
          ><span class="grow">${t.otraTasa}</span>
          <input
            type="checkbox"
            role="switch"
            id="mv-otra"
            ${f.otraTasa ? 'checked' : ''}
            style="width:1.4em;height:1.4em"
        /></label>
        <label class="cell" id="mv-otra-fila" ${f.otraTasa ? '' : 'hidden'}
          ><span class="grow">${t.tasaCompra}</span>
          <input
            type="text"
            inputmode="decimal"
            id="mv-tasa-in"
            value="${m?.tasaManual && m.tasaCompra ? String(m.tasaCompra).replace('.', ',') : ''}"
        /></label>
      </div>
    </div>
    <div id="mv-destino"></div>
    <p class="notice info" id="mv-hint" hidden></p>
    <div>
      <span class="field-label">${t.fecha}</span>
      <div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:8px">
        <div class="pick-grid" id="mv-dias"></div>
        <input
          type="date"
          id="mv-fecha"
          class="text-input"
          style="width:auto;flex:1;min-width:10em"
          aria-label="${t.otraFecha}"
          value="${f.fecha}"
          max="${hoy()}"
        />
      </div>
    </div>
    <div>
      <label class="field-label" for="mv-nota">${t.nota}</label>
      <input
        id="mv-nota"
        class="text-input"
        type="text"
        maxlength="120"
        placeholder="${t.notaEj}"
        value="${m?.nota ?? ''}"
      />
    </div>
    <p class="error-text" id="mv-err" role="alert" hidden></p>
    <button class="btn wide" id="mv-guardar" type="button">${t.guardarGasto}</button>
    ${m ? html`<button class="btn destructive wide" id="mv-borrar" type="button">${t.borrar}</button>` : ''}`;

  abrirSheet(sheetMarkup('mv', titulo(), cuerpo), (dd) => {
    dlg = dd;
    dd.addEventListener('click', clic);
    dd.addEventListener('input', entrada);
    dd.addEventListener('change', entrada);
    pintar();
    setTimeout(() => $<HTMLInputElement>('#mv-monto', dd)?.focus(), 60);
  });
}

const titulo = () => (f.editando ? t.editar[f.tipo] : t.nuevo[f.tipo]);

function pintar() {
  if (!dlg) return;
  const e = get(),
    d = e.datos;
  if (!d) return;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => $<T>(s, dlg as HTMLDialogElement) as T;
  q('#mv-t').textContent = titulo();

  const seg = <K extends string>(opts: Array<[K, string]>, sel: K, accion: string) =>
    opts.map(
      ([k, n]) =>
        html`<button type="button" data-a="${accion}" data-v="${k}" aria-pressed="${k === sel}">
          ${n}
        </button>`,
    );
  q('#mv-tipo').innerHTML = html`${seg(
    (['gasto', 'aporte', 'retiro', 'pago_deuda'] as const).map(
      (k) => [k, t.tipos[k]] as [TipoMovimiento, string],
    ),
    f.tipo,
    'tipo',
  )}`.s;
  q('#mv-moneda').innerHTML = html`${seg(
    (['USD', 'VES', 'USD_BCV'] as const).map((k) => [k, t.monedas[k]] as [Moneda, string]),
    f.moneda,
    'moneda',
  )}`.s;
  q('#mv-moneda-ayuda').textContent = t.monedaAyuda[f.moneda];
  q('#mv-cur').textContent = f.moneda === 'VES' ? 'Bs' : '$';
  q('#mv-tasa').hidden = f.moneda === 'USD';
  q('#mv-otra-fila').hidden = !f.otraTasa;

  const tasas = tasasDelDia(d.historial, f.fecha);
  q('#mv-tasa-info').textContent = t.tasaDelDia(
    diaCorto(f.fecha),
    fmtTasa(tasas.bcv),
    fmtTasa(tasas.binance),
  );

  // Destination picker
  let opciones: Array<[string, string]>;
  let extra = html``;
  let etiqueta = t.categoria;
  if (f.tipo === 'gasto') {
    const cats = f.grupo === 'mio' ? catsPersona(d, e.persona) : catsGrupo(d, f.grupo);
    opciones = cats.map((c) => [c.id, c.nombre]);
    extra = html`<div class="seg" role="group" aria-label="${t.grupo}" style="margin-bottom:10px">
      ${seg<GrupoSel>(
        [
          ['casa', t.casa],
          ['mio', t.mio],
          ['imprevisto', t.imprevisto],
        ],
        f.grupo,
        'grupo',
      )}
    </div>`;
    if (!opciones.some(([id]) => id === f.destino))
      f.destino = opciones.length === 1 ? (opciones[0]?.[0] ?? null) : null;
  } else if (f.tipo === 'pago_deuda') {
    etiqueta = t.queDeuda;
    opciones = deudasActivas(d)
      .sort((a, b) => Number(b.persona === e.persona) - Number(a.persona === e.persona))
      .map((x) => [x.id, x.nombre]);
  } else {
    etiqueta = f.tipo === 'aporte' ? t.aQueFondo : t.deQueFondo;
    opciones = metasActivas(d)
      .filter((m) => m.persona === null || m.persona === e.persona)
      .map((m) => [m.id, m.nombre]);
  }
  if (f.tipo !== 'gasto' && !opciones.some(([id]) => id === f.destino)) f.destino = opciones[0]?.[0] ?? null;
  q('#mv-destino').innerHTML = html`<span class="field-label" id="mv-dest-l">${etiqueta}</span>${extra}
    <div class="pick-grid" role="group" aria-labelledby="mv-dest-l">
      ${opciones.map(([id, n]) => html`<button type="button" data-a="destino" data-v="${id}" aria-pressed="${id === f.destino}">${n}</button>`)}
    </div>`.s;

  q('#mv-dias').innerHTML = html`${seg(
    [
      [hoy(), t.hoy],
      [haceDias(1), t.ayer],
    ],
    f.fecha,
    'dia',
  )}`.s;
  q('#mv-guardar').textContent = f.editando ? t.guardar : t.guardarGasto;
  calcular();
}

/** Recomputes the real-cost line and the contribution hint without touching the inputs. */
function calcular(): {
  costo: ReturnType<typeof costoReal> | null;
  monto: number | null;
  error: string | null;
} {
  const d = get().datos;
  if (!dlg || !d) return { costo: null, monto: null, error: null };
  const q = (s: string) => $(s, dlg as HTMLDialogElement) as HTMLElement;
  const monto = parseMonto(($('#mv-monto', dlg) as HTMLInputElement).value);
  const manual = f.otraTasa ? parseDecimal(($('#mv-tasa-in', dlg) as HTMLInputElement).value) : null;
  let costo = null,
    error: string | null = null;
  if (monto && monto > 0) {
    try {
      costo = costoReal(f.moneda, monto, tasasDelDia(d.historial, f.fecha), manual);
    } catch (err) {
      error = err instanceof TasaFaltante ? (err.cual === 'bcv' ? t.faltaBcv : t.faltaTasa) : String(err);
    }
  }
  const eq = q('#mv-equiv');
  if (error) eq.textContent = error;
  else if (costo && f.moneda !== 'USD')
    eq.innerHTML = html`${t.costoReal}:
      <b>${fmtUSD(costo.realCents, 'exact')}</b
      >${costo.ahorroBrechaCents > 0 ? html` · ${t.ahorroBrecha(costo.ahorroBrechaCents)}` : ''}`.s;
  else eq.textContent = '';

  // Contribution hint, as in the original app
  const h = q('#mv-hint');
  const e = get();
  const plan = planDe(d, mesDe(f.fecha));
  if (f.tipo !== 'aporte' || !f.destino || !plan) h.hidden = true;
  else {
    const p = aportesPlan(plan, e.persona)[f.destino] ?? 0;
    const mes = mesDe(f.fecha);
    const yaCubre =
      f.editando?.tipo === 'aporte' &&
      f.editando.metaId === f.destino &&
      mesDe(f.editando.fecha) === mes &&
      f.editando.planCubiertoCents > 0;
    const real = costo?.realCents ?? 0;
    h.textContent = !p
      ? t.aporteHint.sinPlan
      : itemHecho(d.aportes, mes, e.persona, f.destino) && !yaCubre
        ? t.aporteHint.yaMarcado(p, mesLargo(mes))
        : real >= p
          ? t.aporteHint.marcara(p, mesLargo(mes), real - p)
          : t.aporteHint.falta(p);
    h.hidden = false;
  }
  return { costo, monto, error };
}

function clic(ev: Event) {
  const b = (ev.target as Element).closest<HTMLElement>('[data-a]');
  if (b) {
    const v = b.dataset.v as string;
    switch (b.dataset.a) {
      case 'tipo':
        f.tipo = v as TipoMovimiento;
        f.destino = null;
        break;
      case 'moneda':
        f.moneda = v as Moneda;
        break;
      case 'grupo':
        f.grupo = v as GrupoSel;
        f.destino = leer(`cat-${f.grupo}`);
        break;
      case 'destino':
        f.destino = v;
        break;
      case 'dia':
        f.fecha = v;
        ($('#mv-fecha', dlg as HTMLDialogElement) as HTMLInputElement).value = v;
        break;
    }
    pintar();
    return;
  }
  const id = (ev.target as Element).closest('button')?.id;
  if (id === 'mv-guardar') void guardar();
  if (id === 'mv-borrar') void borrar();
}

function entrada(ev: Event) {
  const el = ev.target as HTMLInputElement;
  if (el.id === 'mv-otra') {
    f.otraTasa = el.checked;
    pintar();
  } else if (el.id === 'mv-fecha' && el.value) {
    f.fecha = el.value;
    pintar();
  } else if (el.id === 'mv-monto' || el.id === 'mv-tasa-in') calcular();
}

function fallo(msg: string) {
  const err = $('#mv-err', dlg as HTMLDialogElement) as HTMLElement;
  err.textContent = msg;
  err.hidden = false;
}

async function guardar() {
  const e = get(),
    d = e.datos;
  if (!d || !dlg) return;
  const { costo, monto, error } = calcular();
  if (!monto || monto <= 0) return fallo(t.montoInvalido);
  if (error || !costo) return fallo(error ?? t.faltaTasa);
  if (!f.destino)
    return fallo(
      f.tipo === 'gasto' ? t.eligeCategoria : f.tipo === 'pago_deuda' ? t.eligeDeuda : t.eligeFondo,
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return fallo(t.fecha);

  const repo = getRepo();
  const viejo = f.editando;
  const mov: Movimiento = {
    id: viejo?.id ?? nuevoId(),
    fecha: f.fecha,
    tipo: f.tipo,
    persona: e.persona,
    categoriaId: f.tipo === 'gasto' ? f.destino : null,
    metaId: f.tipo === 'aporte' || f.tipo === 'retiro' ? f.destino : null,
    deudaId: f.tipo === 'pago_deuda' ? f.destino : null,
    moneda: f.moneda,
    montoCents: monto,
    tasaBcv: costo.tasaBcv,
    tasaCompra: costo.tasaCompra,
    tasaManual: f.moneda !== 'USD' && f.otraTasa,
    realCents: costo.realCents,
    bsCents: costo.bsCents,
    ahorroCents: costo.ahorroBrechaCents,
    nota: ($('#mv-nota', dlg) as HTMLInputElement).value.trim().slice(0, 120),
    planCubiertoCents: 0,
    creadoEn: viejo?.creadoEn ?? Date.now(),
  };
  recordar('moneda', f.moneda);
  if (f.tipo === 'gasto') {
    recordar(`grupo-${e.persona}`, f.grupo);
    recordar(`cat-${f.grupo}`, f.destino);
  }
  cerrarSheet(dlg);
  haptic();
  try {
    // An edited contribution that had ticked the checklist gives the tick back first.
    if (viejo?.tipo === 'aporte' && viejo.metaId && viejo.planCubiertoCents > 0)
      await repo.guardarAporte({
        mes: mesDe(viejo.fecha),
        persona: e.persona,
        clave: viejo.metaId,
        montoCents: viejo.planCubiertoCents,
        hecho: false,
        tasaCompra: null,
      });
    let marcar = 0;
    const plan = planDe(d, mesDe(mov.fecha));
    if (mov.tipo === 'aporte' && mov.metaId && plan) {
      const p = aportesPlan(plan, e.persona)[mov.metaId] ?? 0;
      const yaMarcado =
        itemHecho(d.aportes, mesDe(mov.fecha), e.persona, mov.metaId) &&
        !(viejo?.planCubiertoCents && viejo.metaId === mov.metaId && mesDe(viejo.fecha) === mesDe(mov.fecha));
      if (p && !yaMarcado && mov.realCents >= p) marcar = p;
      mov.planCubiertoCents = marcar;
    }
    await repo.guardarMovimiento(mov);
    const marca = (hecho: boolean) =>
      repo.guardarAporte({
        mes: mesDe(mov.fecha),
        persona: e.persona,
        clave: mov.metaId as string,
        montoCents: marcar,
        hecho,
        tasaCompra: mov.tasaCompra,
      });
    if (marcar) await marca(true);
    if (mesDe(mov.fecha) !== e.mes) set({ mes: mesDe(mov.fecha) });
    await recargar();
    const que = t.tipos[mov.tipo];
    toast(viejo ? t.actualizado(que) : t.guardado(que, mov.realCents) + (marcar ? t.yMarcado : ''), {
      label: t.deshacer,
      fn: async () => {
        try {
          if (viejo) await repo.guardarMovimiento(viejo);
          else await repo.borrarMovimiento(mov.id);
          if (marcar) await marca(false);
          await recargar();
          toast(t.seDeshizo);
        } catch {
          toast(t.noSeDeshizo);
        }
      },
    });
  } catch (err) {
    console.error(err);
    toastError(async () => {
      await repo.guardarMovimiento(mov);
      await recargar();
    });
  }
}

async function borrar() {
  const e = get();
  const m = f.editando;
  if (!m || !dlg) return;
  const repo = getRepo();
  cerrarSheet(dlg);
  try {
    await repo.borrarMovimiento(m.id);
    const cubre =
      m.tipo === 'aporte' &&
      m.metaId &&
      m.planCubiertoCents > 0 &&
      e.datos &&
      itemHecho(e.datos.aportes, mesDe(m.fecha), e.persona, m.metaId);
    const marca = (hecho: boolean) =>
      repo.guardarAporte({
        mes: mesDe(m.fecha),
        persona: e.persona,
        clave: m.metaId as string,
        montoCents: m.planCubiertoCents,
        hecho,
        tasaCompra: m.tasaCompra,
      });
    if (cubre) await marca(false);
    await recargar();
    toast(t.borrado(t.tipos[m.tipo]), {
      label: t.deshacer,
      fn: async () => {
        try {
          await repo.guardarMovimiento(m);
          if (cubre) await marca(true);
          await recargar();
          toast(t.seDeshizo);
        } catch {
          toast(t.noSeDeshizo);
        }
      },
    });
  } catch (err) {
    console.error(err);
    toastError();
  }
}
