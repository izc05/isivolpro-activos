-- IsiVoltPro - Borrado seguro de ordenes de trabajo
-- Ejecutar en Supabase SQL Editor despues de 021_internal_technician_assigned_ot_access.sql.
-- La OT no se elimina fisicamente: se marca deleted_at y se oculta de los listados.

create or replace function public.soft_delete_work_order(work_order_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  work_order_row public.ordenes_trabajo%rowtype;
begin
  select *
  into work_order_row
  from public.ordenes_trabajo
  where id = work_order_uuid
    and deleted_at is null
  limit 1;

  if work_order_row.id is null then
    raise exception 'orden de trabajo no encontrada';
  end if;

  if not public.can_manage_work_orders(work_order_row.tenant_id) then
    raise exception 'solo el administrador puede borrar una OT';
  end if;

  update public.ordenes_trabajo
  set deleted_at = now(),
      estado = 'CANCELADA',
      updated_at = now()
  where id = work_order_row.id;

  perform public.log_audit(
    work_order_row.tenant_id,
    'delete_work_order',
    'orden_trabajo',
    work_order_row.id,
    jsonb_build_object('codigo_ot', work_order_row.codigo_ot, 'titulo', work_order_row.titulo)
  );

  return work_order_row.id;
end;
$$;

create or replace function public.prevent_unauthorized_work_order_delete_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if not public.can_manage_work_orders(old.tenant_id) then
      raise exception 'solo el administrador puede borrar o restaurar una OT';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_unauthorized_work_order_delete_flag on public.ordenes_trabajo;
create trigger trg_prevent_unauthorized_work_order_delete_flag
before update on public.ordenes_trabajo
for each row execute function public.prevent_unauthorized_work_order_delete_flag();

-- Refuerzo de politicas por si se ejecuta este archivo en una base ya creada.
do $$
begin
  if to_regclass('public.ordenes_trabajo') is not null then
    drop policy if exists "ordenes_trabajo_select_tenant" on public.ordenes_trabajo;
    create policy "ordenes_trabajo_select_tenant"
    on public.ordenes_trabajo
    for select
    to authenticated
    using (public.can_access_work_order(id, 'select'));
  end if;
end $$;
