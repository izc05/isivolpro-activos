-- IsiVoltPro - Anulación de OT con motivo atómico
-- Reemplaza soft_delete_work_order para guardar el motivo en la misma transacción.
-- Mantiene compatibilidad con llamadas antiguas, pero exige motivo para anular.

create or replace function public.soft_delete_work_order(
  work_order_uuid uuid,
  reason_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  work_order_row record;
  reason_clean text;
  has_review_columns boolean;
begin
  reason_clean := nullif(trim(coalesce(reason_text, '')), '');
  if reason_clean is null then
    raise exception 'Indica el motivo de anulación.';
  end if;

  select id, tenant_id, estado, codigo_ot, titulo, fecha_fin
  into work_order_row
  from public.ordenes_trabajo
  where id = work_order_uuid
    and deleted_at is null
  limit 1;

  if work_order_row.id is null then
    raise exception 'orden de trabajo no encontrada';
  end if;

  if not public.can_manage_work_orders(work_order_row.tenant_id) then
    raise exception 'solo el administrador puede anular una OT';
  end if;

  if upper(coalesce(work_order_row.estado, '')) in ('FINALIZADA', 'VALIDADA', 'CERRADA', 'CANCELADA') then
    raise exception 'No se puede anular una OT finalizada, validada, cerrada o ya cancelada.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ordenes_trabajo'
      and column_name in ('revision_admin_estado', 'revision_admin_notas')
    group by table_schema, table_name
    having count(*) = 2
  ) into has_review_columns;

  if coalesce(has_review_columns, false) then
    update public.ordenes_trabajo
    set deleted_at = now(),
        estado = 'CANCELADA',
        fecha_fin = coalesce(fecha_fin, now()),
        revision_admin_estado = 'no_requerida',
        revision_admin_notas = reason_clean,
        updated_at = now()
    where id = work_order_row.id;
  else
    update public.ordenes_trabajo
    set deleted_at = now(),
        estado = 'CANCELADA',
        fecha_fin = coalesce(fecha_fin, now()),
        updated_at = now()
    where id = work_order_row.id;
  end if;

  perform public.log_audit(
    work_order_row.tenant_id,
    'annul_work_order',
    'orden_trabajo',
    work_order_row.id,
    jsonb_build_object(
      'codigo_ot', work_order_row.codigo_ot,
      'titulo', work_order_row.titulo,
      'reason', reason_clean,
      'previous_status', work_order_row.estado,
      'soft_deleted', true,
      'rpc', 'soft_delete_work_order'
    )
  );

  return work_order_row.id;
end;
$$;

grant execute on function public.soft_delete_work_order(uuid, text) to authenticated;
