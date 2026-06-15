-- IsiVoltPro - Gestion segura de usuarios desde la app
-- Ejecutar en Supabase SQL Editor despues de 022_soft_delete_work_orders.sql.
-- Permite desactivar/reactivar tecnicos desde Usuarios y permisos sin borrar auth.users.

create or replace function public.set_tenant_member_status(member_uuid uuid, status_text text)
returns public.tenant_members
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.tenant_members%rowtype;
  active_admins integer;
begin
  if status_text not in ('activo', 'inactivo') then
    raise exception 'estado no valido';
  end if;

  select *
  into member_row
  from public.tenant_members
  where id = member_uuid
  limit 1;

  if member_row.id is null then
    raise exception 'usuario no encontrado';
  end if;

  if not public.can_manage_tenant(member_row.tenant_id) then
    raise exception 'no tienes permisos para gestionar usuarios';
  end if;

  if member_row.user_id = auth.uid() and status_text = 'inactivo' then
    raise exception 'no puedes desactivar tu propio usuario administrador';
  end if;

  if member_row.role = 'admin_cliente' and status_text = 'inactivo' then
    select count(*)
    into active_admins
    from public.tenant_members
    where tenant_id = member_row.tenant_id
      and role = 'admin_cliente'
      and estado = 'activo'
      and id <> member_row.id;

    if active_admins = 0 then
      raise exception 'debe quedar al menos un administrador activo';
    end if;
  end if;

  update public.tenant_members
  set estado = status_text,
      updated_at = now()
  where id = member_row.id
  returning * into member_row;

  if status_text = 'inactivo' then
    update public.installation_access_grants
    set estado = 'revocado',
        revoked_at = coalesce(revoked_at, now()),
        updated_at = now()
    where tenant_id = member_row.tenant_id
      and user_id = member_row.user_id
      and estado = 'activo';
  end if;

  perform public.log_audit(
    member_row.tenant_id,
    case when status_text = 'activo' then 'activate_member' else 'deactivate_member' end,
    'tenant_member',
    member_row.id,
    jsonb_build_object('user_id', member_row.user_id, 'role', member_row.role, 'estado', member_row.estado)
  );

  return member_row;
end;
$$;
