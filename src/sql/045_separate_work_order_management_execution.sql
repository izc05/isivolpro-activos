-- Separa gestión administrativa y ejecución técnica de las OT.

create or replace function public.can_execute_work_order(child_tenant_uuid uuid, work_order_uuid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.ordenes_trabajo ot
    join public.tenant_members tm on tm.tenant_id=ot.tenant_id and tm.user_id=auth.uid() and tm.estado='activo'
    where ot.id=work_order_uuid and ot.tenant_id=child_tenant_uuid and ot.deleted_at is null
      and tm.role in ('tecnico','tecnico_externo') and ot.assigned_to=auth.uid()
      and ot.estado in ('ASIGNADA','ACEPTADA','EN_CURSO','PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE')
  );
$$;

create or replace function public.can_prepare_work_order_checklist(child_tenant_uuid uuid, work_order_uuid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ordenes_trabajo ot where ot.id=work_order_uuid and ot.tenant_id=child_tenant_uuid
    and ot.deleted_at is null and ot.estado in ('BORRADOR','NUEVA') and public.can_manage_work_orders(ot.tenant_id));
$$;

create or replace function public.can_modify_work_order_child(child_tenant_uuid uuid, work_order_uuid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_execute_work_order(child_tenant_uuid,work_order_uuid) and public.is_work_order_mutable(work_order_uuid);
$$;

revoke all on function public.can_execute_work_order(uuid,uuid) from public,anon;
revoke all on function public.can_prepare_work_order_checklist(uuid,uuid) from public,anon;
grant execute on function public.can_execute_work_order(uuid,uuid) to authenticated;
grant execute on function public.can_prepare_work_order_checklist(uuid,uuid) to authenticated;

create or replace function public.enforce_work_order_management_transition()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.estado is distinct from old.estado and public.can_manage_work_orders(old.tenant_id) then
    if not (
      (old.estado in ('BORRADOR','NUEVA') and new.estado in ('ASIGNADA','CANCELADA'))
      or (old.estado in ('ASIGNADA','ACEPTADA','EN_CURSO','PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE') and new.estado='CANCELADA')
      or (old.estado='FINALIZADA' and new.estado in ('VALIDADA','EN_CURSO'))
    ) then raise exception 'El administrador gestiona y revisa la OT, pero no puede ejecutar sus pasos técnicos'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_work_order_management_transition on public.ordenes_trabajo;
create trigger trg_enforce_work_order_management_transition before update on public.ordenes_trabajo
for each row execute function public.enforce_work_order_management_transition();

create or replace function public.enforce_work_order_technician_assignment()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.assigned_to is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
    and not exists(select 1 from public.tenant_members tm where tm.tenant_id=new.tenant_id and tm.user_id=new.assigned_to
      and tm.estado='activo' and tm.role in ('tecnico','tecnico_externo'))
  then raise exception 'La OT solo puede asignarse a un técnico activo'; end if;
  return new;
end; $$;
drop trigger if exists trg_enforce_work_order_technician_assignment on public.ordenes_trabajo;
create trigger trg_enforce_work_order_technician_assignment before insert or update on public.ordenes_trabajo
for each row execute function public.enforce_work_order_technician_assignment();

drop policy if exists ot_checklist_respuestas_insert on public.ot_checklist_respuestas;
drop policy if exists ot_checklist_respuestas_update on public.ot_checklist_respuestas;
drop policy if exists ot_checklist_respuestas_delete on public.ot_checklist_respuestas;
create policy ot_checklist_respuestas_insert on public.ot_checklist_respuestas for insert to authenticated
with check(public.can_prepare_work_order_checklist(tenant_id,ot_id));
create policy ot_checklist_respuestas_update on public.ot_checklist_respuestas for update to authenticated
using(public.can_prepare_work_order_checklist(tenant_id,ot_id) or public.can_execute_work_order(tenant_id,ot_id))
with check(public.can_prepare_work_order_checklist(tenant_id,ot_id) or public.can_execute_work_order(tenant_id,ot_id));
create policy ot_checklist_respuestas_delete on public.ot_checklist_respuestas for delete to authenticated
using(public.can_prepare_work_order_checklist(tenant_id,ot_id));

do $$ declare table_name text; begin
  foreach table_name in array array['ot_visitas','ot_fotos','ot_informes','ot_visita_materiales'] loop
    execute format('drop policy if exists %I on public.%I',table_name||'_insert',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_update',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_delete',table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check(public.can_execute_work_order(tenant_id,ot_id))',table_name||'_insert',table_name);
    execute format('create policy %I on public.%I for update to authenticated using(public.can_execute_work_order(tenant_id,ot_id)) with check(public.can_execute_work_order(tenant_id,ot_id))',table_name||'_update',table_name);
    execute format('create policy %I on public.%I for delete to authenticated using(public.can_execute_work_order(tenant_id,ot_id))',table_name||'_delete',table_name);
  end loop;
end $$;

create or replace function public.guard_checklist_definition_update()
returns trigger language plpgsql security invoker set search_path=public as $$
declare manager boolean:=public.can_manage_work_orders(old.tenant_id);
begin
  if manager then
    if not public.can_prepare_work_order_checklist(old.tenant_id,old.ot_id) then raise exception 'El administrador solo puede preparar el checklist antes de asignar la OT'; end if;
    if old.resultado is distinct from new.resultado or old.observacion is distinct from new.observacion or old.visita_id is distinct from new.visita_id
      or old.medicion_valor is distinct from new.medicion_valor or old.accion_realizada is distinct from new.accion_realizada
      or old.defecto is distinct from new.defecto or old.estado_despues is distinct from new.estado_despues or old.recomendacion is distinct from new.recomendacion
    then raise exception 'El administrador no puede rellenar respuestas del checklist'; end if;
  elsif old.orden is distinct from new.orden or old.punto is distinct from new.punto or old.descripcion is distinct from new.descripcion
    or old.requiere_foto is distinct from new.requiere_foto or old.obligatorio is distinct from new.obligatorio
    or old.tipo_respuesta is distinct from new.tipo_respuesta or old.created_by is distinct from new.created_by or old.created_at is distinct from new.created_at
  then raise exception 'El técnico no puede modificar la definición del checklist'; end if;
  return new;
end; $$;

create or replace function public.guard_work_order_qr_execution()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if not public.can_execute_work_order(new.tenant_id,new.ot_id) then raise exception 'Solo el técnico asignado puede verificar el QR de la OT'; end if;
  return new;
end; $$;
drop trigger if exists trg_guard_work_order_qr_execution on public.ot_verificaciones_qr;
create trigger trg_guard_work_order_qr_execution before insert or update on public.ot_verificaciones_qr
for each row execute function public.guard_work_order_qr_execution();
