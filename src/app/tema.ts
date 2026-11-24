/** Theme: follows the system by default; Ajustes can force light or dark on this device. */
export type Tema = 'auto' | 'light' | 'dark';

export function temaGuardado(): Tema {
  try {
    const v = localStorage.getItem('tema');
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

const oscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function aplicarTema(t: Tema = temaGuardado()): void {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const efectivo = t === 'auto' ? (oscuro() ? 'dark' : 'light') : t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', efectivo === 'dark' ? '#000000' : '#f2f2f7');
}

export function seguirSistema(alCambiar: () => void): void {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (temaGuardado() === 'auto') {
      aplicarTema('auto');
      alCambiar();
    }
  });
}
