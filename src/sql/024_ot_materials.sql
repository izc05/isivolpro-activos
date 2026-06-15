-- IsiVoltPro Activos QR
-- Bloque OT - Materiales usados, retirados y pendientes

create table if not exists public.ot_visita_materiales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  visita_id uuid references public.ot_visitas(id) on delete cascade,
  material_id uuid,
  descripcion_libre text,
  referencia text,
  cantidad numeric not null default 1,
  unidad text not null default 'ud',
  tipo_movimiento text not null default 'utilizado',
  numero_serie text,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ot_visita_materiales_tipo_movimiento_check
    check (tipo_movimiento in ('utilizado','retirado','pendiente_pedir','devuelto','no_utilizado'))
);

create index if not exists idx_ot_visita_materiales_tenant on public.ot_visita_materiales(tenant_id);
create index if not exists idx_ot_visita_materiales_ot on public.ot_visita_materiales(ot_id);
create index if not exists idx_ot_visita_materiales_visita on public.ot_visita_materiales(visita_id);

alter table public.ot_visita_materiales enable row level security;

drop policy if exists ot_visita_materiales_tenant_access on public.ot_visita_materiales;
create policy ot_visita_materiales_tenant_access
on public.ot_visita_materiales
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = ot_visita_materiales.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = ot_visita_materiales.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
);
