/**
 * Entry point. With Supabase configured (public/config.js) the app signs in and syncs live;
 * without it, it runs the demo with made-up data so nothing is ever half-broken.
 */
import './styles/app.css';
import { mesActual } from './core/fechas';
import { alCambiar, get, recargar, set, setRepo } from './app/store';
import { aplicarTema, seguirSistema } from './app/tema';
import { DemoRepo } from './data/demo';
import type { SupabaseRepo } from './data/supabase';
import { iniciarEventos } from './ui/eventos';
import { t } from './strings';
import { vistaApp } from './views/shell';
import { vistaLogin } from './views/login';
import { montarGraficos } from './ui/grafico';

declare global {
  interface Window {
    SUPABASE_CONFIG?: { url?: string; anonKey?: string };
  }
}

const app = document.getElementById('app') as HTMLElement;
let pintando = false;

function pintar() {
  if (pintando) return;
  pintando = true;
  requestAnimationFrame(() => {
    pintando = false;
    // Keep focus on the same control across re-renders when it still exists.
    const foco = document.activeElement as HTMLElement | null;
    const clave =
      foco?.closest('#app') && foco.dataset.on
        ? `[data-on="${foco.dataset.on}"]${foco.dataset.v ? `[data-v="${foco.dataset.v}"]` : ''}${foco.dataset.p ? `[data-p="${foco.dataset.p}"]` : ''}${foco.dataset.tab ? `[data-tab="${foco.dataset.tab}"]` : ''}`
        : null;
    app.innerHTML = vistaApp(get()).s;
    if (clave) app.querySelector<HTMLElement>(clave)?.focus();
    void montarGraficos(app);
    document.title =
      get().tab === 'inicio'
        ? t.app
        : `${{ gastos: t.tabs.gastos, resumen: t.tabs.resumen, fondos: t.tabs.fondos, ajustes: t.ajustes, inicio: '' }[get().tab]} · ${t.app}`;
  });
}

async function arrancar() {
  aplicarTema();
  seguirSistema(pintar);
  iniciarEventos();
  alCambiar(pintar);
  // Charts are drawn for the container width, so redraw them when it changes.
  let ancho = innerWidth;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - ancho) > 40) {
      ancho = innerWidth;
      pintar();
    }
  });

  const cfg = window.SUPABASE_CONFIG;
  const forzarDemo = new URLSearchParams(location.search).has('demo');
  if (!cfg?.url || !cfg.anonKey || forzarDemo) {
    const repo = new DemoRepo();
    setRepo(repo);
    set({ persona: repo.persona ?? 'carlos', verPersona: repo.persona ?? 'carlos' });
    pintar();
    await recargar();
    repo.suscribir(() => void recargar());
    return;
  }

  // Loaded only when configured, so the demo and first paint stay light.
  const { SupabaseRepo } = await import('./data/supabase');
  const repo = new SupabaseRepo(cfg.url, cfg.anonKey);
  setRepo(repo);
  let quitar: (() => void) | null = null;
  let ultimo: string | null | undefined;

  const entrar = async (user: import('@supabase/supabase-js').User | null) => {
    if ((user?.id ?? null) === ultimo) return;
    ultimo = user?.id ?? null;
    quitar?.();
    quitar = null;
    if (!user) {
      mostrarLogin(repo);
      return;
    }
    document.body.dataset.email = user.email ?? '';
    const persona = await repo.resolverPersona(user).catch(() => null);
    if (!persona) {
      set({ error: 'sin-acceso' });
      pintar();
      return;
    }
    set({ persona, verPersona: persona, mes: mesActual(), error: null });
    pintar();
    await recargar();
    quitar = repo.suscribir(() => void recargar());
  };

  repo.sb.auth.onAuthStateChange((_ev, session) => {
    setTimeout(() => void entrar(session?.user ?? null), 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && get().datos) void recargar();
  });
  document.addEventListener('click', (ev) => {
    if ((ev.target as Element).closest('[data-on="salir"]')) void repo.sb.auth.signOut();
  });
}

function mostrarLogin(repo: SupabaseRepo) {
  app.innerHTML = vistaLogin().s;
  const form = document.getElementById('login') as HTMLFormElement;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('l-err') as HTMLElement;
    const btn = document.getElementById('l-btn') as HTMLButtonElement;
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = t.entrando;
    const { error } = await repo.sb.auth.signInWithPassword({
      email: (document.getElementById('l-email') as HTMLInputElement).value.trim(),
      password: (document.getElementById('l-pass') as HTMLInputElement).value,
    });
    btn.disabled = false;
    btn.textContent = t.entrar;
    if (error) {
      err.textContent = /invalid/i.test(error.message) ? t.credencialesMal : t.noSeEntro;
      err.hidden = false;
    }
  });
}

void arrancar();
