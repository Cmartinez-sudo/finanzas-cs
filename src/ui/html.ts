/**
 * Tiny HTML templating: every interpolated value is escaped unless it is already Html.
 * Views build strings with html`...` and the shell mounts them with innerHTML.
 */
export class Html {
  constructor(readonly s: string) {}
  toString(): string {
    return this.s;
  }
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c] as string);

/** Marks trusted markup (icons, already-built fragments). Never pass user text here. */
export const raw = (s: string): Html => new Html(s);

function piece(v: unknown): string {
  if (v === null || v === undefined) return '';
  // Booleans print as text so aria-pressed="${x}" works; use ternaries for conditional markup.
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Html) return v.s;
  if (Array.isArray(v)) return v.map(piece).join('');
  return esc(v);
}

export function html(strings: TemplateStringsArray, ...vals: unknown[]): Html {
  let out = strings[0] ?? '';
  for (let i = 0; i < vals.length; i++) out += piece(vals[i]) + (strings[i + 1] ?? '');
  return new Html(out);
}

/** Joins class names, skipping falsy ones. */
export const cx = (...xs: Array<string | false | null | undefined>): string => xs.filter(Boolean).join(' ');

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);
