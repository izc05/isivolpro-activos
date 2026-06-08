insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
select tenant_id, qr_token, 'instalacion', id, created_by
from public.instalaciones
where deleted_at is null
on conflict (token) do update
set tenant_id = excluded.tenant_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id;

insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
select tenant_id, qr_token, 'ubicacion', id, created_by
from public.ubicaciones
where deleted_at is null
on conflict (token) do update
set tenant_id = excluded.tenant_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id;

insert into public.qr_registry (tenant_id, token, entity_type, entity_id, created_by)
select tenant_id, qr_token, 'activo', id, created_by
from public.activos
where deleted_at is null
on conflict (token) do update
set tenant_id = excluded.tenant_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id;
