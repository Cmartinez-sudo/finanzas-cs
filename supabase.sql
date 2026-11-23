-- Finanzas Carlos & Sofía: pegar en Supabase → SQL Editor → Run.
-- Antes de correrlo, cambia CORREO_CARLOS y CORREO_SOFIA por sus correos reales (en las 3 políticas).

create table if not exists public.docs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.gastos (
  id text primary key,
  mes text not null,
  grupo text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists gastos_mes_idx on public.gastos (mes);
create index if not exists gastos_grupo_idx on public.gastos (grupo);

create table if not exists public.aportes (
  mes text not null,
  persona text not null,
  clave text not null,
  monto numeric not null default 0,
  hecho boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (mes, persona, clave)
);

alter table public.docs enable row level security;
alter table public.gastos enable row level security;
alter table public.aportes enable row level security;

-- Solo Carlos y Sofía pueden leer y escribir.
create policy "solo la pareja" on public.docs for all to authenticated
  using ((auth.jwt() ->> 'email') in ('CORREO_CARLOS', 'CORREO_SOFIA'))
  with check ((auth.jwt() ->> 'email') in ('CORREO_CARLOS', 'CORREO_SOFIA'));
create policy "solo la pareja" on public.gastos for all to authenticated
  using ((auth.jwt() ->> 'email') in ('CORREO_CARLOS', 'CORREO_SOFIA'))
  with check ((auth.jwt() ->> 'email') in ('CORREO_CARLOS', 'CORREO_SOFIA'));
create policy "solo la pareja" on public.aportes for all to authenticated
  using ((auth.jwt() ->> 'email') in ('CORREO_CARLOS', 'CORREO_SOFIA'))
  with check ((auth.jwt() ->> 'email') in ('CORREO_CARLOS', 'CORREO_SOFIA'));

-- Para que lo que anota uno le aparezca al otro al instante.
alter publication supabase_realtime add table public.docs, public.gastos, public.aportes;
