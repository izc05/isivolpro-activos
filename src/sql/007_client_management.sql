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
