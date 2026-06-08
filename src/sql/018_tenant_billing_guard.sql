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
