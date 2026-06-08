create table if not exists public.installation_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'tecnico_temporal' check (role in ('tecnico_temporal', 'tecnico_permanente', 'cliente_lectura')),
  can_view boolean not null default true,
  can_create_incident boolean not null default true,
  can_upload_media boolean not null default false,
  can_download_files boolean not null default false,
  can_edit_data boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  estado text not null default 'activo' check (estado in ('activo', 'revocado')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint installation_access_grants_valid_window check (expires_at is null or expires_at > starts_at)
);

create index if not exists installation_access_grants_user_active_idx
  on public.installation_access_grants (user_id, tenant_id, instalacion_id)
  where estado = 'activo';

create index if not exists installation_access_grants_installation_idx
  on public.installation_access_grants (tenant_id, instalacion_id);

drop trigger if exists trg_installation_access_grants_updated on public.installation_access_grants;
create trigger trg_installation_access_grants_updated
before update on public.installation_access_grants
for each row execute function public.set_updated_at();

create or replace function public.has_installation_permission(
  tenant_uuid uuid,
  installation_uuid uuid,
  permission_text text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.installation_access_grants g
    where g.tenant_id = tenant_uuid
      and g.instalacion_id = installation_uuid
      and g.user_id = auth.uid()
      and g.estado = 'activo'
      and g.can_view = true
      and g.starts_at <= now()
      and (g.expires_at is null or g.expires_at > now())
      and case permission_text
        when 'view' then g.can_view
        when 'incident' then g.can_create_incident
        when 'upload' then g.can_upload_media
        when 'download' then g.can_download_files
        when 'edit' then g.can_edit_data
        else false
      end
  );
$$;

create or replace function public.can_select_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_tenant_access(tenant_uuid)
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
      and (
        public.has_tenant_access(i.tenant_id)
        or public.has_installation_permission(i.tenant_id, i.id, 'view')
      )
  );
$$;

