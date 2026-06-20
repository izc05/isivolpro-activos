-- IsiVoltPro Activos QR
-- Bloque Control OCA: seguimiento documental, vencimientos e incidencias reglamentarias

create table if not exists public.controles_oca (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  nombre text not null,
  especialidad text not null,
  tipo_instalacion text,
  descripcion text,
  periodicidad_valor integer,
  periodicidad_unidad text default 'anos',
  fecha_ultima_inspeccion date,
  fecha_proxima_inspeccion date,
  dias_aviso integer default 90,
  responsable_id uuid references public.profiles(id) on delete set null,
  estado text not null default 'sin_datos',
  observaciones text,
  activo boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint controles_oca_especialidad_check check (especialidad in ('baja_tension','alta_tension','centro_transformacion','rite','pci','ascensor','equipos_presion','frigorificas','gas','otra')),
  constraint controles_oca_periodicidad_unidad_check check (periodicidad_unidad in ('meses','anos','manual')),
  constraint controles_oca_estado_check check (estado in ('sin_datos','al_dia','proxima','vencida','con_incidencias','desfavorable','no_aplica'))
);

create table if not exists public.inspecciones_oca (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  control_oca_id uuid not null references public.controles_oca(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  codigo text,
  tipo_inspeccion text not null,
  fecha_programada date,
  fecha_realizada date,
  organismo_control text,
  inspector_nombre text,
  numero_expediente text,
  numero_acta text,
  resultado text not null default 'pendiente',
  estado text not null default 'programada',
  periodicidad_aplicada integer,
  periodicidad_unidad text,
  fecha_proxima_inspeccion date,
  observaciones text,
  conclusiones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inspecciones_oca_tipo_check check (tipo_inspeccion in ('inicial','periodica','extraordinaria','segunda_visita','otra')),
  constraint inspecciones_oca_resultado_check check (resultado in ('pendiente','favorable','favorable_observaciones','condicionada','desfavorable')),
  constraint inspecciones_oca_estado_check check (estado in ('borrador','programada','realizada','acta_pendiente','con_incidencias','pendiente_subsanacion','pendiente_verificacion','cerrada','cancelada')),
  constraint inspecciones_oca_periodicidad_unidad_check check (periodicidad_unidad is null or periodicidad_unidad in ('meses','anos','manual'))
);

create table if not exists public.incidencias_oca (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inspeccion_oca_id uuid not null references public.inspecciones_oca(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  codigo text,
  titulo text not null,
  descripcion text not null,
  clasificacion text default 'observacion',
  fecha_deteccion date,
  fecha_limite date,
  estado text default 'pendiente',
  responsable_id uuid references public.profiles(id) on delete set null,
  evidencia_subsanacion text,
  fecha_subsanacion timestamptz,
  fecha_verificacion timestamptz,
  verificado_by uuid references public.profiles(id) on delete set null,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint incidencias_oca_clasificacion_check check (clasificacion in ('observacion','leve','grave','muy_grave')),
  constraint incidencias_oca_estado_check check (estado in ('pendiente','ot_creada','en_reparacion','subsanada','pendiente_verificacion','verificada','no_procede'))
);

create table if not exists public.incidencia_oca_ot (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incidencia_oca_id uuid not null references public.incidencias_oca(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint incidencia_oca_ot_unique unique (incidencia_oca_id, ot_id)
);

create table if not exists public.oca_documentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  control_oca_id uuid references public.controles_oca(id) on delete cascade,
  inspeccion_oca_id uuid references public.inspecciones_oca(id) on delete cascade,
  incidencia_oca_id uuid references public.incidencias_oca(id) on delete cascade,
  documento_id uuid not null references public.documentos(id) on delete cascade,
  tipo_documento text,
  obligatorio boolean default false,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint oca_documentos_tipo_check check (tipo_documento is null or tipo_documento in ('acta_oca','acta_anterior','certificado_favorable','certificado_subsanacion','proyecto','memoria','boletin','esquema_unifilar','contrato_mantenimiento','fotografias','otra_documentacion')),
  constraint oca_documentos_scope_check check (control_oca_id is not null or inspeccion_oca_id is not null or incidencia_oca_id is not null)
);

create index if not exists idx_controles_oca_tenant on public.controles_oca(tenant_id) where deleted_at is null;
create index if not exists idx_controles_oca_instalacion on public.controles_oca(instalacion_id) where deleted_at is null;
create index if not exists idx_controles_oca_ubicacion on public.controles_oca(ubicacion_id) where deleted_at is null;
create index if not exists idx_controles_oca_activo on public.controles_oca(activo_id) where deleted_at is null;
create index if not exists idx_controles_oca_especialidad on public.controles_oca(especialidad) where deleted_at is null;
create index if not exists idx_controles_oca_estado on public.controles_oca(estado) where deleted_at is null;
create index if not exists idx_controles_oca_proxima on public.controles_oca(fecha_proxima_inspeccion) where deleted_at is null;

create index if not exists idx_inspecciones_oca_tenant on public.inspecciones_oca(tenant_id) where deleted_at is null;
create index if not exists idx_inspecciones_oca_control on public.inspecciones_oca(control_oca_id) where deleted_at is null;
create index if not exists idx_inspecciones_oca_instalacion on public.inspecciones_oca(instalacion_id) where deleted_at is null;
create index if not exists idx_inspecciones_oca_resultado on public.inspecciones_oca(resultado) where deleted_at is null;
create index if not exists idx_inspecciones_oca_estado on public.inspecciones_oca(estado) where deleted_at is null;
create index if not exists idx_inspecciones_oca_fecha_realizada on public.inspecciones_oca(fecha_realizada) where deleted_at is null;
create index if not exists idx_inspecciones_oca_proxima on public.inspecciones_oca(fecha_proxima_inspeccion) where deleted_at is null;

create index if not exists idx_incidencias_oca_tenant on public.incidencias_oca(tenant_id) where deleted_at is null;
create index if not exists idx_incidencias_oca_inspeccion on public.incidencias_oca(inspeccion_oca_id) where deleted_at is null;
create index if not exists idx_incidencias_oca_instalacion on public.incidencias_oca(instalacion_id) where deleted_at is null;
create index if not exists idx_incidencias_oca_activo on public.incidencias_oca(activo_id) where deleted_at is null;
create index if not exists idx_incidencias_oca_estado on public.incidencias_oca(estado) where deleted_at is null;
create index if not exists idx_incidencias_oca_clasificacion on public.incidencias_oca(clasificacion) where deleted_at is null;
create index if not exists idx_incidencias_oca_fecha_limite on public.incidencias_oca(fecha_limite) where deleted_at is null;

create index if not exists idx_incidencia_oca_ot_tenant on public.incidencia_oca_ot(tenant_id) where deleted_at is null;
create index if not exists idx_incidencia_oca_ot_incidencia on public.incidencia_oca_ot(incidencia_oca_id) where deleted_at is null;
create index if not exists idx_incidencia_oca_ot_ot on public.incidencia_oca_ot(ot_id) where deleted_at is null;

create index if not exists idx_oca_documentos_tenant on public.oca_documentos(tenant_id) where deleted_at is null;
create index if not exists idx_oca_documentos_control on public.oca_documentos(control_oca_id) where deleted_at is null;
create index if not exists idx_oca_documentos_inspeccion on public.oca_documentos(inspeccion_oca_id) where deleted_at is null;
create index if not exists idx_oca_documentos_incidencia on public.oca_documentos(incidencia_oca_id) where deleted_at is null;
create index if not exists idx_oca_documentos_documento on public.oca_documentos(documento_id) where deleted_at is null;

drop trigger if exists trg_controles_oca_updated on public.controles_oca;
create trigger trg_controles_oca_updated
before update on public.controles_oca
for each row execute function public.set_updated_at();

drop trigger if exists trg_inspecciones_oca_updated on public.inspecciones_oca;
create trigger trg_inspecciones_oca_updated
before update on public.inspecciones_oca
for each row execute function public.set_updated_at();

drop trigger if exists trg_incidencias_oca_updated on public.incidencias_oca;
create trigger trg_incidencias_oca_updated
before update on public.incidencias_oca
for each row execute function public.set_updated_at();

alter table public.controles_oca enable row level security;
alter table public.inspecciones_oca enable row level security;
alter table public.incidencias_oca enable row level security;
alter table public.incidencia_oca_ot enable row level security;
alter table public.oca_documentos enable row level security;

grant select, insert, update, delete on public.controles_oca to authenticated;
grant select, insert, update, delete on public.inspecciones_oca to authenticated;
grant select, insert, update, delete on public.incidencias_oca to authenticated;
grant select, insert, update, delete on public.incidencia_oca_ot to authenticated;
grant select, insert, update, delete on public.oca_documentos to authenticated;

drop policy if exists controles_oca_select on public.controles_oca;
create policy controles_oca_select on public.controles_oca
for select to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists controles_oca_insert on public.controles_oca;
create policy controles_oca_insert on public.controles_oca
for insert to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists controles_oca_update on public.controles_oca;
create policy controles_oca_update on public.controles_oca
for update to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists inspecciones_oca_select on public.inspecciones_oca;
create policy inspecciones_oca_select on public.inspecciones_oca
for select to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists inspecciones_oca_insert on public.inspecciones_oca;
create policy inspecciones_oca_insert on public.inspecciones_oca
for insert to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists inspecciones_oca_update on public.inspecciones_oca;
create policy inspecciones_oca_update on public.inspecciones_oca
for update to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists incidencias_oca_select on public.incidencias_oca;
create policy incidencias_oca_select on public.incidencias_oca
for select to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists incidencias_oca_insert on public.incidencias_oca;
create policy incidencias_oca_insert on public.incidencias_oca
for insert to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists incidencias_oca_update on public.incidencias_oca;
create policy incidencias_oca_update on public.incidencias_oca
for update to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists incidencia_oca_ot_select on public.incidencia_oca_ot;
create policy incidencia_oca_ot_select on public.incidencia_oca_ot
for select to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists incidencia_oca_ot_insert on public.incidencia_oca_ot;
create policy incidencia_oca_ot_insert on public.incidencia_oca_ot
for insert to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists incidencia_oca_ot_update on public.incidencia_oca_ot;
create policy incidencia_oca_ot_update on public.incidencia_oca_ot
for update to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists oca_documentos_select on public.oca_documentos;
create policy oca_documentos_select on public.oca_documentos
for select to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists oca_documentos_insert on public.oca_documentos;
create policy oca_documentos_insert on public.oca_documentos
for insert to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists oca_documentos_update on public.oca_documentos;
create policy oca_documentos_update on public.oca_documentos
for update to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

comment on table public.controles_oca is 'Control reglamentario OCA por instalación, ubicación o activo opcional.';
comment on table public.inspecciones_oca is 'Inspecciones OCA realizadas o programadas, con resultado separado del estado del procedimiento.';
comment on table public.incidencias_oca is 'Incidencias o defectos detectados en inspecciones OCA.';
comment on table public.incidencia_oca_ot is 'Relación N-N entre incidencias OCA y órdenes de trabajo de subsanación.';
comment on table public.oca_documentos is 'Vinculación documental OCA reutilizando documentos existentes.';
