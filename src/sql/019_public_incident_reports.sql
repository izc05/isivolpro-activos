create extension if not exists pgcrypto;

create table if not exists public.external_incident_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  qr_token text not null,
  entity_type text not null check (entity_type in ('instalacion', 'ubicacion', 'activo')),
  entity_id uuid not null,
  instalacion_id uuid not null references public.instalaciones(id) on delete cascade,
  ubicacion_id uuid references public.ubicaciones(id) on delete set null,
  activo_id uuid references public.activos(id) on delete set null,
  reporter_name text not null,
  reporter_contact text not null,
  reporter_hash text not null,
  title text not null,
  description text not null,
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente', 'critica')),
  status text not null default 'accepted' check (status in ('accepted', 'duplicate_blocked', 'reviewed', 'rejected')),
  incidencia_id uuid references public.incidencias(id) on delete set null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists external_incident_reports_tenant_idx
  on public.external_incident_reports (tenant_id, created_at desc);

create index if not exists external_incident_reports_rate_idx
  on public.external_incident_reports (qr_token, reporter_hash, created_at desc);

alter table public.external_incident_reports enable row level security;

drop policy if exists external_incident_reports_select on public.external_incident_reports;
create policy external_incident_reports_select on public.external_incident_reports
for select using (
  public.can_manage_tenant(tenant_id)
  or public.has_tenant_role(tenant_id, 'tecnico')
);

drop policy if exists external_incident_reports_update on public.external_incident_reports;
create policy external_incident_reports_update on public.external_incident_reports
for update using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

