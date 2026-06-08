-- 001_schema.sql
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.secure_token(token_length int default 24)
returns text
language sql
stable
set search_path = public
as $$
  select lower(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, greatest(8, least(token_length, 96))));
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cif text,
  direccion text,
  telefono text,
  email text,
  estado text default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  telefono text,
  avatar_url text,
  global_role text check (global_role in ('super_admin', 'usuario')) default 'usuario',
  mfa_required boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura')),
  estado text default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, user_id)
);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text,
  email text not null,
  role text not null check (role in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura')),
  token_hash text unique not null,
  estado text check (estado in ('pendiente', 'aceptada', 'revocada', 'caducada')) default 'pendiente',
  mfa_required boolean default false,
  invited_by uuid references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create table public.instalaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text not null,
  codigo text unique,
  tipo text,
  direccion text,
  latitud numeric(10, 7),
  longitud numeric(10, 7),
  maps_url text,
  contacto_nombre text,
  contacto_telefono text,
  contacto_email text,
  descripcion text,
  image_bucket text,
  image_path text,
  image_file_name text,
  image_mime_type text,
  estado text default 'activa',
  qr_token text unique not null default public.secure_token(),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  nombre text not null,
  tipo text,
  planta text,
  zona text,
  descripcion text,
  image_bucket text,
  image_path text,
  image_file_name text,
  image_mime_type text,
  qr_token text unique not null default public.secure_token(),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.activos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  nombre text not null,
  tipo text,
  marca text,
  modelo text,
  numero_serie text,
  referencia text,
  estado text check (estado in ('correcto', 'pendiente', 'averiado', 'fuera_servicio')) default 'correcto',
  criticidad text check (criticidad in ('baja', 'media', 'alta', 'critica')) default 'media',
  fecha_instalacion date,
  fecha_ultima_revision date,
  fecha_proxima_revision date,
  descripcion text,
  observaciones text,
  qr_token text unique not null default public.secure_token(),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid references public.instalaciones(id) on delete set null,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  tipo text,
  titulo text not null,
  descripcion text,
  bucket text not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  visibilidad text check (visibilidad in ('privado', 'tecnico', 'cliente')) default 'privado',
  version int default 1,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid references public.instalaciones(id) on delete set null,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  titulo text not null,
  descripcion text,
  tipo text check (tipo in ('archivo', 'url')),
  bucket text,
  storage_path text,
  external_url text,
  visibilidad text check (visibilidad in ('privado', 'tecnico', 'cliente')) default 'cliente',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid references public.instalaciones(id) on delete set null,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  titulo text,
  descripcion text,
  bucket text not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  visibilidad text check (visibilidad in ('privado', 'tecnico', 'cliente')) default 'cliente',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.historial_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  activo_id uuid not null references public.activos(id) on delete cascade,
  fecha date not null,
  tipo text check (tipo in ('preventivo', 'correctivo', 'revision', 'sustitucion', 'incidencia', 'otro')),
  titulo text not null,
  descripcion text,
  tecnico_id uuid references public.profiles(id),
  estado_final text,
  proxima_accion text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.incidencias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  titulo text not null,
  descripcion text,
  prioridad text check (prioridad in ('baja', 'media', 'alta', 'urgente')) default 'media',
  estado text check (estado in ('abierta', 'en_proceso', 'observada', 'cerrada')) default 'abierta',
  fecha_apertura timestamptz default now(),
  fecha_cierre timestamptz,
  created_by uuid references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.qr_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token text unique not null default public.secure_token(),
  entity_type text check (entity_type in ('instalacion', 'ubicacion', 'activo', 'documento')),
  entity_id uuid not null,
  estado text check (estado in ('activo', 'revocado')) default 'activo',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create table public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.profiles(id),
  operation text not null,
  payload jsonb not null,
  status text default 'pending',
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index on public.tenant_members (user_id, tenant_id) where estado = 'activo';
create index on public.tenant_invitations (tenant_id, estado, created_at desc);
create index on public.tenant_invitations (lower(email), estado);
create index on public.instalaciones (tenant_id) where deleted_at is null;
create index on public.ubicaciones (tenant_id, instalacion_id) where deleted_at is null;
create index on public.activos (tenant_id, instalacion_id, ubicacion_id) where deleted_at is null;
create index on public.documentos (tenant_id, activo_id) where deleted_at is null;
create index on public.qr_registry (token) where estado = 'activo';
create index on public.audit_logs (tenant_id, created_at desc);

create trigger trg_tenants_updated before update on public.tenants for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_tenant_members_updated before update on public.tenant_members for each row execute function public.set_updated_at();
create trigger trg_instalaciones_updated before update on public.instalaciones for each row execute function public.set_updated_at();
create trigger trg_ubicaciones_updated before update on public.ubicaciones for each row execute function public.set_updated_at();
create trigger trg_activos_updated before update on public.activos for each row execute function public.set_updated_at();
create trigger trg_documentos_updated before update on public.documentos for each row execute function public.set_updated_at();
create trigger trg_videos_updated before update on public.videos for each row execute function public.set_updated_at();
create trigger trg_fotos_updated before update on public.fotos for each row execute function public.set_updated_at();
create trigger trg_historial_updated before update on public.historial_mantenimiento for each row execute function public.set_updated_at();
create trigger trg_incidencias_updated before update on public.incidencias for each row execute function public.set_updated_at();

create or replace function public.register_qr_for_installation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
  values (new.tenant_id, new.qr_token, 'instalacion', new.id, new.created_by)
  on conflict (token) do nothing;
  return new;
end;
$$;

create or replace function public.register_qr_for_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
  values (new.tenant_id, new.qr_token, 'ubicacion', new.id, new.created_by)
  on conflict (token) do nothing;
  return new;
end;
$$;

create or replace function public.register_qr_for_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
  values (new.tenant_id, new.qr_token, 'activo', new.id, new.created_by)
  on conflict (token) do nothing;
  return new;
end;
$$;

create trigger trg_qr_instalacion after insert on public.instalaciones for each row execute function public.register_qr_for_installation();
create trigger trg_qr_ubicacion after insert on public.ubicaciones for each row execute function public.register_qr_for_location();
create trigger trg_qr_activo after insert on public.activos for each row execute function public.register_qr_for_asset();

-- 002_rls_policies.sql
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and global_role = 'super_admin'
  );
