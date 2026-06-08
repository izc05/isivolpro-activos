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
