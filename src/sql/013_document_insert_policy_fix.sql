create or replace function public.document_belongs_to_tenant(
  tenant_uuid uuid,
  installation_uuid uuid default null,
  location_uuid uuid default null,
  asset_uuid uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    installation_uuid is not null
    and exists (
      select 1 from public.instalaciones i
      where i.id = installation_uuid
        and i.tenant_id = tenant_uuid
        and i.deleted_at is null
    )
  )
  or (
    location_uuid is not null
    and exists (
      select 1 from public.ubicaciones u
      where u.id = location_uuid
        and u.tenant_id = tenant_uuid
        and u.deleted_at is null
    )
  )
  or (
    asset_uuid is not null
    and exists (
      select 1 from public.activos a
      where a.id = asset_uuid
        and a.tenant_id = tenant_uuid
        and a.deleted_at is null
    )
  );
$$;

create or replace function public.can_create_document(
  tenant_uuid uuid,
  installation_uuid uuid default null,
  location_uuid uuid default null,
  asset_uuid uuid default null,
  visibility_text text default 'privado'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.document_belongs_to_tenant(tenant_uuid, installation_uuid, location_uuid, asset_uuid)
    and (
      public.can_manage_tenant(tenant_uuid)
      or (
        public.has_tenant_role(tenant_uuid, 'tecnico')
        and visibility_text in ('tecnico', 'cliente')
      )
      or (
        public.has_installation_permission(
          tenant_uuid,
          coalesce(
            installation_uuid,
            (select u.instalacion_id from public.ubicaciones u where u.id = location_uuid and u.deleted_at is null),
            (select a.instalacion_id from public.activos a where a.id = asset_uuid and a.deleted_at is null)
          ),
          'upload'
        )
        and visibility_text in ('tecnico', 'cliente')
      )
    );
$$;

drop policy if exists documentos_insert on public.documentos;
create policy documentos_insert on public.documentos
for insert with check (
  public.can_create_document(tenant_id, instalacion_id, ubicacion_id, activo_id, visibilidad)
);

grant execute on all functions in schema public to authenticated;
