-- IsiVoltPro - Fase 2: firma del técnico separada de la firma del cliente.

alter table public.ot_visitas
  add column if not exists firma_tecnico_nombre text,
  add column if not exists firma_tecnico_bucket text,
  add column if not exists firma_tecnico_path text,
  add column if not exists firma_tecnico_at timestamptz;

create or replace function public.enforce_work_order_signature_requirements()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if old.estado <> 'FINALIZADA' and new.estado = 'FINALIZADA' then
    if coalesce((old.configuracion->>'requiere_firma_cliente')::boolean,false)
      and not exists(select 1 from public.ot_visitas v where v.ot_id=old.id and v.firma_path is not null)
    then raise exception 'No se puede finalizar: falta la firma del cliente'; end if;
    if coalesce((old.configuracion->>'requiere_firma_tecnico')::boolean,false)
      and not exists(select 1 from public.ot_visitas v where v.ot_id=old.id and v.firma_tecnico_path is not null)
    then raise exception 'No se puede finalizar: falta la firma del técnico'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_work_order_signature_requirements on public.ordenes_trabajo;
create trigger trg_enforce_work_order_signature_requirements before update on public.ordenes_trabajo
for each row execute function public.enforce_work_order_signature_requirements();
