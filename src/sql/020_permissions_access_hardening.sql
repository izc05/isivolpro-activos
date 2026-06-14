-- IsiVoltPro - Endurecimiento de acceso y privilegios por persona
-- Ejecutar en Supabase SQL Editor despues de las migraciones de tenants, accesos por instalacion y OT.

create or replace function public.is_active_tenant_member(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = tenant_uuid
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  );
$$;

-- Permite que tecnico_externo vea el cliente en el selector para poder cargar sus OT,
-- sin convertirlo automaticamente en acceso completo a inventario.
create or replace function public.can_select_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_tenant_access(tenant_uuid)
    or public.is_active_tenant_member(tenant_uuid)
    or exists (
      select 1
      from public.installation_access_grants g
      where g.tenant_id = tenant_uuid
        and g.user_id = auth.uid()
        and g.estado = 'activo'
        and g.can_view = true
        and g.starts_at <= now()
        and (g.expires_at is null or g.expires_at > now())
    );
$$;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
for select using (deleted_at is null and public.can_select_tenant(id));

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
        and tm.role in ('admin_cliente', 'tecnico')
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
    where ot.id = work_order_uuid
      and ot.deleted_at is null
      and (
        public.can_manage_work_orders(ot.tenant_id)
        or ot.assigned_to = auth.uid()
        or ot.created_by = auth.uid()
      )
  );
$$;

create or replace function public.can_access_work_order_child(child_tenant_uuid uuid, work_order_uuid uuid, mode_text text default 'select')
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
      and ot.tenant_id = child_tenant_uuid
      and public.can_access_work_order(ot.id, mode_text)
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

-- Limita tablas hijas de OT al administrador/tecnico del cliente o al usuario asignado/creador de la OT.
do $$
declare
  t text;
begin
  foreach t in array array['ot_visitas','ot_checklist_respuestas','ot_fotos','ot_informes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_tenant_access', t);
      execute format('drop policy if exists %I on public.%I', t || '_work_order_access', t);
      execute format($policy$
        create policy %I
        on public.%I
        for all
        to authenticated
        using (public.can_access_work_order_child(tenant_id, ot_id, 'select'))
        with check (public.can_access_work_order_child(tenant_id, ot_id, 'update'))
      $policy$, t || '_work_order_access', t);
    end if;
  end loop;
end $$;
