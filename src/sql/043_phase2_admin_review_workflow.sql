-- IsiVoltPro - Fase 2: revisión administrativa formal y correcciones auditables.

create table if not exists public.ot_revisiones_admin (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ot_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check(decision in ('validada','correccion_solicitada')),
  notas text not null,
  estado_anterior text not null,
  estado_nuevo text not null,
  created_at timestamptz not null default now()
);

alter table public.ot_revisiones_admin enable row level security;
grant select on public.ot_revisiones_admin to authenticated;
drop policy if exists ot_revisiones_admin_select on public.ot_revisiones_admin;
create policy ot_revisiones_admin_select on public.ot_revisiones_admin for select to authenticated
using(public.can_access_work_order(ot_id,'select'));
create index if not exists idx_ot_revisiones_admin_ot on public.ot_revisiones_admin(ot_id,created_at desc);

create or replace function public.review_work_order(work_order_uuid uuid, decision_text text, notes_text text)
returns public.ordenes_trabajo
language plpgsql security definer set search_path=public as $$
declare order_row public.ordenes_trabajo%rowtype; updated_row public.ordenes_trabajo%rowtype; next_status text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if decision_text not in ('validada','correccion_solicitada') then raise exception 'Decisión de revisión no válida'; end if;
  if nullif(trim(notes_text),'') is null then raise exception 'Escribe una nota de revisión'; end if;
  select * into order_row from public.ordenes_trabajo where id=work_order_uuid and deleted_at is null for update;
  if order_row.id is null or not public.can_manage_work_orders(order_row.tenant_id) then raise exception 'Solo un responsable puede revisar la OT'; end if;
  if order_row.estado <> 'FINALIZADA' then raise exception 'Solo se puede revisar una OT finalizada'; end if;
  next_status := case when decision_text='validada' then 'VALIDADA' else 'EN_CURSO' end;
  update public.ordenes_trabajo set
    estado=next_status,
    revision_admin_estado=decision_text,
    revision_admin_by=auth.uid(), revision_admin_at=now(), revision_admin_notas=trim(notes_text),
    closed_by=case when decision_text='validada' then auth.uid() else null end,
    closed_at=case when decision_text='validada' then now() else null end,
    reopened_by=case when decision_text='correccion_solicitada' then auth.uid() else reopened_by end,
    reopened_at=case when decision_text='correccion_solicitada' then now() else reopened_at end,
    reopen_reason=case when decision_text='correccion_solicitada' then trim(notes_text) else reopen_reason end,
    fecha_fin=case when decision_text='correccion_solicitada' then null else coalesce(fecha_fin,now()) end,
    updated_at=now()
  where id=order_row.id returning * into updated_row;
  insert into public.ot_revisiones_admin(tenant_id,ot_id,reviewer_id,decision,notas,estado_anterior,estado_nuevo)
  values(order_row.tenant_id,order_row.id,auth.uid(),decision_text,trim(notes_text),order_row.estado,next_status);
  insert into public.audit_logs(tenant_id,user_id,action,entity_type,entity_id,metadata)
  values(order_row.tenant_id,auth.uid(),case when decision_text='validada' then 'validate_work_order' else 'request_work_order_corrections' end,'orden_trabajo',order_row.id,jsonb_build_object('notes',trim(notes_text),'from',order_row.estado,'to',next_status));
  return updated_row;
end; $$;

revoke execute on function public.review_work_order(uuid,text,text) from public,anon;
grant execute on function public.review_work_order(uuid,text,text) to authenticated,service_role;
