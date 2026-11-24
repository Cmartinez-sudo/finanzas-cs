// Screenshots of every screen in light and dark mode, using the demo data.
// Usage: npm run build && node scripts/capturas.mjs [outDir]
// Fails if the page logs any console error.
import { chromium, devices } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
mkdirSync(out, { recursive: true });

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'error' });
const url = 'http://localhost:4179/?demo';
const browser = await chromium.launch();
const errores = [];

const PANTALLAS = [
  ['inicio', async () => {}],
  ['gastos', async (p) => p.click('[data-on="ir-tab"][data-tab="gastos"]')],
  ['resumen', async (p) => p.click('[data-on="ir-tab"][data-tab="resumen"]')],
  ['fondos', async (p) => p.click('[data-on="ir-tab"][data-tab="fondos"]')],
  ['ajustes', async (p) => p.click('.nav-head [data-on="ir-ajustes"]')],
  [
    'anotar',
    async (p) => {
      await p.click('[data-on="anotar"]');
      await p.fill('#mv-monto', '40');
      await p.click('#mv-moneda [data-v="USD_BCV"]');
    },
  ],
  [
    'convertir',
    async (p) => {
      await p.click('[data-on="conversor"]');
      await p.fill('#cv-monto', '40');
    },
  ],
];

const solo = process.env.SOLO?.split(',');
for (const [nombreDisp, disp] of [
  ['iphone', devices['iPhone 15']],
  ['ipad', { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 }],
]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...disp, colorScheme: scheme, locale: 'es-VE' });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errores.push(`${nombreDisp}/${scheme}: ${m.text()}`));
    page.on('pageerror', (e) => errores.push(`${nombreDisp}/${scheme}: ${e.message}`));
    for (const [nombre, ir] of PANTALLAS) {
      if (solo && !solo.includes(nombre)) continue;
      if (nombreDisp === 'ipad' && ['anotar', 'convertir'].includes(nombre)) continue;
      await page.goto(url);
      await page.waitForSelector('.tabbar');
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
      await ir(page);
      await page.waitForTimeout(450);
      if (nombre === 'resumen' || nombre === 'inicio') {
        // One image per chart card, for review in both themes.
        await page.addStyleTag({ content: '.tabbar{visibility:hidden}' });
        const cards = page.locator('figure.chart-card');
        for (let i = 0; i < (await cards.count()); i++) {
          const card = cards.nth(i);
          const id = await card.locator('[data-grafico]').getAttribute('data-grafico');
          await card.scrollIntoViewIfNeeded();
          await card.screenshot({ path: `${out}/${nombreDisp}-grafico-${id}-${scheme}.png` });
        }
      }
      await page.screenshot({
        path: `${out}/${nombreDisp}-${nombre}-${scheme}.png`,
        fullPage: !['anotar', 'convertir'].includes(nombre),
      });
    }
    await ctx.close();
  }
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
if (errores.length) {
  console.error('Console errors:\n' + errores.join('\n'));
  process.exit(1);
}
console.log(`Screenshots in ${out}/`);
