alter table public.ot_visitas
  add column if not exists tipo_visita text,
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
  add column if not exists updated_at timestamptz not null default now();

alter table public.ot_visitas
  drop constraint if exists ot_visitas_estado_final_activo_check;

alter table public.ot_visitas
  add constraint ot_visitas_estado_final_activo_check
  check (
    estado_final_activo in (
      'operativo',
      'operativo_limitaciones',
      'fuera_servicio',
      'pendiente_reparacion',
      'no_comprobado',
      'no_aplica'
    )
  );

notify pgrst, 'reload schema';
