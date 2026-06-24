-- IsiVoltPro - Permitir flujo operativo de OT al tecnico asignado
-- Asegura que el tecnico pueda aceptar, iniciar, pausar y finalizar su propia OT.

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
    join public.tenant_members tm on tm.tenant_id = ot.tenant_id
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
            or ot.estado in ('ASIGNADA','ACEPTADA','EN_CURSO','PAUSADA','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE','FINALIZADA')
          )
        )
      )
  );
$$;

drop policy if exists "ordenes_trabajo_update_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_update_tenant"
on public.ordenes_trabajo
for update
to authenticated
using (public.can_access_work_order(id, 'update'))
with check (public.can_access_work_order(id, 'update'));

grant select, update on public.ordenes_trabajo to authenticated;

notify pgrst, 'reload schema';
