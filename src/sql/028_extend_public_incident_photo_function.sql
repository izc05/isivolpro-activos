-- IsiVoltPro Activos QR
-- Extiende submit_public_incident para aceptar una foto opcional codificada como data_url.

create or replace function public.submit_public_incident(
  qr_token_text text,
  reporter_name text,
  reporter_contact text,
  report_title text,
  report_description text,
  report_priority text default 'media',
  browser_fingerprint text default null,
  photo_data_url text default null,
  photo_file_name text default null,
  photo_mime_type text default null,
  photo_size_bytes integer default null,
  photo_comment text default null
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
  if nullif(trim(qr_token_text), '') is null then raise exception 'QR no valido'; end if;
  if nullif(trim(reporter_name), '') is null or length(trim(reporter_name)) > 120 then raise exception 'Nombre obligatorio'; end if;
  if nullif(trim(reporter_contact), '') is null or length(trim(reporter_contact)) > 160 then raise exception 'Contacto obligatorio'; end if;
  if nullif(trim(report_title), '') is null or length(trim(report_title)) > 160 then raise exception 'Titulo obligatorio'; end if;
  if nullif(trim(report_description), '') is null or length(trim(report_description)) > 1200 then raise exception 'Descripcion obligatoria'; end if;
  if coalesce(report_priority, 'media') not in ('baja', 'media', 'alta', 'urgente', 'critica') then raise exception 'Prioridad no valida'; end if;

  if photo_data_url is not null then
    if photo_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Tipo de foto no permitido'; end if;
    if coalesce(photo_size_bytes, 0) <= 0 or photo_size_bytes > 2097152 then raise exception 'La foto supera el tamano permitido'; end if;
    if length(photo_data_url) > 3000000 then raise exception 'La foto es demasiado grande'; end if;
    if position('data:image/' in photo_data_url) <> 1 then raise exception 'Formato de foto no valido'; end if;
  end if;

  select * into qr_row
  from public.qr_registry
  where token = trim(qr_token_text)
    and estado = 'activo'
    and entity_type in ('instalacion', 'ubicacion', 'activo')
  limit 1;

  if qr_row.id is null then raise exception 'QR no valido o revocado'; end if;

  if qr_row.entity_type = 'instalacion' then
    resolved_installation_id := qr_row.entity_id;
  elsif qr_row.entity_type = 'ubicacion' then
    resolved_location_id := qr_row.entity_id;
    select instalacion_id into resolved_installation_id from public.ubicaciones where id = resolved_location_id and deleted_at is null;
  elsif qr_row.entity_type = 'activo' then
    resolved_asset_id := qr_row.entity_id;
    select instalacion_id, ubicacion_id into resolved_installation_id, resolved_location_id from public.activos where id = resolved_asset_id and deleted_at is null;
  end if;

  if resolved_installation_id is null then raise exception 'El QR no esta asociado a una instalacion activa'; end if;

  contact_hash := encode(digest(lower(trim(qr_token_text)) || ':' || lower(trim(reporter_contact)) || ':' || coalesce(browser_fingerprint, ''), 'sha256'), 'hex');

  if exists (
    select 1 from public.external_incident_reports r
    where r.qr_token = trim(qr_token_text)
      and r.reporter_hash = contact_hash
      and r.created_at > now() - interval '1 hour'
  ) then
    raise exception 'Ya se ha enviado un aviso reciente para este QR. Espera antes de volver a enviar.';
  end if;

  insert into public.incidencias (
    tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, prioridad, estado, notas_revision
  ) values (
    qr_row.tenant_id,
    resolved_installation_id,
    resolved_location_id,
    resolved_asset_id,
    trim(report_title),
    'Aviso externo recibido por QR. ' || trim(report_description),
    coalesce(report_priority, 'media'),
    'abierta',
    'Origen: aviso publico por QR. Contacto: ' || trim(reporter_name) || ' - ' || trim(reporter_contact)
  ) returning id into new_incident_id;

  insert into public.external_incident_reports (
    tenant_id, qr_token, entity_type, entity_id, instalacion_id, ubicacion_id, activo_id,
    reporter_name, reporter_contact, reporter_hash, title, description, priority, incidencia_id, user_agent
  ) values (
    qr_row.tenant_id, trim(qr_token_text), qr_row.entity_type, qr_row.entity_id,
    resolved_installation_id, resolved_location_id, resolved_asset_id,
    trim(reporter_name), trim(reporter_contact), contact_hash, trim(report_title), trim(report_description),
    coalesce(report_priority, 'media'), new_incident_id, left(coalesce(browser_fingerprint, ''), 500)
  ) returning id into new_report_id;

  if photo_data_url is not null then
    insert into public.incident_photos (
      tenant_id, incidencia_id, source, tipo_foto, file_name, mime_type, size_bytes, data_url, comentario, created_by
    ) values (
      qr_row.tenant_id, new_incident_id, 'public_qr', 'problema', left(coalesce(photo_file_name, 'foto-incidencia'), 180),
      photo_mime_type, photo_size_bytes, photo_data_url, nullif(trim(coalesce(photo_comment, '')), ''), null
    );
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (
    qr_row.tenant_id,
    null,
    'external_incident_report',
    'incidencia',
    new_incident_id,
    jsonb_build_object('report_id', new_report_id, 'qr_token_suffix', right(trim(qr_token_text), 6), 'has_photo', photo_data_url is not null)
  );

  return query select new_report_id, new_incident_id, true;
end;
$$;

grant execute on function public.submit_public_incident(text, text, text, text, text, text, text, text, text, text, integer, text) to anon, authenticated;
