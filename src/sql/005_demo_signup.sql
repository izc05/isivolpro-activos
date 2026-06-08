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