$$;

create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.tenant_members
  where user_id = auth.uid()
    and estado = 'activo';
$$;

create or replace function public.has_tenant_access(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = tenant_uuid
        and user_id = auth.uid()
        and role in ('admin_cliente', 'tecnico', 'cliente_lectura')
        and estado = 'activo'
    );
$$;

create or replace function public.has_tenant_role(tenant_uuid uuid, role_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = tenant_uuid
        and user_id = auth.uid()
        and role = role_text
        and estado = 'activo'
    );
$$;

create or replace function public.can_manage_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.has_tenant_role(tenant_uuid, 'admin_cliente');
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
      )
  );
$$;

create or replace function public.can_view_media(media_tenant_id uuid, media_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_tenant(media_tenant_id)
    or (public.has_tenant_role(media_tenant_id, 'tecnico') and media_visibility in ('privado', 'tecnico', 'cliente'))
    or (public.has_tenant_role(media_tenant_id, 'cliente_lectura') and media_visibility = 'cliente');
$$;

create or replace function public.log_audit(
  tenant_uuid uuid,
  action_text text,
  entity_type_text text default null,
  entity_uuid uuid default null,
  metadata_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  log_id uuid;
begin
  if tenant_uuid is not null and not public.has_tenant_access(tenant_uuid) then
    raise exception 'permission denied for tenant %', tenant_uuid;
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (tenant_uuid, auth.uid(), action_text, entity_type_text, entity_uuid, coalesce(metadata_json, '{}'::jsonb))
  returning id into log_id;

  return log_id;
end;
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.instalaciones enable row level security;
alter table public.ubicaciones enable row level security;
alter table public.activos enable row level security;
alter table public.documentos enable row level security;
alter table public.videos enable row level security;
alter table public.fotos enable row level security;
alter table public.historial_mantenimiento enable row level security;
alter table public.incidencias enable row level security;
alter table public.qr_registry enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_queue enable row level security;

create policy tenants_select on public.tenants
for select using (deleted_at is null and public.has_tenant_access(id));
create policy tenants_insert on public.tenants
for insert with check (public.is_super_admin());
create policy tenants_update on public.tenants
for update using (public.can_manage_tenant(id)) with check (public.can_manage_tenant(id));

create policy profiles_select on public.profiles
for select using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.tenant_members tm_self
    join public.tenant_members tm_other on tm_other.tenant_id = tm_self.tenant_id
    where tm_self.user_id = auth.uid()
      and tm_other.user_id = profiles.id
      and tm_self.estado = 'activo'
      and tm_other.estado = 'activo'
  )
);
create policy profiles_insert_own on public.profiles
for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
for update using (id = auth.uid() or public.is_super_admin()) with check (id = auth.uid() or public.is_super_admin());

