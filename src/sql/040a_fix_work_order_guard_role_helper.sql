-- Corrige una referencia histórica a has_tenant_role_any, inexistente en producción.
-- Se conserva el helper has_tenant_role(uuid, text) ya instalado y protegido.

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
  if old.tenant_id is distinct from new.tenant_id or old.id is distinct from new.id then raise exception 'No se puede cambiar la identidad o empresa de una OT'; end if;
  if old.estado in ('VALIDADA','CERRADA','CANCELADA') then raise exception 'La OT cerrada es de solo lectura'; end if;
  if old.estado = 'FINALIZADA' and (not manager or new.estado not in ('VALIDADA','EN_CURSO')) then raise exception 'La OT finalizada solo puede validarse o reabrirse por un responsable'; end if;
  if not manager then
    if not assigned_technician then raise exception 'Solo el tecnico asignado puede actualizar esta OT'; end if;
    if old.instalacion_id is distinct from new.instalacion_id or old.ubicacion_id is distinct from new.ubicacion_id or old.activo_id is distinct from new.activo_id or old.titulo is distinct from new.titulo or old.descripcion is distinct from new.descripcion or old.tipo is distinct from new.tipo or old.tipo_ot is distinct from new.tipo_ot or old.prioridad is distinct from new.prioridad or old.assigned_to is distinct from new.assigned_to or old.created_by is distinct from new.created_by or old.configuracion is distinct from new.configuracion or old.deleted_at is distinct from new.deleted_at then raise exception 'El tecnico no puede modificar la definicion de la OT'; end if;
    valid_transition := new.estado = old.estado or case old.estado when 'ASIGNADA' then new.estado = 'ACEPTADA' when 'ACEPTADA' then new.estado in ('EN_CURSO','PAUSADA') when 'EN_CURSO' then new.estado in ('PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE','FINALIZADA') when 'PAUSADA' then new.estado in ('EN_CURSO','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE') when 'PENDIENTE_MATERIAL' then new.estado in ('EN_CURSO','FINALIZADA') when 'PENDIENTE_CLIENTE' then new.estado in ('EN_CURSO','FINALIZADA') else false end;
    if not valid_transition then raise exception 'Transicion de estado no permitida: % -> %', old.estado, new.estado; end if;
  end if;
  if old.estado <> 'FINALIZADA' and new.estado = 'FINALIZADA' then
    if checklist_required and (not exists (select 1 from public.ot_checklist_respuestas c where c.ot_id = old.id) or exists (select 1 from public.ot_checklist_respuestas c where c.ot_id = old.id and c.resultado = 'pendiente')) then raise exception 'No se puede finalizar: checklist incompleto'; end if;
    if exists (select 1 from public.ot_checklist_respuestas c where c.ot_id = old.id and c.requiere_foto and not exists (select 1 from public.ot_fotos f where f.checklist_respuesta_id = c.id)) then raise exception 'No se puede finalizar: faltan fotos obligatorias'; end if;
    if signature_required and not exists (select 1 from public.ot_visitas v where v.ot_id = old.id and v.firma_path is not null) then raise exception 'No se puede finalizar: falta la firma del cliente'; end if;
    if report_required and not exists (select 1 from public.ot_informes i where i.ot_id = old.id) then raise exception 'No se puede finalizar: falta el informe PDF'; end if;
  end if;
  return new;
end;
$$;
