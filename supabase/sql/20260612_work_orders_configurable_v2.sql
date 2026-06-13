-- IsiVoltPro - Ordenes de trabajo configurables V2
-- No aplicar automaticamente. Revisar y ejecutar como migracion controlada.

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_tipo_check;

alter table public.ordenes_trabajo
  add column if not exists tipo_ot text not null default 'mantenimiento_preventivo',
  add column if not exists tipo_ot_detalle text,
  add column if not exists sintomas text,
  add column if not exists trabajo_solicitado text,
  add column if not exists instrucciones_tecnico text,
  add column if not exists riesgos_precauciones text,
  add column if not exists resultado_esperado text,
  add column if not exists fecha_limite timestamptz,
  add column if not exists duracion_estimada_minutos integer,
  add column if not exists configuracion jsonb not null default '{}'::jsonb,
  add column if not exists activos_relacionados uuid[] not null default '{}',
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists reassignment_reason text,
  add column if not exists revision_admin_estado text not null default 'no_requerida',
  add column if not exists revision_admin_by uuid references public.profiles(id) on delete set null,
  add column if not exists revision_admin_at timestamptz,
  add column if not exists revision_admin_notas text,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text;

update public.ordenes_trabajo
set tipo_ot = case tipo
  when 'averia' then 'diagnostico'
  when 'mantenimiento' then 'mantenimiento_preventivo'
  when 'revision' then 'revision'
  when 'instalacion' then 'instalacion'
  when 'inspeccion' then 'inspeccion'
  else coalesce(nullif(tipo_ot, ''), 'otro')
end
where tipo_ot is null or tipo_ot = 'mantenimiento_preventivo';

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_tipo_check
  check (tipo in (
    'averia','mantenimiento','revision','instalacion','inspeccion','otro',
    'presupuesto','visita_previa','toma_datos','diagnostico','reparacion',
    'mantenimiento_preventivo','mantenimiento_correctivo','montaje',
    'puesta_marcha','sustitucion','retirada','seguimiento','verificacion_funcionamiento',
    'medicion','urgencia','formacion'
  ));

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_revision_admin_estado_check;

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_revision_admin_estado_check
  check (revision_admin_estado in ('no_requerida','pendiente','validada','correccion_solicitada'));

alter table public.ot_visitas
  add column if not exists tipo_visita text not null default 'intervencion',
  add column if not exists tipo_visita_detalle text,
  add column if not exists estado_inicial text,
  add column if not exists situacion_encontrada text,
  add column if not exists trabajo_realizado text,
  add column if not exists diagnostico text,
  add column if not exists causa text,
  add column if not exists pruebas_realizadas text,
  add column if not exists recomendaciones text,
  add column if not exists trabajo_pendiente text,
  add column if not exists resultado_cierre text,
  add column if not exists motivo_cierre text,
  add column if not exists proxima_accion text,
  add column if not exists proximo_tipo_visita text,
  add column if not exists estado_final_activo text not null default 'no_comprobado',
  add column if not exists dispositivo jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ot_visitas
  drop constraint if exists ot_visitas_estado_final_activo_check;

alter table public.ot_visitas
  add constraint ot_visitas_estado_final_activo_check
  check (estado_final_activo in ('operativo','operativo_limitaciones','fuera_servicio','pendiente_reparacion','no_comprobado','no_aplica'));

alter table public.ot_checklist_respuestas
  add column if not exists tipo_campo text not null default 'resultado',
  add column if not exists opciones jsonb not null default '[]'::jsonb,
  add column if not exists requiere_observacion boolean not null default false,
  add column if not exists requiere_accion boolean not null default false,
  add column if not exists requiere_medicion boolean not null default false,
  add column if not exists valor_referencia text,
  add column if not exists medicion_valor text,
  add column if not exists accion_realizada text,
  add column if not exists defecto text,
  add column if not exists estado_despues text,
  add column if not exists recomendacion text;

alter table public.ot_fotos
  add column if not exists tipo_foto text not null default 'otra',
  add column if not exists instalacion_id uuid references public.instalaciones(id) on delete set null,
  add column if not exists ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  add column if not exists activo_id uuid references public.activos(id) on delete set null,
  add column if not exists size_bytes bigint;