create or replace function public.document_installation_id(document_uuid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(d.instalacion_id, a.instalacion_id, u.instalacion_id)
  from public.documentos d
  left join public.activos a on a.id = d.activo_id and a.deleted_at is null
  left join public.ubicaciones u on u.id = d.ubicacion_id and u.deleted_at is null
  where d.id = document_uuid;
$$;

create or replace function public.can_view_document(document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documentos d
    where d.id = document_id
      and d.deleted_at is null
      and (
        public.can_manage_tenant(d.tenant_id)
        or (
          public.has_tenant_role(d.tenant_id, 'tecnico')
          and d.visibilidad in ('privado', 'tecnico', 'cliente')
        )
        or (
          public.has_tenant_role(d.tenant_id, 'cliente_lectura')
          and d.visibilidad = 'cliente'
        )
        or (
          d.visibilidad in ('tecnico', 'cliente')
          and public.has_installation_permission(d.tenant_id, public.document_installation_id(d.id), 'view')
        )
      )
  );
$$;

create or replace function public.can_download_document(document_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documentos d
    where d.id = document_uuid
      and d.deleted_at is null
      and (
        public.can_manage_tenant(d.tenant_id)
        or public.has_tenant_role(d.tenant_id, 'tecnico')
        or public.has_installation_permission(d.tenant_id, public.document_installation_id(d.id), 'download')
      )
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
    or public.has_installation_permission(tenant_uuid, installation_uuid, 'view');
$$;

create or replace function public.storage_installation_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  scope_text text;
  scope_uuid uuid;
  installation_uuid uuid;
begin
  scope_text := split_part(object_name, '/', 2);
  scope_uuid := nullif(split_part(object_name, '/', 3), '')::uuid;

  if scope_text = 'instalaciones' then
    return scope_uuid;
  elsif scope_text = 'ubicaciones' then
    select instalacion_id into installation_uuid from public.ubicaciones where id = scope_uuid and deleted_at is null;
    return installation_uuid;
  elsif scope_text = 'activos' then
    select instalacion_id into installation_uuid from public.activos where id = scope_uuid and deleted_at is null;
    return installation_uuid;
  end if;

  return null;
end;
$$;

create or replace function public.can_select_private_storage_object(bucket_name text, object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.storage_bucket_is_private(bucket_name)
    and (
      public.has_tenant_access(public.storage_tenant_id(object_name))
      or (
        bucket_name in ('photos-private', 'videos-private')
        and public.has_installation_permission(
          public.storage_tenant_id(object_name),
          public.storage_installation_id(object_name),
          'view'
        )
      )
      or (
        bucket_name = 'documents-private'
        and public.has_installation_permission(
          public.storage_tenant_id(object_name),
          public.storage_installation_id(object_name),
          'download'
        )
      )
    );
$$;

alter table public.installation_access_grants enable row level security;

drop policy if exists installation_access_grants_select on public.installation_access_grants;
create policy installation_access_grants_select on public.installation_access_grants
for select using (
  public.can_manage_tenant(tenant_id)
  or user_id = auth.uid()
);

drop policy if exists installation_access_grants_insert on public.installation_access_grants;
create policy installation_access_grants_insert on public.installation_access_grants
for insert with check (
  public.can_manage_tenant(tenant_id)
  and created_by = auth.uid()
);

drop policy if exists installation_access_grants_update on public.installation_access_grants;
create policy installation_access_grants_update on public.installation_access_grants
for update using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
for select using (deleted_at is null and public.can_select_tenant(id));

drop policy if exists instalaciones_select on public.instalaciones;
create policy instalaciones_select on public.instalaciones
for select using (deleted_at is null and public.can_view_installation(id));

drop policy if exists ubicaciones_select on public.ubicaciones;
create policy ubicaciones_select on public.ubicaciones
for select using (deleted_at is null and public.can_view_related_installation(tenant_id, instalacion_id));

drop policy if exists activos_select on public.activos;
create policy activos_select on public.activos
for select using (deleted_at is null and public.can_view_related_installation(tenant_id, instalacion_id));

drop policy if exists fotos_select on public.fotos;
create policy fotos_select on public.fotos
for select using (
  deleted_at is null
  and (
    public.has_tenant_access(tenant_id)
    or public.can_view_related_installation(
      tenant_id,
      coalesce(
        instalacion_id,
        (select a.instalacion_id from public.activos a where a.id = fotos.activo_id and a.deleted_at is null),
        (select u.instalacion_id from public.ubicaciones u where u.id = fotos.ubicacion_id and u.deleted_at is null)
      )
    )
  )
);

drop policy if exists videos_select on public.videos;
create policy videos_select on public.videos
for select using (
  deleted_at is null
  and (
    public.can_view_media(tenant_id, visibilidad)
    or (
      visibilidad in ('tecnico', 'cliente')
      and public.can_view_related_installation(
        tenant_id,
        coalesce(
          instalacion_id,
          (select a.instalacion_id from public.activos a where a.id = videos.activo_id and a.deleted_at is null),
          (select u.instalacion_id from public.ubicaciones u where u.id = videos.ubicacion_id and u.deleted_at is null)
        )
      )
    )
  )
);

drop policy if exists historial_select on public.historial_mantenimiento;
create policy historial_select on public.historial_mantenimiento
for select using (
  deleted_at is null
  and (
    public.has_tenant_access(tenant_id)
    or exists (
      select 1
      from public.activos a
      where a.id = historial_mantenimiento.activo_id
        and a.deleted_at is null
        and public.has_installation_permission(tenant_id, a.instalacion_id, 'view')
    )
  )
);

drop policy if exists incidencias_select on public.incidencias;
create policy incidencias_select on public.incidencias
for select using (
  deleted_at is null
  and (
    public.has_tenant_access(tenant_id)
    or public.has_installation_permission(tenant_id, instalacion_id, 'view')
  )
);

drop policy if exists incidencias_insert on public.incidencias;
create policy incidencias_insert on public.incidencias
for insert with check (
  public.has_tenant_access(tenant_id)
  or public.has_installation_permission(tenant_id, instalacion_id, 'incident')
);

drop policy if exists qr_registry_select on public.qr_registry;
create policy qr_registry_select on public.qr_registry
for select using (
  estado = 'activo'
  and (
    public.has_tenant_access(tenant_id)
    or (
      entity_type = 'instalacion'
      and public.has_installation_permission(tenant_id, entity_id, 'view')
    )
    or (
      entity_type = 'ubicacion'
      and exists (
        select 1 from public.ubicaciones u
        where u.id = qr_registry.entity_id
          and u.deleted_at is null
          and public.has_installation_permission(tenant_id, u.instalacion_id, 'view')
      )
    )
    or (
      entity_type = 'activo'
      and exists (
        select 1 from public.activos a
        where a.id = qr_registry.entity_id
          and a.deleted_at is null
          and public.has_installation_permission(tenant_id, a.instalacion_id, 'view')
      )
    )
  )
);

create or replace function public.resolve_qr(qr_token_text text)
returns table (
  tenant_id uuid,
  entity_type text,
  entity_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select qr.tenant_id, qr.entity_type, qr.entity_id
  from public.qr_registry qr
  where qr.token = qr_token_text
    and qr.estado = 'activo'
    and (
      public.has_tenant_access(qr.tenant_id)
      or (
        qr.entity_type = 'instalacion'
        and public.has_installation_permission(qr.tenant_id, qr.entity_id, 'view')
      )
      or (
        qr.entity_type = 'ubicacion'
        and exists (
          select 1 from public.ubicaciones u
          where u.id = qr.entity_id
            and u.deleted_at is null
            and public.has_installation_permission(qr.tenant_id, u.instalacion_id, 'view')
        )
      )
      or (
        qr.entity_type = 'activo'
        and exists (
          select 1 from public.activos a
          where a.id = qr.entity_id
            and a.deleted_at is null
            and public.has_installation_permission(qr.tenant_id, a.instalacion_id, 'view')
        )
      )
    );
end;
$$;

drop policy if exists private_storage_select on storage.objects;
create policy private_storage_select on storage.objects
for select using (
  public.can_select_private_storage_object(bucket_id, name)
);
