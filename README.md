# Finanzas Carlos & Sofía

App para llevar los gastos, aportes, fondos y deudas de la pareja, con gráficos.

- App: https://cmartinez-sudo.github.io/finanzas-cs/
- Sin Supabase configurado (o con `?demo` en la URL) abre en **modo demo** con datos ficticios.

## Cómo funciona el dinero

- Todo se guarda en **centavos enteros**, nunca como decimales flotantes.
- La unidad es el **dólar real**: lo que de verdad salió de sus dólares.
  - Pagado en dólares → el monto tal cual.
  - Pagado en bolívares → `Bs ÷ tasa Binance del día del pago` (o la tasa a la que compraron los Bs).
  - Precio en "$ a BCV" → se pasa a Bs con la BCV del día y luego a dólar real con la Binance del día.
- El costo se calcula y se **congela al guardar**; cambiar la tasa después no reescribe la historia.
- El plan es **versionado por mes**: editarlo cambia el mes actual en adelante; los meses pasados conservan el suyo.

## Puesta en marcha

1. **Base de datos.** Supabase → SQL Editor → pegar `supabase/migrations/001_esquema_v2.sql`,
   cambiar `CORREO_CARLOS` y `CORREO_SOFIA` por los correos reales → Run.
   (Opcional: después correr el archivo con el plan inicial, que se guarda fuera de este repo público.)
2. **Usuarios.** Supabase → Authentication → crear los dos usuarios con contraseña y desactivar los registros nuevos.
3. **Configuración.** Poner la Project URL y la anon key en `public/config.js`.
   La anon key es pública por diseño; la seguridad está en las reglas RLS.
4. **Publicación.** GitHub → Settings → Pages → Source: **GitHub Actions**.
   El workflow _Publicar app_ compila y publica con cada push a `main` y después de cada actualización de tasas.

## Tasas

El workflow _Actualizar tasas_ corre dos veces al día, guarda `public/tasas.json` (la de hoy) y agrega el día a
`public/tasas-historial.json`. Las correcciones a mano desde la app se guardan en Supabase y ganan para ese día.

## Desarrollo

```sh
npm install
npm run dev        # servidor local (modo demo si config.js está vacío)
npm run check      # lint + formato + tests + build
npm run capturas   # capturas de todas las pantallas y gráficos, claro y oscuro (falla si hay errores en consola)
```

Estructura:

- `src/core/` lógica pura con tests: dinero, tasas y dólar real, plan, agregados de los gráficos, fechas.
- `src/data/` almacenamiento: Supabase, demo, tasas publicadas, validación de respaldos.
- `src/views/` pantallas; `src/ui/` piezas comunes (plantillas, sheets, gráficos, feedback).
- `src/strings.ts` todos los textos.