create table if not exists public.ot_tipos_actuacion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  configuracion_defecto jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, codigo)
);

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
create index if not exists idx_ordenes_trabajo_tipo_ot on public.ordenes_trabajo(tipo_ot);
create index if not exists idx_ordenes_trabajo_configuracion on public.ordenes_trabajo using gin(configuracion);

alter table public.ot_tipos_actuacion enable row level security;
alter table public.ot_visita_materiales enable row level security;

drop policy if exists ot_tipos_actuacion_select on public.ot_tipos_actuacion;
create policy ot_tipos_actuacion_select
on public.ot_tipos_actuacion
for select
to authenticated
using (
  tenant_id is null
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = ot_tipos_actuacion.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
);

drop policy if exists ot_tipos_actuacion_manage on public.ot_tipos_actuacion;
create policy ot_tipos_actuacion_manage
on public.ot_tipos_actuacion
for all
to authenticated
using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = ot_tipos_actuacion.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
      and tm.role in ('admin_cliente')
  )
)
with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = ot_tipos_actuacion.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
      and tm.role in ('admin_cliente')
  )
);

drop policy if exists ot_visita_materiales_tenant_access on public.ot_visita_materiales;
create policy ot_visita_materiales_tenant_access
on public.ot_visita_materiales
for all
to authenticated
using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = ot_visita_materiales.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
)
with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = ot_visita_materiales.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
);

create or replace function public.prevent_closed_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'CERRADA' and new.estado = 'CERRADA' then
    raise exception 'La OT cerrada es de solo lectura';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_closed_work_order_changes on public.ordenes_trabajo;
create trigger trg_prevent_closed_work_order_changes
before update on public.ordenes_trabajo
for each row execute function public.prevent_closed_work_order_changes();

insert into public.ot_tipos_actuacion (tenant_id, codigo, nombre, descripcion, configuracion_defecto)
values
  (null, 'presupuesto', 'Presupuesto', 'Visita para preparar presupuesto', '{"requiere_fotos_iniciales":true,"requiere_mediciones":true,"requiere_firma_cliente":false,"requiere_informe":true}'::jsonb),
  (null, 'visita_previa', 'Visita previa', 'Reconocimiento inicial o toma de contacto', '{"requiere_fotos_iniciales":true,"requiere_informe":false}'::jsonb),
  (null, 'toma_datos', 'Toma de datos', 'Recogida de informacion tecnica', '{"requiere_mediciones":true,"requiere_fotos_iniciales":true}'::jsonb),
  (null, 'diagnostico', 'Diagnostico', 'Analisis de averia o situacion', '{"requiere_checklist":true,"requiere_fotos_iniciales":true,"requiere_informe":true}'::jsonb),
  (null, 'reparacion', 'Reparacion', 'Correccion de averia', '{"requiere_checklist":true,"requiere_fotos_iniciales":true,"requiere_fotos_finales":true,"requiere_materiales":true,"requiere_firma_cliente":true,"requiere_informe":true}'::jsonb),
  (null, 'mantenimiento_preventivo', 'Mantenimiento preventivo', 'Actuacion periodica preventiva', '{"requiere_checklist":true,"requiere_fotos_finales":true,"requiere_firma_tecnico":true,"requiere_informe":true}'::jsonb),
  (null, 'mantenimiento_correctivo', 'Mantenimiento correctivo', 'Correccion no urgente', '{"requiere_checklist":true,"requiere_fotos_iniciales":true,"requiere_fotos_finales":true,"requiere_materiales":true,"requiere_informe":true}'::jsonb),
  (null, 'inspeccion', 'Inspeccion', 'Inspeccion o revision tecnica', '{"requiere_checklist":true,"requiere_mediciones":true,"requiere_informe":true}'::jsonb),
  (null, 'revision', 'Revision', 'Revision periodica o puntual', '{"requiere_checklist":true,"requiere_informe":true}'::jsonb),
  (null, 'instalacion', 'Instalacion', 'Instalacion o montaje de equipo', '{"requiere_checklist":true,"requiere_fotos_iniciales":true,"requiere_fotos_finales":true,"requiere_materiales":true,"requiere_firma_cliente":true,"requiere_informe":true}'::jsonb),
  (null, 'otro', 'Otro', 'Actuacion personalizada', '{"requiere_checklist":false}'::jsonb)
on conflict (tenant_id, codigo) do nothing;
