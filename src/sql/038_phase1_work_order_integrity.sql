-- IsiVoltPro - Fase 1: integridad, permisos e inmutabilidad del flujo OT
-- Ejecutar despues de 037_allow_assigned_technician_work_order_flow.sql.

alter table public.ordenes_trabajo enable row level security;
alter table public.ot_visitas enable row level security;
alter table public.ot_checklist_respuestas enable row level security;
alter table public.ot_fotos enable row level security;
alter table public.ot_informes enable row level security;
alter table public.ot_visita_materiales enable row level security;

create or replace function public.is_work_order_mutable(work_order_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes_trabajo ot
    where ot.id = work_order_uuid
      and ot.deleted_at is null
      and ot.estado not in ('FINALIZADA','VALIDADA','CERRADA','CANCELADA')
  );
$$;

create or replace function public.can_modify_work_order_child(child_tenant_uuid uuid, work_order_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_work_order_child(child_tenant_uuid, work_order_uuid, 'update')
    and public.is_work_order_mutable(work_order_uuid);
$$;

revoke all on function public.is_work_order_mutable(uuid) from public, anon;
revoke all on function public.can_modify_work_order_child(uuid, uuid) from public, anon;
grant execute on function public.is_work_order_mutable(uuid) to authenticated;
grant execute on function public.can_modify_work_order_child(uuid, uuid) to authenticated;

create or replace function public.can_access_work_order(work_order_uuid uuid, mode_text text default 'select')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes_trabajo ot
    join public.tenant_members tm
      on tm.tenant_id = ot.tenant_id
     and tm.user_id = auth.uid()
     and tm.estado = 'activo'
    where ot.id = work_order_uuid
      and ot.deleted_at is null
      and (
        public.can_manage_work_orders(ot.tenant_id)
        or (
          tm.role in ('tecnico','tecnico_externo')
          and ot.assigned_to = auth.uid()
          and (
            mode_text = 'select'
            or ot.estado in ('ASIGNADA','ACEPTADA','EN_CURSO','PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE')
          )
        )
      )
  );
$$;

revoke all on function public.can_access_work_order(uuid, text) from public, anon;
grant execute on function public.can_access_work_order(uuid, text) to authenticated;

drop policy if exists ordenes_trabajo_select on public.ordenes_trabajo;
drop policy if exists ordenes_trabajo_insert on public.ordenes_trabajo;
drop policy if exists ordenes_trabajo_update on public.ordenes_trabajo;
drop policy if exists ordenes_trabajo_select_tenant on public.ordenes_trabajo;
drop policy if exists ordenes_trabajo_insert_tenant on public.ordenes_trabajo;
drop policy if exists ordenes_trabajo_update_tenant on public.ordenes_trabajo;

create policy ordenes_trabajo_select_tenant
on public.ordenes_trabajo for select to authenticated
using (public.can_access_work_order(id, 'select'));

create policy ordenes_trabajo_insert_tenant
on public.ordenes_trabajo for insert to authenticated
with check (public.can_manage_work_orders(tenant_id));

create policy ordenes_trabajo_update_tenant
on public.ordenes_trabajo for update to authenticated
using (public.can_access_work_order(id, 'update'))
with check (public.can_access_work_order(id, 'update'));

create or replace function public.guard_work_order_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  manager boolean := public.can_manage_work_orders(old.tenant_id);
  assigned_technician boolean := old.assigned_to = auth.uid()
    and (
      public.has_tenant_role(old.tenant_id, 'tecnico')
      or public.has_tenant_role(old.tenant_id, 'tecnico_externo')
    );
  valid_transition boolean := false;
  checklist_required boolean := coalesce((old.configuracion ->> 'requiere_checklist')::boolean, false);
  signature_required boolean := coalesce((old.configuracion ->> 'requiere_firma_cliente')::boolean, false);
  report_required boolean := coalesce((old.configuracion ->> 'requiere_informe')::boolean, false);
