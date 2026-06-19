-- IsiVoltPro Activos QR
-- Bloque Mantenimiento: planificación, programados e historial técnico consolidado

create table if not exists public.planes_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid not null references public.activos(id) on delete cascade,
  nombre text not null,
  descripcion text,
  tipo text not null,
  categoria text,
  periodicidad_valor integer,
  periodicidad_unidad text,
  fecha_inicio date,
  fecha_ultima_realizacion date,
  fecha_proxima_realizacion date,
  dias_aviso integer default 15,
  tolerancia_dias integer default 0,
  prioridad text default 'media',
  responsable_id uuid references public.profiles(id) on delete set null,
  tiempo_estimado_minutos integer,
  instrucciones text,
  checklist_json jsonb default '[]'::jsonb,
  materiales_previstos_json jsonb default '[]'::jsonb,
  herramientas_json jsonb default '[]'::jsonb,
  auto_generar_ot boolean default false,
  activo boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint planes_mantenimiento_tipo_check check (tipo in ('preventivo','correctivo','predictivo','revision_tecnica','limpieza','ajuste','lubricacion','sustitucion','mejora','modificacion','calibracion','prueba_funcional','historico','otro')),
  constraint planes_mantenimiento_periodicidad_unidad_check check (periodicidad_unidad in ('dias','semanas','meses','anos','horas','ciclos','manual')),
  constraint planes_mantenimiento_prioridad_check check (prioridad in ('baja','media','normal','alta','urgente','critica'))
);

create table if not exists public.mantenimientos_programados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid references public.planes_mantenimiento(id) on delete set null,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid not null references public.activos(id) on delete cascade,
  ot_id uuid references public.ordenes_trabajo(id) on delete set null,
  incidencia_id uuid references public.incidencias(id) on delete set null,
  titulo text not null,
  descripcion text,
  tipo text not null,
  estado text not null,
  prioridad text,
  fecha_programada date,
  fecha_limite date,
  assigned_to uuid references public.profiles(id) on delete set null,
  origen text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  motivo_cancelacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint mantenimientos_programados_tipo_check check (tipo in ('preventivo','correctivo','predictivo','revision_tecnica','limpieza','ajuste','lubricacion','sustitucion','mejora','modificacion','calibracion','prueba_funcional','historico','otro')),
  constraint mantenimientos_programados_estado_check check (estado in ('borrador','programado','proximo','vencido','ot_generada','asignado','en_curso','pendiente_material','pendiente_cliente','pausado','completado','cancelado','no_aplica')),
  constraint mantenimientos_programados_origen_check check (origen in ('plan','incidencia','activo','manual','predictivo'))
);

create unique index if not exists uq_mantenimientos_programados_plan_fecha
on public.mantenimientos_programados(plan_id, fecha_programada);

alter table public.historial_mantenimiento
  add column if not exists plan_id uuid references public.planes_mantenimiento(id) on delete set null,
  add column if not exists mantenimiento_programado_id uuid references public.mantenimientos_programados(id) on delete set null,
  add column if not exists ot_id uuid references public.ordenes_trabajo(id) on delete set null,
  add column if not exists incidencia_id uuid references public.incidencias(id) on delete set null,
  add column if not exists origen text,
  add column if not exists fecha_inicio timestamptz,
  add column if not exists fecha_fin timestamptz,
  add column if not exists trabajo_previsto text,
  add column if not exists trabajo_realizado text,
  add column if not exists resultado text,
  add column if not exists causa text,
  add column if not exists solucion text,
  add column if not exists estado_activo_anterior text,
  add column if not exists estado_activo_final text,
  add column if not exists tiempo_parada_minutos integer,
  add column if not exists coste_mano_obra numeric default 0,
  add column if not exists coste_materiales numeric default 0,
  add column if not exists coste_total numeric default 0,
  add column if not exists garantia_hasta date,
  add column if not exists proxima_fecha date,
  add column if not exists observaciones text;

