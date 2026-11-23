# Finanzas Carlos & Sofía

App para llevar los gastos, aportes y fondos de la pareja.

- App: https://cmartinez-sudo.github.io/finanzas-cs/
- Datos: Supabase (solo entran Carlos y Sofía, ver `supabase.sql`).
- Tasas BCV y Binance: `tasas.json`, actualizado cada mañana por una tarea programada.

## Puesta en marcha

1. Supabase → SQL Editor → pegar `supabase.sql` (con los dos correos) → Run.
2. Supabase → Authentication → crear los dos usuarios con contraseña y desactivar registros nuevos.
3. Poner la Project URL y la anon key en `config.js`.
4. GitHub → Settings → Pages → Deploy from branch `main`, carpeta `/ (root)`.