create or replace function public.public_qr_context(qr_token_text text)
returns table (
  entity_type text,
  installation_name text,
  location_name text,
  asset_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with qr as (
    select *
    from public.qr_registry
    where token = qr_token_text
      and estado = 'activo'
      and entity_type in ('instalacion', 'ubicacion', 'activo')
    limit 1
  ),
  resolved as (
    select
      qr.entity_type,
      case
        when qr.entity_type = 'instalacion' then qr.entity_id
        when qr.entity_type = 'ubicacion' then u.instalacion_id
        when qr.entity_type = 'activo' then a.instalacion_id
      end as instalacion_id,
      case
        when qr.entity_type = 'ubicacion' then qr.entity_id
        when qr.entity_type = 'activo' then a.ubicacion_id
      end as ubicacion_id,
      case when qr.entity_type = 'activo' then qr.entity_id end as activo_id
    from qr
    left join public.ubicaciones u on u.id = qr.entity_id and u.deleted_at is null
    left join public.activos a on a.id = qr.entity_id and a.deleted_at is null
  )
  select
    r.entity_type,
    i.nombre as installation_name,
    u.nombre as location_name,
    a.nombre as asset_name
  from resolved r
  join public.instalaciones i on i.id = r.instalacion_id and i.deleted_at is null
  left join public.ubicaciones u on u.id = r.ubicacion_id and u.deleted_at is null
  left join public.activos a on a.id = r.activo_id and a.deleted_at is null;
$$;

create or replace function public.submit_public_incident(
  qr_token_text text,
  reporter_name text,
  reporter_contact text,
  report_title text,
  report_description text,
  report_priority text default 'media',
  browser_fingerprint text default null
)
returns table (
  report_id uuid,
  incidencia_id uuid,
  accepted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  qr_row record;
  resolved_installation_id uuid;
  resolved_location_id uuid;
  resolved_asset_id uuid;
  contact_hash text;
  new_incident_id uuid;
  new_report_id uuid;
begin
  if nullif(trim(qr_token_text), '') is null then
    raise exception 'QR no valido';
  end if;
  if nullif(trim(reporter_name), '') is null or length(trim(reporter_name)) > 120 then
    raise exception 'Nombre obligatorio';
  end if;
  if nullif(trim(reporter_contact), '') is null or length(trim(reporter_contact)) > 160 then
    raise exception 'Contacto obligatorio';
  end if;
  if nullif(trim(report_title), '') is null or length(trim(report_title)) > 160 then
    raise exception 'Titulo obligatorio';
  end if;
  if nullif(trim(report_description), '') is null or length(trim(report_description)) > 1200 then
    raise exception 'Descripcion obligatoria';
  end if;
  if coalesce(report_priority, 'media') not in ('baja', 'media', 'alta', 'urgente', 'critica') then
    raise exception 'Prioridad no valida';
  end if;

  select *
  into qr_row
  from public.qr_registry
  where token = trim(qr_token_text)
    and estado = 'activo'
    and entity_type in ('instalacion', 'ubicacion', 'activo')
  limit 1;

  if qr_row.id is null then
    raise exception 'QR no valido o revocado';
  end if;

  if qr_row.entity_type = 'instalacion' then
    resolved_installation_id := qr_row.entity_id;
  elsif qr_row.entity_type = 'ubicacion' then
    resolved_location_id := qr_row.entity_id;
    select instalacion_id into resolved_installation_id
    from public.ubicaciones
    where id = resolved_location_id and deleted_at is null;
  elsif qr_row.entity_type = 'activo' then
    resolved_asset_id := qr_row.entity_id;
    select instalacion_id, ubicacion_id
    into resolved_installation_id, resolved_location_id
    from public.activos
    where id = resolved_asset_id and deleted_at is null;
  end if;

  if resolved_installation_id is null then
    raise exception 'El QR no esta asociado a una instalacion activa';
  end if;

  contact_hash := encode(digest(
    lower(trim(qr_token_text)) || ':' || lower(trim(reporter_contact)) || ':' || coalesce(browser_fingerprint, ''),
    'sha256'
  ), 'hex');

  if exists (
    select 1
    from public.external_incident_reports r
    where r.qr_token = trim(qr_token_text)
      and r.reporter_hash = contact_hash
      and r.created_at > now() - interval '1 hour'
  ) then
    raise exception 'Ya se ha enviado un aviso reciente para este QR. Espera antes de volver a enviar.';
  end if;

  insert into public.incidencias (
    tenant_id,
    instalacion_id,
    ubicacion_id,
    activo_id,
    titulo,
    descripcion,
    prioridad,
    estado,
    notas_revision
  )
  values (
    qr_row.tenant_id,
    resolved_installation_id,
    resolved_location_id,
    resolved_asset_id,
    trim(report_title),
    'Aviso externo recibido por QR. ' || trim(report_description),
    coalesce(report_priority, 'media'),
    'abierta',
    'Origen: aviso publico por QR. Contacto: ' || trim(reporter_name) || ' - ' || trim(reporter_contact)
  )
  returning id into new_incident_id;

  insert into public.external_incident_reports (
    tenant_id,
    qr_token,
    entity_type,
    entity_id,
    instalacion_id,
    ubicacion_id,
    activo_id,
    reporter_name,
    reporter_contact,
    reporter_hash,
    title,
    description,
    priority,
    incidencia_id,
    user_agent
  )
  values (
    qr_row.tenant_id,
    trim(qr_token_text),
    qr_row.entity_type,
    qr_row.entity_id,
    resolved_installation_id,
    resolved_location_id,
    resolved_asset_id,
    trim(reporter_name),
    trim(reporter_contact),
    contact_hash,
    trim(report_title),
    trim(report_description),
    coalesce(report_priority, 'media'),
    new_incident_id,
    left(coalesce(browser_fingerprint, ''), 500)
  )
  returning id into new_report_id;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (
    qr_row.tenant_id,
    null,
    'external_incident_report',
    'incidencia',
    new_incident_id,
    jsonb_build_object('report_id', new_report_id, 'qr_token_suffix', right(trim(qr_token_text), 6))
  );

  return query select new_report_id, new_incident_id, true;
end;
$$;

grant execute on function public.public_qr_context(text) to anon, authenticated;
grant execute on function public.submit_public_incident(text, text, text, text, text, text, text) to anon, authenticated;

update public.incidencias
set estado = 'abierta'
where estado = 'observada';
