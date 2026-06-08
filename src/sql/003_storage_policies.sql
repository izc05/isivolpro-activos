insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents-private', 'documents-private', false, 52428800, array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('photos-private', 'photos-private', false, 15728640, array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]),
  ('videos-private', 'videos-private', false, 209715200, array[
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_tenant_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

create or replace function public.storage_bucket_is_private(bucket_name text)
returns boolean
language sql
immutable
as $$
  select bucket_name in ('documents-private', 'photos-private', 'videos-private');
$$;

create policy private_storage_select on storage.objects
for select using (
  public.storage_bucket_is_private(bucket_id)
  and public.has_tenant_access(public.storage_tenant_id(name))
);

create policy private_storage_insert on storage.objects
for insert with check (
  public.storage_bucket_is_private(bucket_id)
  and (
    public.can_manage_tenant(public.storage_tenant_id(name))
    or public.has_tenant_role(public.storage_tenant_id(name), 'tecnico')
  )
);

create policy private_storage_update on storage.objects
for update using (
  public.storage_bucket_is_private(bucket_id)
  and (
    public.can_manage_tenant(public.storage_tenant_id(name))
    or public.has_tenant_role(public.storage_tenant_id(name), 'tecnico')
  )
) with check (
  public.storage_bucket_is_private(bucket_id)
  and (
    public.can_manage_tenant(public.storage_tenant_id(name))
    or public.has_tenant_role(public.storage_tenant_id(name), 'tecnico')
  )
);

create policy private_storage_delete_admin_only on storage.objects
for delete using (
  public.storage_bucket_is_private(bucket_id)
  and public.can_manage_tenant(public.storage_tenant_id(name))
);
