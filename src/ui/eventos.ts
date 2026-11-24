/**
 * Event delegation: elements declare data-on="action" (click) or data-change="action";
 * modules register handlers by name. Re-rendering with innerHTML never loses listeners.
 */
type Handler = (el: HTMLElement, ev: Event) => void | Promise<void>;
const clicks = new Map<string, Handler>();
const changes = new Map<string, Handler>();

export const onClick = (name: string, fn: Handler): void => void clicks.set(name, fn);
export const onChange = (name: string, fn: Handler): void => void changes.set(name, fn);

function run(map: Map<string, Handler>, attr: string, ev: Event) {
  const el = (ev.target as Element | null)?.closest<HTMLElement>(`[${attr}]`);
  if (!el) return;
  const fn = map.get(el.getAttribute(attr) as string);
  if (!fn) return;
  if (ev.type === 'click' && el.tagName !== 'INPUT') ev.preventDefault();
  Promise.resolve(fn(el, ev)).catch((e: unknown) => console.error(e));
}

export function iniciarEventos(root: HTMLElement | Document = document): void {
  root.addEventListener('click', (e) => run(clicks, 'data-on', e));
  root.addEventListener('change', (e) => run(changes, 'data-change', e));
}
