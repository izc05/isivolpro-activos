-- IsiVoltPro - Acceso de tecnicos propios a las OT asignadas
-- Ejecutar en Supabase SQL Editor despues de 020_permissions_access_hardening.sql.
-- Objetivo: el rol tecnico propio puede abrir cualquier OT que se le asigne,
-- sin crear un permiso temporal por instalacion. Solo admin_cliente gestiona todas las OT.

create or replace function public.can_manage_work_orders(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = tenant_uuid
        and tm.user_id = auth.uid()
        and tm.estado = 'activo'
        and tm.role = 'admin_cliente'
    );
$$;

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
    left join public.tenant_members tm on tm.tenant_id = ot.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
    where ot.id = work_order_uuid
      and ot.deleted_at is null
      and (
        public.can_manage_work_orders(ot.tenant_id)
        or ot.assigned_to = auth.uid()
        or ot.created_by = auth.uid()
        or (
          tm.role = 'tecnico'
          and (ot.assigned_to = auth.uid() or ot.created_by = auth.uid())
        )
        or (
          tm.role = 'tecnico_externo'
          and ot.assigned_to = auth.uid()
        )
      )
  );
$$;

-- Permite ver la instalacion/ubicacion/activo asociado cuando el usuario tiene una OT asignada.
create or replace function public.has_assigned_work_order_for_installation(tenant_uuid uuid, installation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes_trabajo ot
    where ot.tenant_id = tenant_uuid
      and ot.instalacion_id = installation_uuid
      and ot.deleted_at is null
      and (ot.assigned_to = auth.uid() or ot.created_by = auth.uid())
  );
$$;

create or replace function public.can_view_related_installation(
  tenant_uuid uuid,
  installation_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_tenant_access(tenant_uuid)
    or public.has_installation_permission(tenant_uuid, installation_uuid, 'view')
    or public.has_assigned_work_order_for_installation(tenant_uuid, installation_uuid);
$$;

create or replace function public.can_view_installation(installation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instalaciones i
    where i.id = installation_uuid
      and i.deleted_at is null
      and public.can_view_related_installation(i.tenant_id, i.id)
  );
$$;

do $$
begin
  if to_regclass('public.ordenes_trabajo') is not null then
    drop policy if exists "ordenes_trabajo_select_tenant" on public.ordenes_trabajo;
    create policy "ordenes_trabajo_select_tenant"
    on public.ordenes_trabajo
    for select
    to authenticated
    using (public.can_access_work_order(id, 'select'));

    drop policy if exists "ordenes_trabajo_insert_tenant" on public.ordenes_trabajo;
    create policy "ordenes_trabajo_insert_tenant"
    on public.ordenes_trabajo
    for insert
    to authenticated
    with check (public.can_manage_work_orders(tenant_id));

    drop policy if exists "ordenes_trabajo_update_tenant" on public.ordenes_trabajo;
    create policy "ordenes_trabajo_update_tenant"
    on public.ordenes_trabajo
    for update
    to authenticated
    using (public.can_access_work_order(id, 'update'))
    with check (public.can_access_work_order(id, 'update'));
  end if;
end $$;

-- Reaplica politicas de lectura de inventario usando can_view_related_installation.
drop policy if exists instalaciones_select on public.instalaciones;
create policy instalaciones_select on public.instalaciones
for select using (deleted_at is null and public.can_view_installation(id));

drop policy if exists ubicaciones_select on public.ubicaciones;
create policy ubicaciones_select on public.ubicaciones
for select using (deleted_at is null and public.can_view_related_installation(tenant_id, instalacion_id));

drop policy if exists activos_select on public.activos;
create policy activos_select on public.activos
for select using (deleted_at is null and public.can_view_related_installation(tenant_id, instalacion_id));