begin
  if old.tenant_id is distinct from new.tenant_id or old.id is distinct from new.id then
    raise exception 'No se puede cambiar la identidad o empresa de una OT';
  end if;

  if old.estado in ('VALIDADA','CERRADA','CANCELADA') then
    raise exception 'La OT cerrada es de solo lectura';
  end if;

  if old.estado = 'FINALIZADA' then
    if not manager or new.estado not in ('VALIDADA','EN_CURSO') then
      raise exception 'La OT finalizada solo puede validarse o reabrirse por un responsable';
    end if;
  end if;

  if not manager then
    if not assigned_technician then
      raise exception 'Solo el tecnico asignado puede actualizar esta OT';
    end if;

    if old.instalacion_id is distinct from new.instalacion_id
      or old.ubicacion_id is distinct from new.ubicacion_id
      or old.activo_id is distinct from new.activo_id
      or old.titulo is distinct from new.titulo
      or old.descripcion is distinct from new.descripcion
      or old.tipo is distinct from new.tipo
      or old.tipo_ot is distinct from new.tipo_ot
      or old.prioridad is distinct from new.prioridad
      or old.assigned_to is distinct from new.assigned_to
      or old.created_by is distinct from new.created_by
      or old.configuracion is distinct from new.configuracion
      or old.deleted_at is distinct from new.deleted_at then
      raise exception 'El tecnico no puede modificar la definicion de la OT';
    end if;

    valid_transition := new.estado = old.estado or case old.estado
      when 'ASIGNADA' then new.estado = 'ACEPTADA'
      when 'ACEPTADA' then new.estado in ('EN_CURSO','PAUSADA')
      when 'EN_CURSO' then new.estado in ('PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE','FINALIZADA')
      when 'PAUSADA' then new.estado in ('EN_CURSO','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE')
      when 'PENDIENTE_MATERIAL' then new.estado in ('EN_CURSO','FINALIZADA')
      when 'PENDIENTE_CLIENTE' then new.estado in ('EN_CURSO','FINALIZADA')
      else false
    end;

    if not valid_transition then
      raise exception 'Transicion de estado no permitida: % -> %', old.estado, new.estado;
    end if;
  end if;

  if old.estado <> 'FINALIZADA' and new.estado = 'FINALIZADA' then
    if checklist_required and (
      not exists (select 1 from public.ot_checklist_respuestas c where c.ot_id = old.id)
      or exists (select 1 from public.ot_checklist_respuestas c where c.ot_id = old.id and c.resultado = 'pendiente')
    ) then
      raise exception 'No se puede finalizar: checklist incompleto';
    end if;

    if exists (
      select 1
      from public.ot_checklist_respuestas c
      where c.ot_id = old.id
        and c.requiere_foto
        and not exists (select 1 from public.ot_fotos f where f.checklist_respuesta_id = c.id)
    ) then
      raise exception 'No se puede finalizar: faltan fotos obligatorias';
    end if;

    if signature_required and not exists (
      select 1 from public.ot_visitas v where v.ot_id = old.id and v.firma_path is not null
    ) then
      raise exception 'No se puede finalizar: falta la firma del cliente';
    end if;

    if report_required and not exists (
      select 1 from public.ot_informes i where i.ot_id = old.id
    ) then
      raise exception 'No se puede finalizar: falta el informe PDF';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_closed_work_order_changes on public.ordenes_trabajo;
drop trigger if exists trg_guard_work_order_update on public.ordenes_trabajo;
create trigger trg_guard_work_order_update
before update on public.ordenes_trabajo
for each row execute function public.guard_work_order_update();

create or replace function public.guard_work_order_child_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_ot_id uuid;
  manager boolean;
begin
  target_ot_id := case when tg_op = 'DELETE' then old.ot_id else new.ot_id end;
  if not public.is_work_order_mutable(target_ot_id) then
    raise exception 'La OT finalizada o cerrada es de solo lectura';
  end if;
  manager := public.can_manage_work_orders(case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end);

  if tg_op = 'UPDATE' and not manager then
    if old.id is distinct from new.id
      or old.tenant_id is distinct from new.tenant_id
      or old.ot_id is distinct from new.ot_id then
      raise exception 'No se puede cambiar la identidad o empresa del registro de OT';
    end if;

  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop policy if exists checklist_select_policy on public.ot_checklist_respuestas;
drop policy if exists checklist_insert_policy on public.ot_checklist_respuestas;
drop policy if exists checklist_update_policy on public.ot_checklist_respuestas;
drop policy if exists checklist_delete_policy on public.ot_checklist_respuestas;
drop policy if exists ot_fotos_select_policy on public.ot_fotos;
drop policy if exists ot_fotos_insert_policy on public.ot_fotos;
drop policy if exists ot_fotos_update_policy on public.ot_fotos;
drop policy if exists ot_fotos_delete_policy on public.ot_fotos;

