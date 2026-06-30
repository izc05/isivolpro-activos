-- Fase 1: reduce la superficie RPC de funciones SECURITY DEFINER.
-- Los endpoints public_qr_context y submit_public_incident se mantienen públicos
-- intencionadamente; validan el token QR y limitan los datos/operaciones expuestos.

revoke execute on function public.can_access_work_order_child(uuid, uuid, text)
  from public, anon;
revoke execute on function public.can_manage_work_orders(uuid)
  from public, anon;

revoke execute on function public.set_tenant_member_status(uuid, text)
  from public, anon;
revoke execute on function public.soft_delete_work_order(uuid)
  from public, anon;

-- Las políticas RLS y la aplicación autenticada necesitan estas funciones.
grant execute on function public.can_access_work_order_child(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.can_manage_work_orders(uuid)
  to authenticated, service_role;
grant execute on function public.set_tenant_member_status(uuid, text)
  to authenticated, service_role;
grant execute on function public.soft_delete_work_order(uuid)
  to authenticated, service_role;