create index if not exists idx_planes_mantenimiento_tenant on public.planes_mantenimiento(tenant_id) where deleted_at is null;
create index if not exists idx_planes_mantenimiento_activo on public.planes_mantenimiento(activo_id) where deleted_at is null;
create index if not exists idx_planes_mantenimiento_instalacion on public.planes_mantenimiento(instalacion_id) where deleted_at is null;
create index if not exists idx_planes_mantenimiento_proxima on public.planes_mantenimiento(fecha_proxima_realizacion) where deleted_at is null;
create index if not exists idx_planes_mantenimiento_tipo on public.planes_mantenimiento(tipo) where deleted_at is null;

create index if not exists idx_mantenimientos_programados_tenant on public.mantenimientos_programados(tenant_id) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_activo on public.mantenimientos_programados(activo_id) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_instalacion on public.mantenimientos_programados(instalacion_id) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_plan on public.mantenimientos_programados(plan_id) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_ot on public.mantenimientos_programados(ot_id) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_fecha on public.mantenimientos_programados(fecha_programada) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_estado on public.mantenimientos_programados(estado) where deleted_at is null;
create index if not exists idx_mantenimientos_programados_tipo on public.mantenimientos_programados(tipo) where deleted_at is null;

create index if not exists idx_historial_mantenimiento_plan on public.historial_mantenimiento(plan_id) where deleted_at is null;
create index if not exists idx_historial_mantenimiento_programado on public.historial_mantenimiento(mantenimiento_programado_id) where deleted_at is null;
create index if not exists idx_historial_mantenimiento_ot on public.historial_mantenimiento(ot_id) where deleted_at is null;
create index if not exists idx_historial_mantenimiento_incidencia on public.historial_mantenimiento(incidencia_id) where deleted_at is null;
create index if not exists idx_historial_mantenimiento_tipo on public.historial_mantenimiento(tipo) where deleted_at is null;

drop trigger if exists trg_planes_mantenimiento_updated on public.planes_mantenimiento;
create trigger trg_planes_mantenimiento_updated
before update on public.planes_mantenimiento
for each row execute function public.set_updated_at();

drop trigger if exists trg_mantenimientos_programados_updated on public.mantenimientos_programados;
create trigger trg_mantenimientos_programados_updated
before update on public.mantenimientos_programados
for each row execute function public.set_updated_at();

alter table public.planes_mantenimiento enable row level security;
alter table public.mantenimientos_programados enable row level security;

drop policy if exists planes_mantenimiento_select on public.planes_mantenimiento;
create policy planes_mantenimiento_select
on public.planes_mantenimiento
for select
to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists planes_mantenimiento_insert on public.planes_mantenimiento;
create policy planes_mantenimiento_insert
on public.planes_mantenimiento
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists planes_mantenimiento_update on public.planes_mantenimiento;
create policy planes_mantenimiento_update
on public.planes_mantenimiento
for update
to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists mantenimientos_programados_select on public.mantenimientos_programados;
create policy mantenimientos_programados_select
on public.mantenimientos_programados
for select
to authenticated
using (
  deleted_at is null
  and (
    public.has_tenant_access(tenant_id)
    or assigned_to = auth.uid()
  )
);

drop policy if exists mantenimientos_programados_insert on public.mantenimientos_programados;
create policy mantenimientos_programados_insert
on public.mantenimientos_programados
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists mantenimientos_programados_update on public.mantenimientos_programados;
create policy mantenimientos_programados_update
on public.mantenimientos_programados
for update
to authenticated
using (
  deleted_at is null
  and (
    public.can_manage_tenant(tenant_id)
    or public.has_tenant_role(tenant_id, 'tecnico')
    or assigned_to = auth.uid()
  )
)
with check (
  public.can_manage_tenant(tenant_id)
  or public.has_tenant_role(tenant_id, 'tecnico')
  or assigned_to = auth.uid()
);

drop policy if exists historial_select on public.historial_mantenimiento;
create policy historial_select
on public.historial_mantenimiento
for select
to authenticated
using (deleted_at is null and public.has_tenant_access(tenant_id));

drop policy if exists historial_insert on public.historial_mantenimiento;
create policy historial_insert
on public.historial_mantenimiento
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

drop policy if exists historial_update on public.historial_mantenimiento;
create policy historial_update
on public.historial_mantenimiento
for update
to authenticated
using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
