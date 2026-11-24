/**
 * Chart card shell around Observable Plot, with the accessibility layer charts need:
 * - a one-line conclusion above the chart and a text summary for VoiceOver;
 * - tap or drag to read exact values (with a light haptic), arrow keys do the same and announce them;
 * - a "Ver datos" table with every number;
 * - colors read from the theme tokens, plus stripes, dashes and marker shapes so nothing depends on color alone.
 * Plot is loaded on demand so the first screen stays light.
 */
import { haptic } from './feedback';
import { html, type Html } from './html';

export type PlotLib = typeof import('@observablehq/plot');
export type Colores = Record<string, string>;

export interface Leyenda {
  k: string; // CSS token suffix: --c-<k>
  label: string;
  estilo?: 'solid' | 'line' | 'dashed' | 'striped';
}

export interface Punto {
  /** Value on the band/point x (or y for horizontal charts) scale. */
  x: string;
  /** What to show and announce for this point. */
  texto: string;
}

export interface SpecGrafico {
  id: string;
  titulo: string;
  conclusion: string;
  nota?: string;
  leyenda?: Leyenda[];
  /** Builds the chart for the container width. */
  dibujar: (P: PlotLib, ancho: number, c: Colores) => SVGSVGElement | HTMLElement;
  /** Scale and points for scrubbing; omit for static charts. */
  scrub?: { escala: 'x' | 'y'; puntos: Punto[] };
  tabla: { cols: string[]; filas: string[][] };
  extra?: Html;
}

const specs = new Map<string, SpecGrafico>();

