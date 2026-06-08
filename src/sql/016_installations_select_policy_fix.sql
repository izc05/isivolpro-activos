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
