-- IsiVoltPro - Reparacion de esquema para crear OT desde la app actual
-- Aplicada en Supabase para alinear ordenes_trabajo con el payload del formulario.

alter table public.ordenes_trabajo
  add column if not exists tipo_ot text not null default 'mantenimiento_preventivo',
  add column if not exists tipo_ot_detalle text,
  add column if not exists sintomas text,
  add column if not exists trabajo_solicitado text,
  add column if not exists instrucciones_tecnico text,
  add column if not exists riesgos_precauciones text,
  add column if not exists resultado_esperado text,
  add column if not exists fecha_limite timestamptz,
  add column if not exists tiempo_estimado_min integer,
  add column if not exists duracion_estimada_minutos integer,
  add column if not exists coste_estimado numeric,
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
  else coalesce(nullif(tipo_ot, ''), 'mantenimiento_preventivo')
end
where tipo_ot is null or tipo_ot = '';

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_tipo_check;

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_tipo_check
  check (tipo in (
    'averia','mantenimiento','revision','instalacion','inspeccion','otro',
    'presupuesto','visita_previa','toma_datos','diagnostico','reparacion',
    'mantenimiento_preventivo','mantenimiento_correctivo','montaje',
    'puesta_marcha','sustitucion','retirada','seguimiento','verificacion_funcionamiento',
    'medicion','urgencia','formacion','preventiva','correctiva','conductiva',
    'revision_legal','mejora','aviso_cliente'
  ));

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_prioridad_check;

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_prioridad_check
  check (prioridad in ('baja','media','normal','alta','urgente','critica'));

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_estado_check;

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_estado_check
  check (estado in (
    'BORRADOR','NUEVA','ASIGNADA','ACEPTADA','EN_CURSO','PAUSADA',
    'PENDIENTE_MATERIAL','PENDIENTE_CLIENTE','FINALIZADA','FIRMADA',
    'INFORME_GENERADO','VALIDADA','CERRADA','CANCELADA'
  ));

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_revision_admin_estado_check;

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_revision_admin_estado_check
  check (revision_admin_estado in ('no_requerida','pendiente','validada','correccion_solicitada'));

create index if not exists idx_ordenes_trabajo_tipo_ot on public.ordenes_trabajo(tipo_ot);
create index if not exists idx_ordenes_trabajo_configuracion on public.ordenes_trabajo using gin(configuracion);

notify pgrst, 'reload schema';
