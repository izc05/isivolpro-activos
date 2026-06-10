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
  owner_user_id uuid,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'empresa')),
  billing_status text not null default 'trial' check (billing_status in ('trial', 'active', 'past_due', 'cancelled', 'suspended')),
  max_instalaciones int not null default 5,
  max_activos int not null default 100,
  max_storage_mb int not null default 1024,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  subscription_ends_at timestamptz,
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
