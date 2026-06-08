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
