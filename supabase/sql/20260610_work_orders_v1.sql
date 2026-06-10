-- IsiVoltPro - Ordenes de trabajo V1
-- Ejecutar en Supabase SQL Editor antes de usar el modulo OT.

create table if not exists public.ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo_ot text,
  instalacion_id uuid not null references public.instalaciones(id) on delete restrict,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  titulo text not null,
  descripcion text,
  tipo text not null default 'mantenimiento' check (tipo in ('averia','mantenimiento','revision','instalacion','inspeccion','otro')),
  prioridad text not null default 'media' check (prioridad in ('baja','media','alta','urgente')),
  estado text not null default 'ASIGNADA' check (estado in ('BORRADOR','ASIGNADA','ACEPTADA','EN_CURSO','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE','FINALIZADA','FIRMADA','INFORME_GENERADO','CERRADA','CANCELADA')),
  assigned_to uuid references public.profiles(id) on delete set null,
  fecha_prevista timestamptz,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_ordenes_trabajo_tenant on public.ordenes_trabajo(tenant_id);
create index if not exists idx_ordenes_trabajo_assigned_to on public.ordenes_trabajo(assigned_to);
create index if not exists idx_ordenes_trabajo_instalacion on public.ordenes_trabajo(instalacion_id);
create index if not exists idx_ordenes_trabajo_estado on public.ordenes_trabajo(estado);
create index if not exists idx_ordenes_trabajo_fecha_prevista on public.ordenes_trabajo(fecha_prevista);

create or replace function public.set_orden_trabajo_codigo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo_ot is null or new.codigo_ot = '' then
    new.codigo_ot := 'OT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ordenes_trabajo_codigo_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create sequence if not exists public.ordenes_trabajo_codigo_seq;

drop trigger if exists trg_ordenes_trabajo_codigo on public.ordenes_trabajo;
create trigger trg_ordenes_trabajo_codigo
before insert on public.ordenes_trabajo
for each row execute function public.set_orden_trabajo_codigo();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ordenes_trabajo_updated_at on public.ordenes_trabajo;
create trigger trg_ordenes_trabajo_updated_at
before update on public.ordenes_trabajo
for each row execute function public.set_updated_at();

alter table public.ordenes_trabajo enable row level security;

-- Politicas RLS basicas por tenant.
-- Se apoyan en tenant_members igual que el resto de la app.
drop policy if exists "ordenes_trabajo_select_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_select_tenant"
on public.ordenes_trabajo
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = ordenes_trabajo.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
);

drop policy if exists "ordenes_trabajo_insert_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_insert_tenant"
on public.ordenes_trabajo
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = ordenes_trabajo.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
      and tm.role in ('admin_cliente','tecnico')
  )
);

drop policy if exists "ordenes_trabajo_update_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_update_tenant"
on public.ordenes_trabajo
for update
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = ordenes_trabajo.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
      and (
        tm.role in ('admin_cliente','tecnico')
        or ordenes_trabajo.assigned_to = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = ordenes_trabajo.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
      and (
        tm.role in ('admin_cliente','tecnico')
        or ordenes_trabajo.assigned_to = auth.uid()
      )
  )
);

-- Tablas preparadas para el siguiente paso: visitas, checklist, fotos, firmas e informes.
create table if not exists public.ot_visitas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  tecnico_id uuid references public.profiles(id) on delete set null,
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  estado text not null default 'EN_CURSO',
  observaciones text,
  latitud numeric,
  longitud numeric,
  nombre_firmante text,
  dni_firmante text,
  firma_bucket text,
  firma_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.ot_checklist_respuestas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  visita_id uuid references public.ot_visitas(id) on delete cascade,
  orden integer not null default 1,
  punto text not null,
  descripcion text not null,
  resultado text not null default 'pendiente' check (resultado in ('pendiente','ok','no_ok','no_aplica')),
  observacion text,
  requiere_foto boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ot_fotos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  visita_id uuid references public.ot_visitas(id) on delete cascade,
  checklist_respuesta_id uuid references public.ot_checklist_respuestas(id) on delete cascade,
  bucket text not null default 'photos-private',
  path text not null,
  file_name text,
  mime_type text,
  comentario text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ot_informes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  bucket text not null default 'documents-private',
  path text not null,
  filename text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ot_visitas enable row level security;
alter table public.ot_checklist_respuestas enable row level security;
alter table public.ot_fotos enable row level security;
alter table public.ot_informes enable row level security;

-- Politicas simples: cualquier miembro activo del tenant puede ver y operar estas tablas.
-- En V2 se podran endurecer por rol, tecnico asignado y permisos temporales.
do $$
declare
  t text;
begin
  foreach t in array array['ot_visitas','ot_checklist_respuestas','ot_fotos','ot_informes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_access', t);
    execute format($policy$
      create policy %I
      on public.%I
      for all
      to authenticated
      using (
        exists (
          select 1 from public.tenant_members tm
          where tm.tenant_id = %I.tenant_id
            and tm.user_id = auth.uid()
            and tm.estado = 'activo'
        )
      )
      with check (
        exists (
          select 1 from public.tenant_members tm
          where tm.tenant_id = %I.tenant_id
            and tm.user_id = auth.uid()
            and tm.estado = 'activo'
        )
      )
    $policy$, t || '_tenant_access', t, t, t);
  end loop;
end $$;