create or replace function public.guard_checklist_definition_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_manage_work_orders(old.tenant_id) and (
    old.orden is distinct from new.orden
    or old.punto is distinct from new.punto
    or old.descripcion is distinct from new.descripcion
    or old.requiere_foto is distinct from new.requiere_foto
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'El tecnico no puede modificar la definicion del checklist';
  end if;
  return new;
end;
$$;

create or replace function public.guard_visit_identity_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_manage_work_orders(old.tenant_id) and (
    old.tecnico_id is distinct from new.tecnico_id
    or old.fecha_inicio is distinct from new.fecha_inicio
  ) then
    raise exception 'El tecnico no puede reasignar ni cambiar el inicio de la visita';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['ot_visitas','ot_checklist_respuestas','ot_fotos','ot_informes','ot_visita_materiales'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists trg_guard_closed_ot_write on public.%I', table_name);
      execute format('create trigger trg_guard_closed_ot_write before insert or update or delete on public.%I for each row execute function public.guard_work_order_child_write()', table_name);

      execute format('drop policy if exists %I on public.%I', table_name || '_tenant_access', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_work_order_access', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);

      execute format('create policy %I on public.%I for select to authenticated using (public.can_access_work_order_child(tenant_id, ot_id, ''select''))', table_name || '_select', table_name);
      execute format('create policy %I on public.%I for insert to authenticated with check (public.can_modify_work_order_child(tenant_id, ot_id))', table_name || '_insert', table_name);
      execute format('create policy %I on public.%I for update to authenticated using (public.can_modify_work_order_child(tenant_id, ot_id)) with check (public.can_modify_work_order_child(tenant_id, ot_id))', table_name || '_update', table_name);
      execute format('create policy %I on public.%I for delete to authenticated using (public.can_manage_work_orders(tenant_id) and public.is_work_order_mutable(ot_id))', table_name || '_delete', table_name);
    end if;
  end loop;
end $$;

drop trigger if exists trg_guard_checklist_definition_update on public.ot_checklist_respuestas;
create trigger trg_guard_checklist_definition_update
before update on public.ot_checklist_respuestas
for each row execute function public.guard_checklist_definition_update();

drop trigger if exists trg_guard_visit_identity_update on public.ot_visitas;
create trigger trg_guard_visit_identity_update
before update on public.ot_visitas
for each row execute function public.guard_visit_identity_update();

create index if not exists idx_ot_visitas_ot_estado on public.ot_visitas(ot_id, estado);
create index if not exists idx_ot_checklist_ot_resultado on public.ot_checklist_respuestas(ot_id, resultado);
create index if not exists idx_ot_fotos_checklist on public.ot_fotos(checklist_respuesta_id);
create index if not exists idx_ot_informes_ot_created on public.ot_informes(ot_id, created_at desc);

create or replace function public.finalize_work_order_visit(visit_uuid uuid, payload_json jsonb default '{}'::jsonb)
returns public.ot_visitas
language plpgsql
security invoker
set search_path = public
as $$
declare
  visit_row public.ot_visitas;
  updated_visit public.ot_visitas;
  close_result text := coalesce(nullif(payload_json ->> 'resultado_cierre', ''), 'trabajo_completado');
  next_status text;
  now_value timestamptz := now();
begin
  select * into visit_row
  from public.ot_visitas
  where id = visit_uuid
  for update;

  if visit_row.id is null then
    raise exception 'No se ha encontrado la visita';
  end if;

  if visit_row.estado <> 'EN_CURSO' then
    raise exception 'La visita ya no esta en curso';
  end if;

  if not public.can_modify_work_order_child(visit_row.tenant_id, visit_row.ot_id) then
    raise exception 'No tienes permisos para finalizar esta visita';
  end if;

  next_status := case close_result
    when 'pendiente_material' then 'PENDIENTE_MATERIAL'
    when 'pendiente_cliente' then 'PENDIENTE_CLIENTE'
    when 'necesita_otra_visita' then 'PAUSADA'
    else 'FINALIZADA'
  end;

  update public.ot_visitas
  set
    tipo_visita = coalesce(nullif(payload_json ->> 'tipo_visita', ''), tipo_visita),
    tipo_visita_detalle = nullif(payload_json ->> 'tipo_visita_detalle', ''),
    estado_inicial = nullif(payload_json ->> 'estado_inicial', ''),
    situacion_encontrada = nullif(payload_json ->> 'situacion_encontrada', ''),
    trabajo_realizado = nullif(payload_json ->> 'trabajo_realizado', ''),
    diagnostico = nullif(payload_json ->> 'diagnostico', ''),
    causa = nullif(payload_json ->> 'causa', ''),
    pruebas_realizadas = nullif(payload_json ->> 'pruebas_realizadas', ''),
    recomendaciones = nullif(payload_json ->> 'recomendaciones', ''),
    trabajo_pendiente = nullif(payload_json ->> 'trabajo_pendiente', ''),
    estado_final_activo = coalesce(nullif(payload_json ->> 'estado_final_activo', ''), estado_final_activo),
    observaciones = nullif(payload_json ->> 'observaciones', ''),
    resultado_cierre = close_result,
    motivo_cierre = nullif(payload_json ->> 'motivo_cierre', ''),
    proxima_accion = nullif(payload_json ->> 'proxima_accion', ''),
    proximo_tipo_visita = nullif(payload_json ->> 'proximo_tipo_visita', ''),
    estado = 'FINALIZADA',
    fecha_fin = now_value,
    updated_at = now_value
  where id = visit_row.id
    and tenant_id = visit_row.tenant_id
  returning * into updated_visit;

  update public.ordenes_trabajo
  set
    estado = next_status,
    fecha_fin = case when next_status = 'FINALIZADA' then now_value else null end,
    updated_at = now_value
  where id = visit_row.ot_id
    and tenant_id = visit_row.tenant_id;

  if not found then
    raise exception 'No se pudo actualizar la OT asociada';
  end if;

  return updated_visit;
end;
$$;

revoke all on function public.finalize_work_order_visit(uuid, jsonb) from public, anon;
grant execute on function public.finalize_work_order_visit(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
