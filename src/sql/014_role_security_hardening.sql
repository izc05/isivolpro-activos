alter table public.fotos
  add column if not exists visibilidad text default 'cliente'
  check (visibilidad in ('privado', 'tecnico', 'cliente'));

update public.fotos
set visibilidad = 'cliente'
where visibilidad is null;

create or replace function public.related_installation_id(
  installation_uuid uuid default null,
  location_uuid uuid default null,
  asset_uuid uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    installation_uuid,
    (select u.instalacion_id from public.ubicaciones u where u.id = location_uuid and u.deleted_at is null),
    (select a.instalacion_id from public.activos a where a.id = asset_uuid and a.deleted_at is null)
  );
$$;

create or replace function public.can_view_scoped_media(
  tenant_uuid uuid,
  installation_uuid uuid default null,
  location_uuid uuid default null,
  asset_uuid uuid default null,
  visibility_text text default 'cliente'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_tenant(tenant_uuid)
    or (
      public.has_tenant_role(tenant_uuid, 'tecnico')
      and visibility_text in ('privado', 'tecnico', 'cliente')
    )
    or (
      public.has_tenant_role(tenant_uuid, 'cliente_lectura')
      and visibility_text = 'cliente'
    )
    or (
      visibility_text in ('tecnico', 'cliente')
      and public.has_installation_permission(
        tenant_uuid,
        public.related_installation_id(installation_uuid, location_uuid, asset_uuid),
        'view'
      )
    );
$$;

create or replace function public.can_create_scoped_media(
  tenant_uuid uuid,
  installation_uuid uuid default null,
  location_uuid uuid default null,
  asset_uuid uuid default null,
  visibility_text text default 'cliente'
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
          public.related_installation_id(installation_uuid, location_uuid, asset_uuid),
          'upload'
        )
        and visibility_text in ('tecnico', 'cliente')
      )
    );
$$;

drop policy if exists ubicaciones_insert on public.ubicaciones;
create policy ubicaciones_insert on public.ubicaciones
for insert with check (public.can_manage_tenant(tenant_id));

drop policy if exists ubicaciones_update on public.ubicaciones;
create policy ubicaciones_update on public.ubicaciones
for update using (deleted_at is null and public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists activos_insert on public.activos;
create policy activos_insert on public.activos
for insert with check (public.can_manage_tenant(tenant_id));

drop policy if exists activos_update on public.activos;
create policy activos_update on public.activos
for update using (deleted_at is null and public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists documentos_update_tecnico_limited on public.documentos;

drop policy if exists fotos_select on public.fotos;
create policy fotos_select on public.fotos
for select using (
  deleted_at is null
  and public.can_view_scoped_media(tenant_id, instalacion_id, ubicacion_id, activo_id, coalesce(visibilidad, 'cliente'))
);

drop policy if exists fotos_insert on public.fotos;
create policy fotos_insert on public.fotos
for insert with check (
  public.can_create_scoped_media(tenant_id, instalacion_id, ubicacion_id, activo_id, coalesce(visibilidad, 'cliente'))
);

drop policy if exists fotos_update on public.fotos;
create policy fotos_update on public.fotos
for update using (deleted_at is null and public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists videos_insert on public.videos;
create policy videos_insert on public.videos
for insert with check (
  public.can_create_scoped_media(tenant_id, instalacion_id, ubicacion_id, activo_id, coalesce(visibilidad, 'cliente'))
);

drop policy if exists videos_update on public.videos;
create policy videos_update on public.videos
for update using (deleted_at is null and public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists historial_update on public.historial_mantenimiento;
create policy historial_update on public.historial_mantenimiento
for update using (deleted_at is null and public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

grant execute on all functions in schema public to authenticated;
