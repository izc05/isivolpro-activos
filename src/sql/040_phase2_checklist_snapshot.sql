-- IsiVoltPro - Fase 2: snapshot inmutable y completo del checklist de cada OT.

alter table public.ordenes_trabajo
  add column if not exists checklist_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists checklist_snapshot_version integer not null default 1,
  add column if not exists checklist_snapshot_at timestamptz;

alter table public.ot_checklist_respuestas
  add column if not exists obligatorio boolean not null default true,
  add column if not exists tipo_respuesta text not null default 'ok_no_ok',
  add column if not exists unidad text,
  add column if not exists valor_minimo numeric,
  add column if not exists valor_maximo numeric,
  add column if not exists plantilla_item_id text;

alter table public.ot_checklist_respuestas
  drop constraint if exists ot_checklist_tipo_respuesta_check;
alter table public.ot_checklist_respuestas
  add constraint ot_checklist_tipo_respuesta_check
  check (tipo_respuesta in ('ok_no_ok','texto','numero','medicion','fotografia','seleccion'));

-- El backfill solo rellena metadatos históricos. Se suspende el guard durante esta
-- sentencia para no tratar una OT finalizada como una transición operativa.
alter table public.ordenes_trabajo disable trigger trg_guard_work_order_update;

update public.ordenes_trabajo ot
set checklist_snapshot = snapshot.items,
    checklist_snapshot_at = coalesce(ot.checklist_snapshot_at, now())
from (
  select c.ot_id,
    jsonb_agg(jsonb_build_object(
      'id', c.plantilla_item_id,
      'orden', c.orden,
      'punto', c.punto,
      'titulo', c.descripcion,
      'descripcion', c.descripcion,
      'obligatorio', c.obligatorio,
      'requiere_foto', c.requiere_foto,
      'tipo_respuesta', c.tipo_respuesta,
      'unidad', c.unidad,
      'valor_minimo', c.valor_minimo,
      'valor_maximo', c.valor_maximo
    ) order by c.orden) as items
  from public.ot_checklist_respuestas c
  group by c.ot_id
) snapshot
where ot.id = snapshot.ot_id
  and ot.checklist_snapshot = '[]'::jsonb;

alter table public.ordenes_trabajo enable trigger trg_guard_work_order_update;

create index if not exists idx_ot_checklist_ot_orden
  on public.ot_checklist_respuestas(ot_id, orden);

comment on column public.ordenes_trabajo.checklist_snapshot is
  'Copia histórica completa de la plantilla usada al crear/preparar la OT.';
