-- IsiVoltPro - Fase 2: evidencia QR vinculada a la OT.

create table if not exists public.ot_verificaciones_qr (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  tecnico_id uuid not null references public.profiles(id) on delete restrict,
  qr_registry_id uuid not null references public.qr_registry(id) on delete restrict,
  entity_type text not null check (entity_type in ('instalacion','ubicacion','activo')),
  entity_id uuid not null,
  resultado text not null check (resultado in ('correcto','incorrecto')),
  verificado_at timestamptz not null default now(),
  unique (ot_id, tecnico_id, qr_registry_id)
);

alter table public.ot_verificaciones_qr enable row level security;
grant select, insert on public.ot_verificaciones_qr to authenticated;

drop policy if exists ot_qr_select on public.ot_verificaciones_qr;
create policy ot_qr_select on public.ot_verificaciones_qr for select to authenticated
using (public.can_access_work_order(ot_id, 'select'));

-- La inserción normal se realiza exclusivamente mediante la RPC validada.
drop policy if exists ot_qr_insert on public.ot_verificaciones_qr;

create index if not exists idx_ot_verificaciones_qr_ot
  on public.ot_verificaciones_qr(ot_id, verificado_at desc);

create or replace function public.verify_work_order_qr(work_order_uuid uuid, qr_token_text text)
returns table (verified boolean, entity_type text, entity_id uuid, verified_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.ordenes_trabajo%rowtype;
  qr_row public.qr_registry%rowtype;
  matches boolean := false;
  verification_time timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select * into order_row from public.ordenes_trabajo where id = work_order_uuid and deleted_at is null;
  if order_row.id is null or not public.can_access_work_order(order_row.id, 'update') then raise exception 'No tienes acceso a esta OT'; end if;
  if order_row.estado not in ('ASIGNADA','ACEPTADA','EN_CURSO','PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE') then raise exception 'La OT no admite verificaciones QR'; end if;
  select * into qr_row from public.qr_registry where token = trim(qr_token_text) and estado = 'activo' limit 1;
  if qr_row.id is null or qr_row.tenant_id <> order_row.tenant_id then raise exception 'QR no válido para esta empresa'; end if;
  matches := case qr_row.entity_type
    when 'instalacion' then qr_row.entity_id = order_row.instalacion_id
    when 'ubicacion' then order_row.ubicacion_id is not null and qr_row.entity_id = order_row.ubicacion_id
    when 'activo' then order_row.activo_id is not null and qr_row.entity_id = order_row.activo_id
    else false end;
  insert into public.ot_verificaciones_qr(tenant_id,ot_id,tecnico_id,qr_registry_id,entity_type,entity_id,resultado,verificado_at)
  values(order_row.tenant_id,order_row.id,auth.uid(),qr_row.id,qr_row.entity_type,qr_row.entity_id,case when matches then 'correcto' else 'incorrecto' end,verification_time)
  on conflict (ot_id,tecnico_id,qr_registry_id) do update set resultado=excluded.resultado,verificado_at=excluded.verificado_at;
  if not matches then raise exception 'El QR no corresponde con la instalación, ubicación o activo de esta OT'; end if;
  return query select true, qr_row.entity_type, qr_row.entity_id, verification_time;
end;
$$;

revoke execute on function public.verify_work_order_qr(uuid,text) from public, anon;
grant execute on function public.verify_work_order_qr(uuid,text) to authenticated, service_role;

create or replace function public.enforce_work_order_qr_requirement()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if old.estado <> 'FINALIZADA' and new.estado = 'FINALIZADA'
    and coalesce((old.configuracion->>'requiere_verificacion_qr')::boolean,false)
    and not exists(select 1 from public.ot_verificaciones_qr q where q.ot_id=old.id and q.resultado='correcto')
  then raise exception 'No se puede finalizar: falta verificar el QR de la OT'; end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_work_order_qr_requirement on public.ordenes_trabajo;
create trigger trg_enforce_work_order_qr_requirement before update on public.ordenes_trabajo
for each row execute function public.enforce_work_order_qr_requirement();
