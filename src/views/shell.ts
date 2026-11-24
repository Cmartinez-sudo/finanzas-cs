/** App frame: renders the current tab, the tab bar / sidebar, status banners and navigation actions. */
import { mesActual, sumarMeses } from '../core/fechas';
import { otra } from '../core/model';
import { checklistDe } from '../core/plan';
import { plan as planDe } from '../app/selectores';
import { get, getRepo, recargar, recordar, set, type Estado, type Tab } from '../app/store';
import { DemoRepo } from '../data/demo';
import { onClick } from '../ui/eventos';
import { haptic } from '../ui/feedback';
import { html, type Html } from '../ui/html';
import { icon } from '../ui/icons';
import { t } from '../strings';
import { vistaAjustes } from './ajustes';
import { botonTasas } from './conversor';
import { vistaFondos } from './fondos';
import { vistaGastos } from './gastos';
import { vistaInicio } from './inicio';
import { abrirMovimiento } from './movimiento';
import { vistaResumen } from './resumen';

function tabbar(e: Estado): Html {
  const d = e.datos;
  const plan = d ? planDe(d, e.mes) : null;
  const pend =
    d && plan
      ? checklistDe(plan, d.categorias, d.aportes, e.mes, e.persona, d.deudas).filter((i) => !i.hecho).length
      : 0;
  const tab = (k: Tab, ico: string, n: string, extra: Html | string = '') =>
    html`<button class="tab" data-on="ir-tab" data-tab="${k}" ${e.tab === k ? html`aria-current="page"` : ''}>
      ${icon(ico)}<span>${n}</span>${extra}
    </button>`;
  return html`<nav class="tabbar" aria-label="Secciones">
    <div class="in">
      ${tab('inicio', 'inicio', t.tabs.inicio, pend ? html`<span class="count" aria-label="${pend} pendientes">${pend}</span>` : '')}
      ${tab('gastos', 'gastos', t.tabs.gastos)}
      <button class="tab-add" data-on="anotar" aria-label="${t.tabs.anotar}">${icon('mas')}</button>
      ${tab('resumen', 'resumen', t.tabs.resumen)} ${tab('fondos', 'fondos', t.tabs.fondos)}
    </div>
  </nav>`;
}

function esqueleto(): Html {
  return html`<div class="stack" aria-busy="true" aria-label="${t.cargando}">
    <div class="skeleton" style="height:56px;margin-top:20px"></div>
    <div class="skeleton" style="height:140px"></div>
    <div class="skeleton" style="height:220px"></div>
  </div>`;
}

export function vistaApp(e: Estado): Html {
  let cuerpo: Html;
  if (e.error)
    cuerpo = html`<div class="stack" style="padding-top:24px">
      <p class="banner error" role="alert">
        ${icon('alerta')}${e.error === 'sin-acceso' ? t.sinAcceso : t.errorCarga}
      </p>
      <button class="btn" data-on="recargar">${t.reintentar}</button>
    </div>`;
  else if (!e.datos) cuerpo = esqueleto();
  else
    cuerpo = {
      inicio: vistaInicio,
      gastos: vistaGastos,
      resumen: vistaResumen,
      fondos: vistaFondos,
      ajustes: vistaAjustes,
    }[e.tab](e);
  const demo = (() => {
    try {
      return getRepo().modo === 'demo';
    } catch {
      return false;
    }
  })();
  return html`<div class="content">
      ${demo && e.tab !== 'ajustes' ? html`<p class="banner" style="margin-top:8px">${icon('info')}<span>${t.demo}</span></p>` : ''}
      <main id="main">${cuerpo}</main>
      ${e.datos && e.tab !== 'ajustes' ? html`<div style="margin-top:20px;display:flex;justify-content:center">${botonTasas()}</div>` : ''}
    </div>
    ${tabbar(e)}`;
}

/* ---------- navigation ---------- */
function irTab(tab: Tab, pagina: string | null = null) {
  if (tab !== 'ajustes') recordar('tab', tab);
  set({ tab, pagina });
  window.scrollTo({ top: 0 });
  // Move focus to the new screen's title for VoiceOver users
  requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus?.());
}

onClick('ir-tab', (el) => irTab(el.dataset.tab as Tab));
onClick('ir-ajustes', (el) => irTab('ajustes', el.dataset.pagina || null));
onClick('anotar', () => abrirMovimiento(null));
onClick('recargar', () => recargar());
onClick('mes', (el) => {
  haptic();
  set({ mes: sumarMeses(get().mes, Number(el.dataset.k)) });
});
onClick('mes-hoy', () => set({ mes: mesActual() }));
onClick('cambiar-persona', () => {
  const r = getRepo();
  if (r instanceof DemoRepo) {
    const p = otra(get().persona);
    r.elegirPersona(p);
    set({ persona: p, verPersona: p });
  } else {
    // With an account the person comes from the login; offer to switch account instead.
    irTab('ajustes');
  }
});
