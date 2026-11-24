/**
 * Ajustes: the editable plan (amounts and structure), notes, appearance, backup and account.
 * Plan edits are saved as the version for the current month; earlier months keep theirs.
 */
import { mesActual, mesLargo } from '../core/fechas';
import { centsToInput, fmtUSD, parseDecimal, parseMonto } from '../core/money';
import {
  PERSONAS,
  type Categoria,
  type Deuda,
  type Etapa,
  type GrupoGasto,
  type Meta,
  type Persona,
  type Plan,
  type TipoMeta,
} from '../core/model';
import { categoriasCompartidas, partesCasa } from '../core/plan';
import { catsGrupo, catsPersona, deudasActivas, metasActivas, plan as planDe } from '../app/selectores';
import { get, getRepo, recargar, recordar, set } from '../app/store';
import { DemoRepo } from '../data/demo';
import { nuevoId, type Datos } from '../data/repo';
import { RespaldoInvalido, validarRespaldo } from '../data/respaldo';
import { onChange, onClick } from '../ui/eventos';
import { toast, toastError } from '../ui/feedback';
import { $, html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { NOMBRE, t } from '../strings';
import { VERSION } from '../version';
import { aplicarTema, temaGuardado } from '../app/tema';

const PAGINAS: Record<string, string> = {
  plan: 'Montos del plan',
  reparto: 'Reparto de la casa',
  categorias: 'Categorías',
  metas: 'Fondos y metas',
  deudas: 'Deudas',
  etapas: 'Etapas del plan',
  notas: 'Dónde está cada cosa',
};

const celda = (pagina: string, ico: string, k: string, titulo: string, valor = '') =>
  html`<button class="cell has-icon" data-on="ir-ajustes" data-pagina="${pagina}">
    <span class="badge-icon k-${k}">${icon(ico)}</span><span class="grow">${titulo}</span>
    <span class="value">${valor}</span>${icon('der', 'i chev')}
  </button>`;

function cabeceraPagina(titulo: string, conGuardar: boolean): Html {
  return html`<header class="nav-head" style="flex-direction:column;align-items:stretch;gap:0">
    <div class="row">
      <button class="back" data-on="ir-ajustes" data-pagina="">${icon('izq')}${t.ajustes}</button>
      ${conGuardar ? html`<button class="btn small" data-on="guardar-pagina">${t.guardar}</button>` : ''}
    </div>
    <h1 class="t-large" tabindex="-1">${titulo}</h1>
  </header>`;
}

const inMoney = (k: string, v: number | null | undefined, label: string) =>
  html`<input
    type="text"
    inputmode="decimal"
    data-k="${k}"
    value="${centsToInput(v ?? 0)}"
    placeholder="0"
    aria-label="${label}"
  />`;

function raiz(d: Datos): Html {
  const e = get();
  const repo = getRepo();
  const p = planDe(d, mesActual());
  const reparto =
    p?.reparto.tipo === 'mitad'
      ? '50/50'
      : p?.reparto.tipo === 'manual'
        ? `${p.reparto.carlosPct}/${100 - p.reparto.carlosPct}`
        : 'Por ingreso';
  const tema = temaGuardado();
  const email = repo.modo === 'supabase' ? (document.body.dataset.email ?? '') : '';
  return html`<header class="nav-head">
      <h1 class="t-large" tabindex="-1">${t.ajustes}</h1>
      <button class="link" data-on="ir-tab" data-tab="inicio">${t.listo}</button>
    </header>
    <div class="stack">
      ${repo.modo === 'demo' ? html`<p class="banner">${icon('info')}${t.demo}</p>` : ''}
      <section>
        <h2 class="section-title">Plan</h2>
        <div class="list">
          ${celda('plan', 'dolar', 'casa', PAGINAS.plan as string, p ? fmtUSD(p.ingresos.carlos + p.ingresos.sofia, 'whole') : '')}
          ${celda('reparto', 'casa', 'casa', PAGINAS.reparto as string, reparto)}
          ${celda('notas', 'notas', 'otra', PAGINAS.notas as string)}
        </div>
        <p class="section-foot">
          Los cambios cuentan desde ${mesLargo(mesActual())}. Los meses anteriores conservan el plan que
          tenían.
        </p>
      </section>
      <section>
        <h2 class="section-title">Estructura</h2>
        <div class="list">
          ${celda('categorias', 'lista', 'imprevisto', PAGINAS.categorias as string, String(d.categorias.filter((c) => !c.archivada).length))}
          ${celda('metas', 'meta', 'viaje', PAGINAS.metas as string, String(metasActivas(d).length))}
          ${celda('deudas', 'tarjeta', 'deuda', PAGINAS.deudas as string, String(deudasActivas(d).length))}
          ${celda('etapas', 'etapas', 'inversion', PAGINAS.etapas as string, String(d.etapas.length))}
        </div>
      </section>
      <section>
        <h2 class="section-title">Apariencia</h2>
        <div class="list">
          <div class="cell">
            <div class="seg grow" role="group" aria-label="Tema">
              ${(['auto', 'light', 'dark'] as const).map((k) => html`<button data-on="tema" data-v="${k}" aria-pressed="${tema === k}">${k === 'auto' ? 'Automático' : k === 'light' ? 'Claro' : 'Oscuro'}</button>`)}
            </div>
          </div>
        </div>
      </section>
      <section>
        <h2 class="section-title">Respaldo</h2>
        <div class="list">
          <button class="cell has-icon" data-on="exportar">
            <span class="badge-icon k-casa">${icon('descargar')}</span
            ><span class="grow">Descargar copia</span>
          </button>
          <label class="cell has-icon" style="cursor:pointer"
            ><span class="badge-icon k-otra">${icon('subir')}</span><span class="grow">Cargar copia</span>
            <input type="file" accept="application/json,.json" data-change="importar" class="sr-only"
          /></label>
        </div>
        <p class="section-foot" id="imp-msg" aria-live="polite">
          Una copia guarda todo el plan y los movimientos en un archivo.
        </p>
      </section>
      <section>
        <h2 class="section-title">Cuenta</h2>
        <div class="list">
          ${
            repo.modo === 'supabase'
              ? html`<div class="cell">
                    <span class="grow">${NOMBRE[e.persona]}</span><span class="value">${email}</span>
                  </div>
                  <button class="cell has-icon" data-on="salir">
                    <span class="badge-icon k-emergencia">${icon('salir')}</span
                    ><span class="grow bad">Cerrar sesión</span>
                  </button>`
              : html`<button class="cell has-icon" data-on="cambiar-persona">
                    <span class="badge-icon k-${e.persona}">${icon('persona')}</span
                    ><span class="grow">Ver como ${NOMBRE[e.persona === 'carlos' ? 'sofia' : 'carlos']}</span>
                  </button>
                  <button class="cell has-icon" data-on="reiniciar-demo">
                    <span class="badge-icon k-emergencia">${icon('basura')}</span
                    ><span class="grow bad">Reiniciar datos de ejemplo</span>
                  </button>`
          }
        </div>
        <p class="section-foot">Versión ${VERSION}</p>
      </section>
    </div>`;
}

function paginaPlan(d: Datos): Html {
  const p = planDe(d, mesActual());
  const metas = metasActivas(d);
  const deudas = deudasActivas(d);
  const grupoCats = (titulo: string, cats: Categoria[]) =>
    html`<section>
      <h2 class="section-title">${titulo}</h2>
      <div class="list">
        ${cats.map((c) => html`<label class="cell"><span class="grow">${c.nombre}</span>${inMoney(`pres:${c.id}`, p?.presupuesto[c.id], c.nombre)}</label>`)}
      </div>
    </section>`;
  const aportesDe = (q: Persona) => {
    const items = [
      ...metas.filter((m) => m.persona === null || m.persona === q).map((m) => [m.id, m.nombre] as const),
      ...deudas.filter((x) => x.persona === q).map((x) => [x.id, `Pago · ${x.nombre}`] as const),
    ];
    return html`<section>
      <h2 class="section-title">Aportes de ${NOMBRE[q]}</h2>
      <div class="list">
        ${items.map(([id, n]) => html`<label class="cell"><span class="grow">${n}</span>${inMoney(`ap:${q}:${id}`, p?.aportes[q]?.[id], n)}</label>`)}
      </div>
    </section>`;
  };
  return html`${cabeceraPagina(PAGINAS.plan as string, true)}
    <div class="stack">
      <p class="notice info">
        ${icon('calendario')}<span
          >Estos montos se guardan como el plan de ${mesLargo(mesActual())} en adelante.</span
        >
      </p>
      <section>
        <h2 class="section-title">Ingresos mensuales</h2>
        <div class="list">
          ${PERSONAS.map((q) => html`<label class="cell"><span class="grow">${NOMBRE[q]}</span>${inMoney(`ing:${q}`, p?.ingresos[q], `Ingreso de ${NOMBRE[q]}`)}</label>`)}
        </div>
      </section>
      ${grupoCats('Casa (compartido)', catsGrupo(d, 'casa'))}
      ${grupoCats('Imprevistos (compartido)', catsGrupo(d, 'imprevisto'))}
      ${grupoCats('Fijos + libre de Carlos', catsPersona(d, 'carlos'))}
      ${grupoCats('Fijos + libre de Sofía', catsPersona(d, 'sofia'))} ${aportesDe('carlos')}
      ${aportesDe('sofia')}
      <button class="btn wide" data-on="guardar-pagina">${t.guardar}</button>
    </div>`;
}

function paginaReparto(d: Datos): Html {
  const p = planDe(d, mesActual());
  const r = p?.reparto ?? { tipo: 'proporcional' as const };
  const partes = p ? partesCasa(p, d.categorias) : null;
  const opcion = (v: string, n: string, sub: string) =>
    html`<label class="cell"
      ><input
        type="radio"
        name="reparto"
        value="${v}"
        ${r.tipo === v ? 'checked' : ''}
        style="width:1.3em;height:1.3em"
      />
      <span class="grow"><span class="title">${n}</span><span class="subtitle">${sub}</span></span></label
    >`;
  const quien = (id: string, actual: Persona) =>
    html`<select data-k="paga:${id}" aria-label="Quién paga">
      ${PERSONAS.map((q) => html`<option value="${q}" ${q === actual ? 'selected' : ''}>${NOMBRE[q]}</option>`)}
    </select>`;
  return html`${cabeceraPagina(PAGINAS.reparto as string, true)}
    <div class="stack">
      <section>
        <h2 class="section-title">Cómo se reparte lo compartido</h2>
        <div class="list">
          ${opcion('proporcional', 'Según los ingresos', 'Como hasta ahora: cada uno pone en proporción a lo que gana.')}
          ${opcion('mitad', 'Mitad y mitad', '50/50 sin importar los ingresos.')}
          ${opcion('manual', 'Porcentaje fijo', 'Ustedes eligen cuánto pone Carlos.')}
          <label class="cell"
            ><span class="grow">Carlos pone (%)</span>
            <input
              type="text"
              inputmode="numeric"
              data-k="pct"
              value="${r.tipo === 'manual' ? r.carlosPct : 50}"
              aria-label="Porcentaje de Carlos"
          /></label>
        </div>
        ${partes ? html`<p class="section-foot">Hoy: Carlos ${fmtUSD(partes.carlos, 'whole')} · Sofía ${fmtUSD(partes.sofia, 'whole')} al mes.</p>` : ''}
      </section>
      <section>
        <h2 class="section-title">Quién paga cada cuenta</h2>
        <div class="list">
          ${categoriasCompartidas(d.categorias).map((c) => html`<label class="cell"><span class="grow">${c.nombre}</span>${quien(c.id, p?.pagosCompartidos[c.id] ?? p?.pagaResto ?? 'sofia')}</label>`)}
        </div>
        <p class="section-foot">
          Con esto se calcula la transferencia del "ajuste de la casa" para quedar parejos.
        </p>
      </section>
      <button class="btn wide" data-on="guardar-pagina">${t.guardar}</button>
    </div>`;
}

const GRUPOS: Array<[GrupoGasto, Persona | null, string]> = [
  ['casa', null, 'Casa'],
  ['imprevisto', null, 'Imprevistos'],
  ['personal', 'carlos', 'Carlos'],
  ['personal', 'sofia', 'Sofía'],
];

function paginaCategorias(d: Datos): Html {
  return html`${cabeceraPagina(PAGINAS.categorias as string, true)}
    <div class="stack">
      ${GRUPOS.map(([g, q, n]) => {
        const cats = d.categorias
          .filter((c) => c.grupo === g && c.persona === q)
          .sort((a, b) => a.orden - b.orden);
        return html`<section>
          <h2 class="section-title">${n}</h2>
          <div class="list">
            ${cats.map(
              (c) =>
                html`<div class="cell" data-cat="${c.id}">
                  <input
                    type="text"
                    class="grow"
                    style="text-align:left;width:auto"
                    data-k="nombre"
                    value="${c.nombre}"
                    maxlength="40"
                    aria-label="Nombre"
                  />
                  <label class="t-foot muted" style="display:flex;gap:6px;align-items:center;min-height:44px"
                    >Archivar
                    <input
                      type="checkbox"
                      data-k="archivada"
                      ${c.archivada ? 'checked' : ''}
                      style="width:1.2em;height:1.2em"
                  /></label>
                </div>`,
            )}
            <button class="cell link" data-on="nueva-cat" data-g="${g}" data-p="${q ?? ''}">
              ${icon('mas')} Agregar categoría
            </button>
          </div>
        </section>`;
      })}
      <p class="section-foot">Archivar oculta la categoría sin borrar los gastos que ya tiene.</p>
    </div>`;
}

const TIPOS_META: Array<[TipoMeta, string]> = [
  ['viaje', 'Viaje'],
  ['emergencia', 'Emergencia'],
  ['inversion', 'Inversión'],
  ['otra', 'Otra'],
];

function paginaMetas(d: Datos): Html {
  const metas = [...d.metas].sort((a, b) => a.orden - b.orden);
  return html`${cabeceraPagina(PAGINAS.metas as string, true)}
    <div class="stack">
      ${metas.map(
        (m) =>
          html`<section data-meta="${m.id}">
            <div class="list">
              <label class="cell"
                ><span class="grow">Nombre</span
                ><input type="text" data-k="nombre" value="${m.nombre}" maxlength="40"
              /></label>
              <label class="cell"
                ><span class="grow">Tipo</span
                ><select data-k="tipo">
                  ${TIPOS_META.map(([k, n]) => html`<option value="${k}" ${m.tipo === k ? 'selected' : ''}>${n}</option>`)}
                </select></label
              >
              <label class="cell"
                ><span class="grow">Es de</span
                ><select data-k="persona">
                  <option value="" ${m.persona === null ? 'selected' : ''}>Los dos</option>
                  ${PERSONAS.map((q) => html`<option value="${q}" ${m.persona === q ? 'selected' : ''}>${NOMBRE[q]}</option>`)}
                </select></label
              >
              <label class="cell"
                ><span class="grow">Cuenta</span
                ><input type="text" data-k="cuenta" value="${m.cuenta}" maxlength="80"
              /></label>
              <label class="cell"
                ><span class="grow">Tope (meta)</span>${inMoney('tope', m.topeCents, 'Tope')}</label
              >
              <label class="cell"
                ><span class="grow">Saldo inicial</span
                >${inMoney('inicial', m.saldoInicialCents, 'Saldo inicial')}</label
              >
              <label class="cell"
                ><span class="grow">Archivar</span
                ><input
                  type="checkbox"
                  data-k="archivada"
                  ${m.archivada ? 'checked' : ''}
                  style="width:1.2em;height:1.2em"
              /></label>
            </div>
          </section>`,
      )}
      <button class="btn secondary wide" data-on="nueva-meta">${icon('mas')} Agregar fondo o meta</button>
      <p class="section-foot">
        Deja el tope vacío si el fondo no tiene meta (por ejemplo, la inversión). El saldo inicial es lo que
        ya tenían antes de usar la app.
      </p>
    </div>`;
}

function paginaDeudas(d: Datos): Html {
  return html`${cabeceraPagina(PAGINAS.deudas as string, true)}
    <div class="stack">
      ${d.deudas.map(
        (x) =>
          html`<section data-deuda="${x.id}">
            <div class="list">
              <label class="cell"
                ><span class="grow">Nombre</span
                ><input type="text" data-k="nombre" value="${x.nombre}" maxlength="40"
              /></label>
              <label class="cell"
                ><span class="grow">De</span
                ><select data-k="persona">
                  ${PERSONAS.map((q) => html`<option value="${q}" ${x.persona === q ? 'selected' : ''}>${NOMBRE[q]}</option>`)}
                </select></label
              >
              <label class="cell"
                ><span class="grow">Moneda</span
                ><select data-k="moneda">
                  <option value="USD" ${x.moneda === 'USD' ? 'selected' : ''}>Dólares</option>
                  <option value="VES" ${x.moneda === 'VES' ? 'selected' : ''}>Bolívares</option>
                </select></label
              >
              <label class="cell"
                ><span class="grow">Saldo</span>${inMoney('saldo', x.saldoInicialCents, 'Saldo')}</label
              >
              <label class="cell"
                ><span class="grow">Saldo al día</span
                ><input type="date" data-k="fecha" value="${x.fechaSaldo}"
              /></label>
              <label class="cell"
                ><span class="grow">Archivar</span
                ><input
                  type="checkbox"
                  data-k="archivada"
                  ${x.archivada ? 'checked' : ''}
                  style="width:1.2em;height:1.2em"
              /></label>
            </div>
          </section>`,
      )}
      <button class="btn secondary wide" data-on="nueva-deuda">${icon('mas')} Agregar deuda</button>
      <p class="section-foot">
        Los pagos marcados en pendientes y los anotados como "Deuda" bajan el saldo desde esa fecha. Una deuda
        en bolívares baja según la tasa del día del pago.
      </p>
    </div>`;
}

function paginaEtapas(d: Datos): Html {
  const etapas = [...d.etapas].sort((a, b) => a.desde.localeCompare(b.desde));
  return html`${cabeceraPagina(PAGINAS.etapas as string, true)}
    <div class="stack">
      ${etapas.map(
        (x) =>
          html`<section data-etapa="${x.id}">
            <div class="list">
              <label class="cell"
                ><span class="grow">Nombre</span
                ><input type="text" data-k="nombre" value="${x.nombre}" maxlength="40"
              /></label>
              <label class="cell"
                ><span class="grow">Desde</span><input type="month" data-k="desde" value="${x.desde}"
              /></label>
              <label class="cell"
                ><span class="grow">Hasta</span
                ><input type="month" data-k="hasta" value="${x.hasta ?? ''}" aria-describedby="etapa-ayuda"
              /></label>
              <button class="cell link bad" data-on="borrar-etapa" data-id="${x.id}">
                ${icon('basura')} Quitar etapa
              </button>
            </div>
          </section>`,
      )}
      <button class="btn secondary wide" data-on="nueva-etapa">${icon('mas')} Agregar etapa</button>
      <p class="section-foot" id="etapa-ayuda">
        Las etapas aparecen como franjas en los gráficos (por ejemplo "Pagando deudas" o "Ahorro de viaje").
        Deja "Hasta" vacío si sigue en curso.
      </p>
    </div>`;
}

function paginaNotas(d: Datos): Html {
  return html`${cabeceraPagina(PAGINAS.notas as string, true)}
    <div class="stack">
      <label class="field-label" for="notas"
        >Qué cuenta paga la casa, dónde está cada fondo, pendientes…</label
      >
      <textarea id="notas" class="text-input" maxlength="2000" data-k="notas" rows="10">${d.notas}</textarea>
    </div>`;
}

export function vistaAjustes(): Html {
  const e = get();
  const d = e.datos as Datos;
  switch (e.pagina) {
    case 'plan':
      return paginaPlan(d);
    case 'reparto':
      return paginaReparto(d);
    case 'categorias':
      return paginaCategorias(d);
    case 'metas':
      return paginaMetas(d);
    case 'deudas':
      return paginaDeudas(d);
    case 'etapas':
      return paginaEtapas(d);
    case 'notas':
      return paginaNotas(d);
    default:
      return raiz(d);
  }
}

/* ---------- saving ---------- */
const val = (root: ParentNode, k: string) =>
  ($<HTMLInputElement>(`[data-k="${k}"]`, root)?.value ?? '').trim();
const cents = (root: ParentNode, k: string) => Math.max(0, parseMonto(val(root, k)) ?? 0);
const marcado = (root: ParentNode, k: string) =>
  Boolean($<HTMLInputElement>(`[data-k="${k}"]`, root)?.checked);

function basePlan(d: Datos): Plan {
  const p = planDe(d, mesActual());
  return structuredClone(
    p ?? {
      vigenteDesde: mesActual(),
      ingresos: { carlos: 0, sofia: 0 },
      presupuesto: {},
      aportes: { carlos: {}, sofia: {} },
      reparto: { tipo: 'proporcional' },
      pagosCompartidos: {},
      pagaResto: 'sofia',
    },
  );
}

async function guardarPagina(): Promise<void> {
  const e = get(),
    d = e.datos;
  if (!d) return;
  const repo = getRepo();
  const main = document.querySelector('main') as HTMLElement;
  const tareas: Array<Promise<void>> = [];
  if (e.pagina === 'plan') {
    const p = basePlan(d);
    p.vigenteDesde = mesActual();
    for (const q of PERSONAS) p.ingresos[q] = cents(main, `ing:${q}`);
    main.querySelectorAll<HTMLInputElement>('[data-k^="pres:"]').forEach((i) => {
      p.presupuesto[(i.dataset.k as string).slice(5)] = Math.max(0, parseMonto(i.value) ?? 0);
    });
    main.querySelectorAll<HTMLInputElement>('[data-k^="ap:"]').forEach((i) => {
      const [, q, id] = (i.dataset.k as string).split(':') as [string, Persona, string];
      (p.aportes[q] ??= {})[id] = Math.max(0, parseMonto(i.value) ?? 0);
    });
    tareas.push(repo.guardarPlan(p));
  } else if (e.pagina === 'reparto') {
    const p = basePlan(d);
    p.vigenteDesde = mesActual();
    const tipo = ($<HTMLInputElement>('input[name="reparto"]:checked', main)?.value ??
      'proporcional') as Plan['reparto']['tipo'];
    const pct = Math.min(100, Math.max(0, Math.round(parseDecimal(val(main, 'pct')) ?? 50)));
    p.reparto = tipo === 'manual' ? { tipo, carlosPct: pct } : { tipo };
    main.querySelectorAll<HTMLSelectElement>('[data-k^="paga:"]').forEach((s) => {
      p.pagosCompartidos[(s.dataset.k as string).slice(5)] = s.value as Persona;
    });
    tareas.push(repo.guardarPlan(p));
  } else if (e.pagina === 'categorias') {
    const cs: Categoria[] = [];
    main.querySelectorAll<HTMLElement>('[data-cat]').forEach((row) => {
      const c = d.categorias.find((x) => x.id === row.dataset.cat);
      if (c) cs.push({ ...c, nombre: val(row, 'nombre') || c.nombre, archivada: marcado(row, 'archivada') });
    });
    tareas.push(repo.guardarCategorias(cs));
  } else if (e.pagina === 'metas') {
    main.querySelectorAll<HTMLElement>('[data-meta]').forEach((row) => {
      const m = d.metas.find((x) => x.id === row.dataset.meta);
      if (!m) return;
      const tope = cents(row, 'tope');
      const persona = val(row, 'persona');
      tareas.push(
        repo.guardarMeta({
          ...m,
          nombre: val(row, 'nombre') || m.nombre,
          tipo: val(row, 'tipo') as TipoMeta,
          persona: persona === 'carlos' || persona === 'sofia' ? persona : null,
          cuenta: val(row, 'cuenta'),
          topeCents: tope > 0 ? tope : null,
          saldoInicialCents: cents(row, 'inicial'),
          archivada: marcado(row, 'archivada'),
        }),
      );
    });
  } else if (e.pagina === 'deudas') {
    main.querySelectorAll<HTMLElement>('[data-deuda]').forEach((row) => {
      const x = d.deudas.find((y) => y.id === row.dataset.deuda);
      if (!x) return;
      tareas.push(
        repo.guardarDeuda({
          ...x,
          nombre: val(row, 'nombre') || x.nombre,
          persona: val(row, 'persona') as Persona,
          moneda: val(row, 'moneda') === 'VES' ? 'VES' : 'USD',
          saldoInicialCents: cents(row, 'saldo'),
          fechaSaldo: val(row, 'fecha') || x.fechaSaldo,
          archivada: marcado(row, 'archivada'),
        }),
      );
    });
  } else if (e.pagina === 'etapas') {
    main.querySelectorAll<HTMLElement>('[data-etapa]').forEach((row) => {
      const x = d.etapas.find((y) => y.id === row.dataset.etapa);
      if (!x) return;
      const desde = val(row, 'desde') || x.desde;
      const hasta = val(row, 'hasta') || null;
      tareas.push(
        repo.guardarEtapa({
          ...x,
          nombre: val(row, 'nombre') || x.nombre,
          desde,
          hasta: hasta && hasta >= desde ? hasta : null,
        }),
      );
    });
  } else if (e.pagina === 'notas') {
    tareas.push(repo.guardarNotas(val(main, 'notas').slice(0, 2000)));
  }
  try {
    await Promise.all(tareas);
    await recargar();
    toast('Cambios guardados');
  } catch (err) {
    console.error(err);
    toastError(guardarPagina);
  }
}

onClick('guardar-pagina', () => guardarPagina());

onClick('nueva-cat', async (el) => {
  const d = get().datos;
  if (!d) return;
  const g = el.dataset.g as GrupoGasto;
  const p = (el.dataset.p || null) as Persona | null;
  const orden =
    Math.max(0, ...d.categorias.filter((c) => c.grupo === g && c.persona === p).map((c) => c.orden)) + 1;
  await getRepo().guardarCategorias([
    {
      id: nuevoId(),
      grupo: g,
      persona: g === 'personal' ? p : null,
      nombre: 'Nueva categoría',
      orden,
      archivada: false,
    },
  ]);
  await recargar();
});

onClick('nueva-meta', async () => {
  const d = get().datos;
  if (!d) return;
  const m: Meta = {
    id: nuevoId(),
    nombre: 'Nueva meta',
    tipo: 'otra',
    persona: null,
    cuenta: '',
    topeCents: null,
    saldoInicialCents: 0,
    orden: d.metas.length + 1,
    archivada: false,
  };
  await getRepo().guardarMeta(m);
  await recargar();
});

onClick('nueva-deuda', async () => {
  const x: Deuda = {
    id: nuevoId(),
    nombre: 'Nueva deuda',
    persona: get().persona,
    moneda: 'USD',
    saldoInicialCents: 0,
    fechaSaldo: new Date().toISOString().slice(0, 10),
    archivada: false,
  };
  await getRepo().guardarDeuda(x);
  await recargar();
});

onClick('nueva-etapa', async () => {
  const x: Etapa = { id: nuevoId(), nombre: 'Nueva etapa', desde: mesActual(), hasta: null };
  await getRepo().guardarEtapa(x);
  await recargar();
});

onClick('borrar-etapa', async (el) => {
  const d = get().datos;
  const x = d?.etapas.find((y) => y.id === el.dataset.id);
  if (!x) return;
  await getRepo().borrarEtapa(x.id);
  await recargar();
  toast(`Etapa "${x.nombre}" quitada`, {
    label: t.deshacer,
    fn: async () => {
      await getRepo().guardarEtapa(x);
      await recargar();
    },
  });
});

onClick('tema', (el) => {
  const v = el.dataset.v as 'auto' | 'light' | 'dark';
  recordar('tema', v);
  aplicarTema(v);
  set({});
});

onClick('exportar', async () => {
  try {
    const r = await getRepo().exportar();
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finanzas-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Copia descargada');
  } catch (err) {
    console.error(err);
    toast('No se pudo descargar la copia.');
  }
});

onChange('importar', async (el) => {
  const input = el as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const msg = document.getElementById('imp-msg');
  if (!file || !msg) return;
  try {
    const r = validarRespaldo(JSON.parse(await file.text()));
    msg.textContent = 'Cargando…';
    await getRepo().importar(r);
    await recargar();
    msg.textContent = `Listo: se cargaron ${r.datos.movimientos.length} movimientos.`;
  } catch (err) {
    console.error(err);
    msg.textContent =
      err instanceof RespaldoInvalido ? err.message : 'Ese archivo no es una copia válida de esta app.';
  }
});

onClick('reiniciar-demo', async () => {
  const r = getRepo();
  if (r instanceof DemoRepo) {
    r.reiniciar();
    await recargar();
    toast('Datos de ejemplo reiniciados');
  }
});
