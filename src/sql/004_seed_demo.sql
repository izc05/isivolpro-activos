do $$
declare
  tenant_id uuid := gen_random_uuid();
  instalacion_id uuid := gen_random_uuid();
  ubicacion_id uuid := gen_random_uuid();
  activo_cuadro_id uuid := gen_random_uuid();
  activo_bomba_id uuid := gen_random_uuid();
  activo_grupo_id uuid := gen_random_uuid();
begin
  insert into public.tenants (id, nombre, cif, direccion, telefono, email)
  values (
    tenant_id,
    'Comunidad Los Olivos',
    'H00000000',
    'Calle Los Olivos 12',
    '+34 600 000 000',
    'administracion@losolivos.example'
  );

  insert into public.instalaciones (id, tenant_id, nombre, codigo, tipo, direccion, descripcion)
  values (
    instalacion_id,
    tenant_id,
    'Garaje Comunidad Los Olivos',
    'OLIVOS-GAR-001',
    'Garaje comunitario',
    'Calle Los Olivos 12, Planta -1',
    'Instalacion demo para documentacion tecnica por QR.'
  );

  insert into public.ubicaciones (id, tenant_id, instalacion_id, nombre, tipo, planta, zona, descripcion)
  values (
    ubicacion_id,
    tenant_id,
    instalacion_id,
    'Cuarto electrico',
    'Sala tecnica',
    '-1',
    'Acceso garaje',
    'Cuarto tecnico principal del garaje.'
  );

  insert into public.activos (
    id, tenant_id, instalacion_id, ubicacion_id, nombre, tipo, marca, modelo,
    numero_serie, estado, criticidad, fecha_instalacion, fecha_ultima_revision,
    fecha_proxima_revision, observaciones
  )
  values
    (activo_cuadro_id, tenant_id, instalacion_id, ubicacion_id, 'Cuadro general garaje', 'Cuadro electrico', 'Demo', 'CG-400', 'DEMO-CG-001', 'correcto', 'alta', current_date - 1200, current_date - 40, current_date + 325, 'Protecciones revisadas en ultima visita.'),
    (activo_bomba_id, tenant_id, instalacion_id, ubicacion_id, 'Bomba achique garaje', 'Bomba de agua', 'DemoPump', 'A-120', 'DEMO-BA-002', 'pendiente', 'critica', current_date - 950, current_date - 190, current_date + 15, 'Pendiente de revision preventiva.'),
    (activo_grupo_id, tenant_id, instalacion_id, ubicacion_id, 'Grupo presion agua', 'Grupo de presion', 'DemoPress', 'GP-220', 'DEMO-GP-003', 'correcto', 'media', current_date - 800, current_date - 60, current_date + 120, 'Funcionamiento normal.');

  insert into public.documentos (tenant_id, instalacion_id, ubicacion_id, activo_id, tipo, titulo, descripcion, bucket, storage_path, file_name, mime_type, size_bytes, visibilidad)
  values
    (tenant_id, instalacion_id, ubicacion_id, activo_cuadro_id, 'Esquema unifilar', 'Esquema unifilar cuadro garaje', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_cuadro_id || '/documentos/esquema-unifilar-demo.pdf', 'esquema-unifilar-demo.pdf', 'application/pdf', 0, 'tecnico'),
    (tenant_id, instalacion_id, ubicacion_id, activo_bomba_id, 'Manual', 'Manual bomba achique', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_bomba_id || '/documentos/manual-bomba-demo.pdf', 'manual-bomba-demo.pdf', 'application/pdf', 0, 'cliente'),
    (tenant_id, instalacion_id, null, null, 'OCA', 'Informe OCA instalacion garaje', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/instalaciones/' || instalacion_id || '/documentos/oca-demo.pdf', 'oca-demo.pdf', 'application/pdf', 0, 'privado');

  insert into public.historial_mantenimiento (tenant_id, activo_id, fecha, tipo, titulo, descripcion, estado_final, proxima_accion)
  values
    (tenant_id, activo_cuadro_id, current_date - 40, 'revision', 'Revision anual cuadro general', 'Comprobacion visual y reapriete de bornes.', 'Correcto', 'Nueva revision anual.'),
    (tenant_id, activo_bomba_id, current_date - 190, 'preventivo', 'Prueba de funcionamiento bomba', 'Arranque correcto, se recomienda limpieza de boya.', 'Pendiente limpieza', 'Limpiar boya en proxima visita.');

  insert into public.incidencias (tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, prioridad, estado)
  values
    (tenant_id, instalacion_id, ubicacion_id, activo_bomba_id, 'Revision preventiva proxima', 'Programar revision de bomba de achique antes de la temporada de lluvias.', 'alta', 'abierta');

  insert into public.videos (tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, tipo, external_url, visibilidad)
  values
    (tenant_id, instalacion_id, ubicacion_id, activo_bomba_id, 'Como parar bomba en emergencia', 'Video externo demo para procedimiento de emergencia.', 'url', 'https://example.com/video-demo', 'cliente');
end $$;