export function tarjetaGrafico(g: SpecGrafico): Html {
  specs.set(g.id, g);
  const resumen = `${g.titulo}. ${g.conclusion}${g.nota ? `. ${g.nota}` : ''}`;
  return html`<figure class="card chart-card" style="margin:0" aria-labelledby="${g.id}-t">
    <p class="t-foot muted" id="${g.id}-t">${g.titulo}</p>
    <p class="lead">${g.conclusion}</p>
    ${g.nota ? html`<p class="caption">${g.nota}</p>` : ''}
    <div
      class="chart"
      data-grafico="${g.id}"
      tabindex="0"
      role="img"
      aria-label="${resumen}${g.scrub ? '. Usa las flechas para recorrer los valores.' : ''}"
      aria-describedby="${g.id}-live"
      style="min-height:180px"
    ></div>
    <p class="sr-only" id="${g.id}-live" aria-live="polite"></p>
    ${
      g.leyenda?.length
        ? html`<div class="legend" aria-hidden="true">
            ${g.leyenda.map(
              (l) =>
                html`<span
                  ><i
                    class="swatch ${l.estilo && l.estilo !== 'solid' ? l.estilo : ''}"
                    style="--k:var(--c-${l.k})"
                  ></i
                  >${l.label}</span
                >`,
            )}
          </div>`
        : ''
    }
    ${g.extra ?? ''}
    <details class="disclosure">
      <summary class="t-sub">Ver datos</summary>
      <table class="data-table">
        <thead>
          <tr>
            ${g.tabla.cols.map((c) => html`<th scope="col">${c}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${g.tabla.filas.map(
            (f) =>
              html`<tr>
                ${f.map((v, i) => (i === 0 ? html`<th scope="row">${v}</th>` : html`<td>${v}</td>`))}
              </tr>`,
          )}
        </tbody>
      </table>
    </details>
  </figure>`;
}

const TOKENS = [
  'casa',
  'imprevisto',
  'carlos',
  'sofia',
  'ingreso',
  'sobrante',
  'viaje',
  'emergencia',
  'inversion',
  'otra',
  'deuda',
];

function colores(): Colores {
  const cs = getComputedStyle(document.documentElement);
  const c: Colores = {};
  for (const k of TOKENS)
    c[k] = cs.getPropertyValue(`--c-${k}`).trim() || cs.getPropertyValue('--c-otra').trim();
  for (const k of ['label', 'label-2', 'label-3', 'separator', 'surface', 'bad', 'fill', 'accent'])
    c[k] = cs.getPropertyValue(`--${k}`).trim();
  return c;
}

/** Adds stripe patterns (id rayas-<token>) to a Plot SVG so a series can be told apart without color. */
export function patrones(svg: SVGSVGElement, c: Colores, keys: string[]): void {
  const ns = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(ns, 'defs');
  for (const k of keys) {
    const p = document.createElementNS(ns, 'pattern');
    p.setAttribute('id', `rayas-${k}`);
    p.setAttribute('patternUnits', 'userSpaceOnUse');
    p.setAttribute('width', '6');
    p.setAttribute('height', '6');
    p.setAttribute('patternTransform', 'rotate(45)');
    p.innerHTML = `<rect width="6" height="6" fill="${c[k]}" opacity="0.35"/><rect width="3" height="6" fill="${c[k]}"/>`;
    defs.append(p);
  }
  svg.prepend(defs);
}

let plotLib: Promise<PlotLib> | null = null;
const cargarPlot = () => (plotLib ??= import('@observablehq/plot'));

/** Renders every chart placeholder on screen. Called after each paint. */
export async function montarGraficos(root: ParentNode = document): Promise<void> {
  const nodos = [...root.querySelectorAll<HTMLElement>('[data-grafico]')].filter((n) => !n.dataset.montado);
  if (!nodos.length) return;
  const P = await cargarPlot();
  const c = colores();
  for (const nodo of nodos) {
    const g = specs.get(nodo.dataset.grafico as string);
    if (!g || !nodo.isConnected) continue;
    nodo.dataset.montado = '1';
    const ancho = Math.max(260, Math.floor(nodo.getBoundingClientRect().width));
    let fig: SVGSVGElement | HTMLElement;
    try {
      fig = g.dibujar(P, ancho, c);
    } catch (e) {
      console.error(e);
      nodo.textContent = 'No se pudo dibujar el gráfico.';
      continue;
    }
    fig.setAttribute('aria-hidden', 'true');
    nodo.replaceChildren(fig);
    nodo.style.minHeight = '';
    if (g.scrub?.puntos.length) recorrido(nodo, fig, g);
  }
}

/** Tap/drag and arrow-key reading of exact values. */
function recorrido(nodo: HTMLElement, fig: SVGSVGElement | HTMLElement, g: SpecGrafico) {
  const scrub = g.scrub as NonNullable<SpecGrafico['scrub']>;
  const svg = fig instanceof SVGSVGElement ? fig : (fig.querySelector('svg') as SVGSVGElement | null);
  const plot = fig as unknown as {
    scale?: (n: string) => { apply?: (v: string) => number; bandwidth?: number } | undefined;
  };
  const esc = plot.scale?.(scrub.escala);
  if (!svg || !esc?.apply) return;
  const centros = scrub.puntos.map(
    (p) => (esc.apply as (v: string) => number)(p.x) + (esc.bandwidth ?? 0) / 2,
  );
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  nodo.append(tip);
  const live = document.getElementById(`${g.id}-live`);
  let actual = -1;

  const mostrar = (i: number, anunciar: boolean) => {
    if (i < 0 || i >= scrub.puntos.length) return;
    const p = scrub.puntos[i] as Punto;
    const escalaSvg = svg.getBoundingClientRect().width / (Number(svg.getAttribute('width')) || 1);
    const pos = (centros[i] as number) * escalaSvg;
    tip.textContent = p.texto;
    tip.hidden = false;
    if (scrub.escala === 'x') {
      tip.style.left = `${Math.min(Math.max(pos, 70), nodo.clientWidth - 70)}px`;
      tip.style.top = '0px';
    } else {
      tip.style.left = '50%';
      tip.style.top = `${pos}px`;
    }
    if (i !== actual) {
      if (actual !== -1) haptic();
      actual = i;
      if (anunciar && live) live.textContent = p.texto;
    }
  };
  const cercano = (ev: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    const escalaSvg = r.width / (Number(svg.getAttribute('width')) || 1);
    const v = (scrub.escala === 'x' ? ev.clientX - r.left : ev.clientY - r.top) / escalaSvg;
    let mejor = 0;
    centros.forEach((cx, i) => {
      if (Math.abs(cx - v) < Math.abs((centros[mejor] as number) - v)) mejor = i;
    });
    return mejor;
  };
  nodo.addEventListener('pointerdown', (ev) => {
    nodo.setPointerCapture(ev.pointerId);
    mostrar(cercano(ev), false);
  });
  nodo.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse' || nodo.hasPointerCapture(ev.pointerId)) mostrar(cercano(ev), false);
  });
  nodo.addEventListener('pointerleave', () => {
    tip.hidden = true;
    actual = -1;
  });
  nodo.addEventListener('keydown', (ev) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
    if (!paso) return;
    ev.preventDefault();
    const n =
      actual === -1
        ? paso > 0
          ? 0
          : scrub.puntos.length - 1
        : Math.min(scrub.puntos.length - 1, Math.max(0, actual + paso));
    mostrar(n, true);
  });
  nodo.addEventListener('blur', () => {
    tip.hidden = true;
    actual = -1;
  });
}
