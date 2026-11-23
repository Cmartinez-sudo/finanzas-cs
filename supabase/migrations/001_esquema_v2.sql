-- Finanzas Carlos & Sofía · esquema v2
-- Cómo usarlo: Supabase → SQL Editor → pegar este archivo → cambiar los dos correos de abajo → Run.
-- Crea tablas nuevas; no toca las tablas viejas (docs, gastos, aportes) si existen.

-- 1) Quién es quién. Cambia los correos por los reales antes de correrlo.
create table if not exists public.pareja (
  email text primary key,
  persona text not null unique check (persona in ('carlos', 'sofia'))
);
insert into public.pareja (email, persona) values
  ('CORREO_CARLOS', 'carlos'),
  ('CORREO_SOFIA', 'sofia')
on conflict (email) do update set persona = excluded.persona;

create or replace function public.mi_persona() returns text
language sql stable security definer set search_path = public as $$
  select persona from public.pareja where email = (auth.jwt() ->> 'email')
$$;

create or replace function public.es_pareja() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mi_persona() is not null
$$;

-- 2) Estructura del plan (editable desde la app por los dos).
create table if not exists public.categorias (
  id text primary key,
  grupo text not null check (grupo in ('casa', 'imprevisto', 'personal')),
  persona text check (persona in ('carlos', 'sofia')),
  nombre text not null check (length(nombre) between 1 and 40),
  orden int not null default 0,
  archivada boolean not null default false,
  updated_at timestamptz not null default now(),
  check ((grupo = 'personal') = (persona is not null))
);

create table if not exists public.metas (
  id text primary key,
  nombre text not null check (length(nombre) between 1 and 40),
  tipo text not null check (tipo in ('viaje', 'emergencia', 'inversion', 'otra')),
  persona text check (persona in ('carlos', 'sofia')),
  cuenta text not null default '' check (length(cuenta) <= 80),
  tope_cents bigint check (tope_cents > 0),
  saldo_inicial_cents bigint not null default 0,
  orden int not null default 0,
  archivada boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.deudas (
  id text primary key,
  nombre text not null check (length(nombre) between 1 and 40),
  persona text not null check (persona in ('carlos', 'sofia')),
  moneda text not null check (moneda in ('USD', 'VES')),
  saldo_inicial_cents bigint not null check (saldo_inicial_cents >= 0),
  fecha_saldo date not null,
  archivada boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Una fila por versión del plan; cada mes usa la última versión que empezó antes o en ese mes.
create table if not exists public.planes (
  vigente_desde text primary key check (vigente_desde ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.etapas (
  id text primary key,
  nombre text not null check (length(nombre) between 1 and 40),
  desde text not null check (desde ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  hasta text check (hasta ~ '^\d{4}-(0[1-9]|1[0-2])$' and hasta >= desde),
  updated_at timestamptz not null default now()
);

create table if not exists public.ajustes (
  id text primary key default 'app' check (id = 'app'),
  notas text not null default '' check (length(notas) <= 2000),
  updated_at timestamptz not null default now()
);

-- 3) Movimientos: gastos, aportes extra, retiros de un fondo y pagos de deuda.
-- real_cents es el costo en dólar real, calculado y congelado al guardar.
create table if not exists public.movimientos (
  id text primary key,
  fecha date not null,
  tipo text not null check (tipo in ('gasto', 'aporte', 'retiro', 'pago_deuda')),
  persona text not null check (persona in ('carlos', 'sofia')),
  categoria_id text references public.categorias (id),
  meta_id text references public.metas (id),
  deuda_id text references public.deudas (id),
  moneda text not null check (moneda in ('USD', 'VES', 'USD_BCV')),
  monto_cents bigint not null check (monto_cents > 0),
  tasa_bcv numeric(14, 4) check (tasa_bcv > 0),
  tasa_compra numeric(14, 4) check (tasa_compra > 0),
  tasa_manual boolean not null default false,
  real_cents bigint not null check (real_cents >= 0),
  bs_cents bigint,
  ahorro_cents bigint not null default 0,
  nota text not null default '' check (length(nota) <= 120),
  plan_cubierto_cents bigint not null default 0 check (plan_cubierto_cents >= 0),
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (case tipo
    when 'gasto' then categoria_id is not null and meta_id is null and deuda_id is null
    when 'pago_deuda' then deuda_id is not null and categoria_id is null and meta_id is null
    else meta_id is not null and categoria_id is null and deuda_id is null end),
  check (moneda = 'USD' or tasa_compra is not null),
  check (moneda <> 'USD_BCV' or tasa_bcv is not null)
);
create index if not exists movimientos_fecha_idx on public.movimientos (fecha);

-- Checklist del mes: aportes planificados, pagos de deuda y el ajuste de la casa.
create table if not exists public.aportes_mes (
  mes text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  persona text not null check (persona in ('carlos', 'sofia')),
  clave text not null,
  monto_cents bigint not null default 0 check (monto_cents >= 0),
  hecho boolean not null default false,
  tasa_compra numeric(14, 4),
  updated_at timestamptz not null default now(),
  primary key (mes, persona, clave)
);

-- Correcciones a mano de las tasas de un día (ganan sobre el historial automático).
create table if not exists public.tasas_manual (
  fecha date primary key,
  bcv numeric(14, 4) check (bcv > 0),
  binance numeric(14, 4) check (binance > 0),
  por text check (por in ('carlos', 'sofia')),
  updated_at timestamptz not null default now()
);

-- 4) Reglas de acceso: solo la pareja ve y edita; cada uno escribe solo sus propios
--    movimientos y su propio checklist.
do $$
declare t text;
begin
  foreach t in array array['pareja', 'categorias', 'metas', 'deudas', 'planes', 'etapas', 'ajustes',
                           'movimientos', 'aportes_mes', 'tasas_manual'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "pareja lee" on public.%I', t);
    execute format('create policy "pareja lee" on public.%I for select to authenticated using (public.es_pareja())', t);
  end loop;
  foreach t in array array['categorias', 'metas', 'deudas', 'planes', 'etapas', 'ajustes'] loop
    execute format('drop policy if exists "pareja edita" on public.%I', t);
    execute format('create policy "pareja edita" on public.%I for all to authenticated using (public.es_pareja()) with check (public.es_pareja())', t);
  end loop;
  foreach t in array array['movimientos', 'aportes_mes'] loop
    execute format('drop policy if exists "cada uno lo suyo" on public.%I', t);
    execute format('create policy "cada uno lo suyo" on public.%I for all to authenticated using (persona = public.mi_persona()) with check (persona = public.mi_persona())', t);
  end loop;
end $$;

drop policy if exists "pareja corrige tasas" on public.tasas_manual;
create policy "pareja corrige tasas" on public.tasas_manual for all to authenticated
  using (public.es_pareja()) with check (public.es_pareja() and por = public.mi_persona());

-- 5) Que lo que anota uno le aparezca al otro al instante.
do $$
declare t text;
begin
  foreach t in array array['categorias', 'metas', 'deudas', 'planes', 'etapas', 'ajustes',
                           'movimientos', 'aportes_mes', 'tasas_manual'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