create policy tenant_members_select on public.tenant_members
for select using (public.has_tenant_access(tenant_id));
create policy tenant_members_manage on public.tenant_members
for all using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create policy tenant_invitations_select on public.tenant_invitations
for select using (public.can_manage_tenant(tenant_id));
create policy tenant_invitations_update on public.tenant_invitations
for update using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create or replace function public.create_tenant_invitation(
  tenant_uuid uuid,
  invite_email text,
  invite_role text,
  require_mfa boolean default false
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  inserted_id uuid;
  inserted_expires_at timestamptz;
begin
  if not public.can_manage_tenant(tenant_uuid) then
    raise exception 'permission denied';
  end if;

  if invite_role not in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura') then
    raise exception 'invalid role';
  end if;

  raw_token := public.secure_token(32);

  insert into public.tenant_invitations (
    tenant_id,
    email,
    role,
    token_hash,
    mfa_required,
    invited_by
  )
  values (
    tenant_uuid,
    lower(trim(invite_email)),
    invite_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    coalesce(require_mfa, false),
    auth.uid()
  )
  returning id, expires_at into inserted_id, inserted_expires_at;

  perform public.log_audit(
    tenant_uuid,
    'create_invitation',
    'tenant_invitation',
    inserted_id,
    jsonb_build_object('email', lower(trim(invite_email)), 'role', invite_role, 'mfa_required', coalesce(require_mfa, false))
  );

  return query select inserted_id, raw_token, inserted_expires_at;
end;
$$;

create or replace function public.accept_tenant_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tenant_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
  into invitation
  from public.tenant_invitations
  where token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
    and estado = 'pendiente'
    and expires_at > now()
  limit 1;

  if invitation.id is null then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(invitation.email) <> current_email then
    raise exception 'invitation email does not match current user';
  end if;

  insert into public.profiles (id, email, global_role, mfa_required)
  values (auth.uid(), current_email, 'usuario', invitation.mfa_required)
  on conflict (id) do update
  set email = excluded.email,
      mfa_required = public.profiles.mfa_required or excluded.mfa_required,
      updated_at = now();

  insert into public.tenant_members (tenant_id, user_id, role, estado)
  values (invitation.tenant_id, auth.uid(), invitation.role, 'activo')
  on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      estado = 'activo',
      updated_at = now();

  update public.tenant_invitations
  set estado = 'aceptada',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = invitation.id;

  perform public.log_audit(
    invitation.tenant_id,
    'accept_invitation',
    'tenant_invitation',
    invitation.id,
    jsonb_build_object('email', current_email, 'role', invitation.role)
  );

  return invitation.tenant_id;
end;
$$;

create or replace function public.set_member_mfa_required(member_user_id uuid, require_mfa boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  managed_tenant uuid;
begin
  select tm.tenant_id
  into managed_tenant
  from public.tenant_members tm
  where tm.user_id = member_user_id
    and public.can_manage_tenant(tm.tenant_id)
  limit 1;

  if managed_tenant is null then
    raise exception 'permission denied';
  end if;

  update public.profiles
  set mfa_required = require_mfa,
      updated_at = now()
  where id = member_user_id;

  perform public.log_audit(
    managed_tenant,
    'update_member_mfa',
    'profile',
    member_user_id,
    jsonb_build_object('mfa_required', require_mfa)
  );
end;
$$;

create policy instalaciones_select on public.instalaciones
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy instalaciones_insert on public.instalaciones
for insert with check (public.can_manage_tenant(tenant_id));
create policy instalaciones_update on public.instalaciones
for update using (deleted_at is null and public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create policy ubicaciones_select on public.ubicaciones
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy ubicaciones_insert on public.ubicaciones
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy ubicaciones_update on public.ubicaciones
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy activos_select on public.activos
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy activos_insert on public.activos
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy activos_update on public.activos
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy documentos_select on public.documentos
for select using (public.can_view_document(id));
create policy documentos_insert on public.documentos
for insert with check (
  public.can_manage_tenant(tenant_id)
  or (public.has_tenant_role(tenant_id, 'tecnico') and visibilidad in ('tecnico', 'cliente'))
);
create policy documentos_update_admin on public.documentos
for update using (deleted_at is null and public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));
create policy documentos_update_tecnico_limited on public.documentos
for update using (deleted_at is null and public.has_tenant_role(tenant_id, 'tecnico') and visibilidad <> 'privado')
with check (public.has_tenant_role(tenant_id, 'tecnico') and visibilidad in ('tecnico', 'cliente'));

create policy videos_select on public.videos
for select using (deleted_at is null and public.can_view_media(tenant_id, visibilidad));
create policy videos_insert on public.videos
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy videos_update on public.videos
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy fotos_select on public.fotos
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy fotos_insert on public.fotos
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy fotos_update on public.fotos
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy historial_select on public.historial_mantenimiento
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy historial_insert on public.historial_mantenimiento
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy historial_update on public.historial_mantenimiento
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy incidencias_select on public.incidencias
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy incidencias_insert on public.incidencias
for insert with check (public.has_tenant_access(tenant_id));
create policy incidencias_update on public.incidencias
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy qr_registry_select on public.qr_registry
for select using (estado = 'activo' and public.has_tenant_access(tenant_id));
create policy qr_registry_insert on public.qr_registry
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy qr_registry_update on public.qr_registry
for update using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create policy audit_logs_select on public.audit_logs
for select using (
  public.is_super_admin()
  or (tenant_id is not null and public.has_tenant_role(tenant_id, 'admin_cliente'))
);
create policy audit_logs_insert on public.audit_logs
for insert with check (user_id = auth.uid() and (tenant_id is null or public.has_tenant_access(tenant_id)));

create policy sync_queue_select on public.sync_queue
for select using (user_id = auth.uid() and public.has_tenant_access(tenant_id));
create policy sync_queue_insert on public.sync_queue
for insert with check (user_id = auth.uid() and public.has_tenant_access(tenant_id));
create policy sync_queue_update on public.sync_queue
for update using (user_id = auth.uid() and public.has_tenant_access(tenant_id))
with check (user_id = auth.uid() and public.has_tenant_access(tenant_id));

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
    and public.has_tenant_access(qr.tenant_id);
end;
$$;

create or replace function public.export_installation_json(installation_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.can_manage_tenant(i.tenant_id) then
      jsonb_build_object('error', 'permission_denied')
    else
      jsonb_build_object(
        'instalacion', to_jsonb(i) - 'deleted_at',
        'ubicaciones', coalesce((select jsonb_agg(to_jsonb(u) - 'deleted_at') from public.ubicaciones u where u.instalacion_id = i.id and u.deleted_at is null), '[]'::jsonb),
        'activos', coalesce((select jsonb_agg(to_jsonb(a) - 'deleted_at') from public.activos a where a.instalacion_id = i.id and a.deleted_at is null), '[]'::jsonb),
        'historial', coalesce((select jsonb_agg(to_jsonb(h) - 'deleted_at') from public.historial_mantenimiento h join public.activos a on a.id = h.activo_id where a.instalacion_id = i.id and h.deleted_at is null), '[]'::jsonb),
        'incidencias', coalesce((select jsonb_agg(to_jsonb(inc) - 'deleted_at') from public.incidencias inc where inc.instalacion_id = i.id and inc.deleted_at is null), '[]'::jsonb),
        'documentos_metadata', coalesce((select jsonb_agg(to_jsonb(d) - 'storage_path' - 'deleted_at') from public.documentos d where d.instalacion_id = i.id and d.deleted_at is null), '[]'::jsonb),
        'generated_at', now()
      )
    end
  from public.instalaciones i
  where i.id = installation_uuid and i.deleted_at is null;
$$;

-- 003_storage_policies.sql
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

-- 004_seed_demo.sql
do $$
declare
  tenant_id uuid := gen_random_uuid();
  instalacion_id uuid := gen_random_uuid();
  ubicacion_id uuid := gen_random_uuid();
  activo_cuadro_id uuid := gen_random_uuid();
  activo_bomba_id uuid := gen_random_uuid();
  activo_grupo_id uuid := gen_random_uuid();
begin
  insert into public.tenants (id, nombre, cif, direccion, telefono, email)
  values (
    tenant_id,
    'Comunidad Los Olivos',
    'H00000000',
    'Calle Los Olivos 12',
    '+34 600 000 000',
    'administracion@losolivos.example'
  );

  insert into public.instalaciones (id, tenant_id, nombre, codigo, tipo, direccion, descripcion)
  values (
    instalacion_id,
    tenant_id,
    'Garaje Comunidad Los Olivos',
    'OLIVOS-GAR-001',
    'Garaje comunitario',
    'Calle Los Olivos 12, Planta -1',
    'Instalacion demo para documentacion tecnica por QR.'
  );

  insert into public.ubicaciones (id, tenant_id, instalacion_id, nombre, tipo, planta, zona, descripcion)
  values (
    ubicacion_id,
    tenant_id,
    instalacion_id,
    'Cuarto electrico',
    'Sala tecnica',
    '-1',
    'Acceso garaje',
    'Cuarto tecnico principal del garaje.'
  );

  insert into public.activos (
    id, tenant_id, instalacion_id, ubicacion_id, nombre, tipo, marca, modelo,
    numero_serie, estado, criticidad, fecha_instalacion, fecha_ultima_revision,
    fecha_proxima_revision, observaciones
  )
  values
    (activo_cuadro_id, tenant_id, instalacion_id, ubicacion_id, 'Cuadro general garaje', 'Cuadro electrico', 'Demo', 'CG-400', 'DEMO-CG-001', 'correcto', 'alta', current_date - 1200, current_date - 40, current_date + 325, 'Protecciones revisadas en ultima visita.'),
    (activo_bomba_id, tenant_id, instalacion_id, ubicacion_id, 'Bomba achique garaje', 'Bomba de agua', 'DemoPump', 'A-120', 'DEMO-BA-002', 'pendiente', 'critica', current_date - 950, current_date - 190, current_date + 15, 'Pendiente de revision preventiva.'),
    (activo_grupo_id, tenant_id, instalacion_id, ubicacion_id, 'Grupo presion agua', 'Grupo de presion', 'DemoPress', 'GP-220', 'DEMO-GP-003', 'correcto', 'media', current_date - 800, current_date - 60, current_date + 120, 'Funcionamiento normal.');

  insert into public.documentos (tenant_id, instalacion_id, ubicacion_id, activo_id, tipo, titulo, descripcion, bucket, storage_path, file_name, mime_type, size_bytes, visibilidad)
  values
    (tenant_id, instalacion_id, ubicacion_id, activo_cuadro_id, 'Esquema unifilar', 'Esquema unifilar cuadro garaje', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_cuadro_id || '/documentos/esquema-unifilar-demo.pdf', 'esquema-unifilar-demo.pdf', 'application/pdf', 0, 'tecnico'),
    (tenant_id, instalacion_id, ubicacion_id, activo_bomba_id, 'Manual', 'Manual bomba achique', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_bomba_id || '/documentos/manual-bomba-demo.pdf', 'manual-bomba-demo.pdf', 'application/pdf', 0, 'cliente'),
    (tenant_id, instalacion_id, null, null, 'OCA', 'Informe OCA instalacion garaje', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/instalaciones/' || instalacion_id || '/documentos/oca-demo.pdf', 'oca-demo.pdf', 'application/pdf', 0, 'privado');

  insert into public.historial_mantenimiento (tenant_id, activo_id, fecha, tipo, titulo, descripcion, estado_final, proxima_accion)
  values
    (tenant_id, activo_cuadro_id, current_date - 40, 'revision', 'Revision anual cuadro general', 'Comprobacion visual y reapriete de bornes.', 'Correcto', 'Nueva revision anual.'),
    (tenant_id, activo_bomba_id, current_date - 190, 'preventivo', 'Prueba de funcionamiento bomba', 'Arranque correcto, se recomienda limpieza de boya.', 'Pendiente limpieza', 'Limpiar boya en proxima visita.');

  insert into public.incidencias (tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, prioridad, estado)
  values
    (tenant_id, instalacion_id, ubicacion_id, activo_bomba_id, 'Revision preventiva proxima', 'Programar revision de bomba de achique antes de la temporada de lluvias.', 'alta', 'abierta');

  insert into public.videos (tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, tipo, external_url, visibilidad)
  values
    (tenant_id, instalacion_id, ubicacion_id, activo_bomba_id, 'Como parar bomba en emergencia', 'Video externo demo para procedimiento de emergencia.', 'url', 'https://example.com/video-demo', 'cliente');
end $$;

-- 005_demo_signup.sql
-- Optional development/demo helper.
-- Do not run this file in production unless you intentionally want open demo self-registration.

create or replace function public.claim_demo_access(demo_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_tenant_id uuid;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select id
  into demo_tenant_id
  from public.tenants
  where nombre = 'Comunidad Los Olivos'
    and deleted_at is null
  limit 1;

  if demo_tenant_id is null then
    raise exception 'demo tenant not found. Run 004_seed_demo.sql first.';
  end if;

  insert into public.profiles (id, nombre, email, global_role, mfa_required)
  values (auth.uid(), nullif(trim(demo_name), ''), current_email, 'usuario', false)
  on conflict (id) do update
  set nombre = coalesce(nullif(trim(demo_name), ''), public.profiles.nombre),
      email = excluded.email,
      updated_at = now();

  insert into public.tenant_members (tenant_id, user_id, role, estado)
  values (demo_tenant_id, auth.uid(), 'admin_cliente', 'activo')
  on conflict (tenant_id, user_id) do update
  set role = 'admin_cliente',
      estado = 'activo',
      updated_at = now();

  perform public.log_audit(
    demo_tenant_id,
    'claim_demo_access',
    'tenant',
    demo_tenant_id,
    jsonb_build_object('email', current_email)
  );

  return demo_tenant_id;
end;
$$;

-- 006_installation_location_images.sql
-- Incremental migration for projects already created before image support.

alter table public.instalaciones
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_file_name text,
  add column if not exists image_mime_type text;

alter table public.ubicaciones
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_file_name text,
  add column if not exists image_mime_type text;

-- 007_client_management.sql
-- Owner/demo helper for creating client tenants from the app without service_role in frontend.

create or replace function public.create_tenant_as_owner(
  tenant_name text,
  tenant_cif text default null,
  tenant_direccion text default null,
  tenant_telefono text default null,
  tenant_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if nullif(trim(tenant_name), '') is null then
    raise exception 'tenant name is required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  insert into public.tenants (nombre, cif, direccion, telefono, email)
  values (
    trim(tenant_name),
    nullif(trim(tenant_cif), ''),
    nullif(trim(tenant_direccion), ''),
    nullif(trim(tenant_telefono), ''),
    nullif(trim(tenant_email), '')
  )
  returning id into new_tenant_id;

  insert into public.profiles (id, email, global_role)
  values (auth.uid(), current_email, 'usuario')
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.tenant_members (tenant_id, user_id, role, estado)
  values (new_tenant_id, auth.uid(), 'admin_cliente', 'activo')
  on conflict (tenant_id, user_id) do update
  set role = 'admin_cliente',
      estado = 'activo',
      updated_at = now();

  perform public.log_audit(
    new_tenant_id,
    'create_tenant',
    'tenant',
    new_tenant_id,
    jsonb_build_object('nombre', trim(tenant_name), 'email', nullif(trim(tenant_email), ''))
  );

  return new_tenant_id;
end;
$$;

-- 008_installation_access_grants.sql
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

-- 009_security_hardening.sql
alter function public.set_updated_at() set search_path = public;
alter function public.secure_token(int) set search_path = public;
alter function public.storage_tenant_id(text) set search_path = public;
alter function public.storage_bucket_is_private(text) set search_path = public;

revoke execute on all functions in schema public from public;

grant execute on all functions in schema public to authenticated;

drop policy if exists instalaciones_select on public.instalaciones;
create policy instalaciones_select on public.instalaciones
for select using (
  deleted_at is null
  and (
    public.has_tenant_access(tenant_id)
    or public.has_installation_permission(tenant_id, id, 'view')
  )
);

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;

-- 018_tenant_billing_guard.sql
create or replace function public.prevent_tenant_billing_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if new.plan is distinct from old.plan
    or new.billing_status is distinct from old.billing_status
    or new.max_instalaciones is distinct from old.max_instalaciones
    or new.max_activos is distinct from old.max_activos
    or new.max_storage_mb is distinct from old.max_storage_mb
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.subscription_ends_at is distinct from old.subscription_ends_at
  then
    raise exception 'solo super_admin puede modificar plan, suscripcion o limites del cliente';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tenants_billing_guard on public.tenants;
create trigger trg_tenants_billing_guard
before update on public.tenants
for each row execute function public.prevent_tenant_billing_changes();

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;

-- 017_saas_tenant_model.sql
alter table public.tenants
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists plan text not null default 'starter',
  add column if not exists billing_status text not null default 'trial',
  add column if not exists max_instalaciones int not null default 5,
  add column if not exists max_activos int not null default 100,
  add column if not exists max_storage_mb int not null default 1024,
  add column if not exists trial_ends_at timestamptz default (now() + interval '14 days'),
  add column if not exists subscription_ends_at timestamptz;

alter table public.tenants
  drop constraint if exists tenants_plan_check,
  add constraint tenants_plan_check check (plan in ('starter', 'pro', 'empresa'));

alter table public.tenants
  drop constraint if exists tenants_billing_status_check,
  add constraint tenants_billing_status_check check (billing_status in ('trial', 'active', 'past_due', 'cancelled', 'suspended'));

update public.tenants t
set owner_user_id = tm.user_id
from public.tenant_members tm
where t.owner_user_id is null
  and tm.tenant_id = t.id
  and tm.role = 'admin_cliente'
  and tm.estado = 'activo';

create or replace function public.create_tenant_as_owner(
  tenant_name text,
  tenant_cif text default null,
  tenant_direccion text default null,
  tenant_telefono text default null,
  tenant_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if nullif(trim(tenant_name), '') is null then
    raise exception 'tenant name is required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  insert into public.profiles (id, email, global_role)
  values (auth.uid(), current_email, 'usuario')
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.tenants (
    nombre,
    cif,
    direccion,
    telefono,
    email,
    owner_user_id,
    plan,
    billing_status,
    max_instalaciones,
    max_activos,
    max_storage_mb,
    trial_ends_at
  )
  values (
    trim(tenant_name),
    nullif(trim(tenant_cif), ''),
    nullif(trim(tenant_direccion), ''),
    nullif(trim(tenant_telefono), ''),
    nullif(trim(tenant_email), ''),
    auth.uid(),
    'starter',
    'trial',
    5,
    100,
    1024,
    now() + interval '14 days'
  )
  returning id into new_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role, estado)
  values (new_tenant_id, auth.uid(), 'admin_cliente', 'activo')
  on conflict (tenant_id, user_id) do update
  set role = 'admin_cliente',
      estado = 'activo',
      updated_at = now();

  perform public.log_audit(
    new_tenant_id,
    'create_tenant',
    'tenant',
    new_tenant_id,
    jsonb_build_object(
      'nombre',
      trim(tenant_name),
      'email',
      nullif(trim(tenant_email), ''),
      'plan',
      'starter',
      'billing_status',
      'trial'
    )
  );

  return new_tenant_id;
end;
$$;

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on all functions in schema public to authenticated;

-- 010_external_technician_role.sql
alter table public.tenant_members
  drop constraint if exists tenant_members_role_check;

alter table public.tenant_members
  add constraint tenant_members_role_check
  check (role in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'));

alter table public.tenant_invitations
  drop constraint if exists tenant_invitations_role_check;

alter table public.tenant_invitations
  add constraint tenant_invitations_role_check
  check (role in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'));

create or replace function public.has_tenant_access(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = tenant_uuid
        and user_id = auth.uid()
        and role in ('admin_cliente', 'tecnico', 'cliente_lectura')
        and estado = 'activo'
    );
$$;

create or replace function public.create_tenant_invitation(
  tenant_uuid uuid,
  invite_email text,
  invite_role text,
  require_mfa boolean default false
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  inserted_id uuid;
  inserted_expires_at timestamptz;
begin
  if not public.can_manage_tenant(tenant_uuid) then
    raise exception 'permission denied';
  end if;

  if invite_role not in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura') then
    raise exception 'invalid role';
  end if;

  raw_token := public.secure_token(32);

  insert into public.tenant_invitations (
    tenant_id,
    email,
    role,
    token_hash,
    mfa_required,
    invited_by
  )
  values (
    tenant_uuid,
    lower(trim(invite_email)),
    invite_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    coalesce(require_mfa, false),
    auth.uid()
  )
  returning id, expires_at into inserted_id, inserted_expires_at;

  perform public.log_audit(
    tenant_uuid,
    'create_invitation',
    'tenant_invitation',
    inserted_id,
    jsonb_build_object('email', lower(trim(invite_email)), 'role', invite_role, 'mfa_required', coalesce(require_mfa, false))
  );

  return query select inserted_id, raw_token, inserted_expires_at;
end;
$$;

grant execute on all functions in schema public to authenticated;

-- 011_installation_maps_and_invitation_name.sql
create or replace function public.secure_token(token_length int default 24)
returns text
language sql
stable
set search_path = public
as $$
  select lower(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, greatest(8, least(token_length, 96))));
$$;

alter table public.tenant_invitations
  add column if not exists nombre text;

alter table public.instalaciones
  add column if not exists latitud numeric(10, 7),
  add column if not exists longitud numeric(10, 7),
  add column if not exists maps_url text;

drop function if exists public.create_tenant_invitation(uuid, text, text, boolean);

create or replace function public.create_tenant_invitation(
  tenant_uuid uuid,
  invite_email text,
  invite_role text,
  require_mfa boolean default false,
  invite_name text default null
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
  inserted_id uuid;
  inserted_expires_at timestamptz;
begin
  if not public.can_manage_tenant(tenant_uuid) then
    raise exception 'permission denied';
  end if;

  if invite_role not in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura') then
    raise exception 'invalid role';
  end if;

  raw_token := public.secure_token(32);

  insert into public.tenant_invitations (
    tenant_id,
    nombre,
    email,
    role,
    token_hash,
    mfa_required,
    invited_by
  )
  values (
    tenant_uuid,
    nullif(trim(invite_name), ''),
    lower(trim(invite_email)),
    invite_role,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    coalesce(require_mfa, false),
    auth.uid()
  )
  returning tenant_invitations.id, tenant_invitations.expires_at into inserted_id, inserted_expires_at;

  perform public.log_audit(
    tenant_uuid,
    'create_invitation',
    'tenant_invitation',
    inserted_id,
    jsonb_build_object('email', lower(trim(invite_email)), 'nombre', nullif(trim(invite_name), ''), 'role', invite_role, 'mfa_required', coalesce(require_mfa, false))
  );

  return query select inserted_id, raw_token, inserted_expires_at;
end;
$$;

create or replace function public.accept_tenant_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invitation public.tenant_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
  into invitation
  from public.tenant_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and estado = 'pendiente'
    and expires_at > now()
  limit 1;

  if invitation.id is null then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(invitation.email) <> current_email then
    raise exception 'invitation email does not match current user';
  end if;

  insert into public.profiles (id, nombre, email, global_role, mfa_required)
  values (auth.uid(), invitation.nombre, current_email, 'usuario', invitation.mfa_required)
  on conflict (id) do update
  set email = excluded.email,
      nombre = coalesce(public.profiles.nombre, excluded.nombre),
      mfa_required = public.profiles.mfa_required or excluded.mfa_required,
      updated_at = now();

  insert into public.tenant_members (tenant_id, user_id, role, estado)
  values (invitation.tenant_id, auth.uid(), invitation.role, 'activo')
  on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      estado = 'activo',
      updated_at = now();

  update public.tenant_invitations
  set estado = 'aceptada',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = invitation.id;

  perform public.log_audit(
    invitation.tenant_id,
    'accept_invitation',
    'tenant_invitation',
    invitation.id,
    jsonb_build_object('email', current_email, 'nombre', invitation.nombre, 'role', invitation.role)
  );

  return invitation.tenant_id;
end;
$$;

grant execute on all functions in schema public to authenticated;

-- 012_sync_qr_registry.sql
insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
select tenant_id, qr_token, 'instalacion', id, created_by
from public.instalaciones
where deleted_at is null
on conflict (token) do update
set tenant_id = excluded.tenant_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id;

insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
select tenant_id, qr_token, 'ubicacion', id, created_by
from public.ubicaciones
where deleted_at is null
on conflict (token) do update
set tenant_id = excluded.tenant_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id;

insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
select tenant_id, qr_token, 'activo', id, created_by
from public.activos
where deleted_at is null
on conflict (token) do update
set tenant_id = excluded.tenant_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id;

-- 013_document_insert_policy_fix.sql
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

-- 014_role_security_hardening.sql
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

