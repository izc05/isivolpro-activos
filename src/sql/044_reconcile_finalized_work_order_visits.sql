-- Repara visitas antiguas que quedaron EN_CURSO después de finalizar la OT
-- y evita nuevas inconsistencias entre OT y visita.

alter table public.ot_visitas disable trigger trg_guard_closed_ot_write;

update public.ot_visitas v
set estado='FINALIZADA',
    fecha_fin=coalesce(v.fecha_fin,ot.fecha_fin,now()),
    resultado_cierre=coalesce(v.resultado_cierre,'trabajo_completado'),
    updated_at=now()
from public.ordenes_trabajo ot
where v.ot_id=ot.id
  and ot.estado in ('FINALIZADA','VALIDADA','CERRADA')
  and v.estado='EN_CURSO';

alter table public.ot_visitas enable trigger trg_guard_closed_ot_write;

create or replace function public.enforce_no_active_visit_on_finished_order()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.estado in ('FINALIZADA','VALIDADA','CERRADA')
    and old.estado not in ('FINALIZADA','VALIDADA','CERRADA')
    and exists(select 1 from public.ot_visitas v where v.ot_id=new.id and v.estado='EN_CURSO')
  then raise exception 'No se puede finalizar la OT mientras exista una visita en curso'; end if;
  return new;
end; $$;

drop trigger if exists trg_no_active_visit_on_finished_order on public.ordenes_trabajo;
create trigger trg_no_active_visit_on_finished_order before update on public.ordenes_trabajo
for each row execute function public.enforce_no_active_visit_on_finished_order();
