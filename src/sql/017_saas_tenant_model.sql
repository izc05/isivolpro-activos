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
