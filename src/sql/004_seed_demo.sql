do $$
declare
  tenant_id uuid := gen_random_uuid();
  instalacion_garaje_id uuid := gen_random_uuid();
  instalacion_clinica_id uuid := gen_random_uuid();
  instalacion_residencia_id uuid := gen_random_uuid();
  ubicacion_cuarto_id uuid := gen_random_uuid();
  ubicacion_pci_id uuid := gen_random_uuid();
  ubicacion_acs_id uuid := gen_random_uuid();
  activo_cuadro_id uuid := gen_random_uuid();
  activo_bomba_id uuid := gen_random_uuid();
  activo_grupo_id uuid := gen_random_uuid();
  activo_pci_id uuid := gen_random_uuid();
  activo_bt_id uuid := gen_random_uuid();
  activo_acs_id uuid := gen_random_uuid();
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
  values
    (
      instalacion_garaje_id,
      tenant_id,
      'Garaje Comunidad Los Olivos',
      'OLIVOS-GAR-001',
      'Garaje comunitario',
      'Calle Los Olivos 12, Planta -1',
      'Instalacion demo para documentacion tecnica por QR.'
    ),
    (
      instalacion_clinica_id,
      tenant_id,
      'Clinica San Rafael Demo',
      'CSR-DEMO-001',
      'Centro sanitario',
      'Avenida San Rafael 8',
      'Instalacion demo con activos criticos de PCI y baja tension.'
    ),
    (
      instalacion_residencia_id,
      tenant_id,
      'Residencia Virgen del Carmen Demo',
      'RVC-DEMO-001',
      'Residencia',
      'Calle Virgen del Carmen 21',
      'Instalacion demo orientada a produccion de ACS y mantenimiento preventivo.'
    );

  insert into public.ubicaciones (id, tenant_id, instalacion_id, nombre, tipo, planta, zona, descripcion)
  values
    (
      ubicacion_cuarto_id,
      tenant_id,
      instalacion_garaje_id,
      'Cuarto electrico',
      'Sala tecnica',
      '-1',
      'Acceso garaje',
      'Cuarto tecnico principal del garaje.'
    ),
    (
      ubicacion_pci_id,
      tenant_id,
      instalacion_clinica_id,
      'Sala PCI',
      'Sala tecnica',
      '0',
      'Zona servicios',
      'Sala de bombas y control del sistema PCI.'
    ),
    (
      ubicacion_acs_id,
      tenant_id,
      instalacion_residencia_id,
      'Sala de produccion ACS',
      'Sala tecnica',
      '-1',
      'Servicios generales',
      'Produccion de agua caliente sanitaria y acumulacion.'
    );

  insert into public.activos (
    id, tenant_id, instalacion_id, ubicacion_id, nombre, tipo, marca, modelo,
    numero_serie, estado, criticidad, fecha_instalacion, fecha_ultima_revision,
    fecha_proxima_revision, observaciones
  )
  values
    (activo_cuadro_id, tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, 'Cuadro general garaje', 'Cuadro electrico', 'Demo', 'CG-400', 'DEMO-CG-001', 'correcto', 'alta', current_date - 1200, current_date - 40, current_date + 325, 'Protecciones revisadas en ultima visita.'),
    (activo_bomba_id, tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, 'Bomba achique garaje', 'Bomba de agua', 'DemoPump', 'A-120', 'DEMO-BA-002', 'pendiente', 'critica', current_date - 950, current_date - 190, current_date + 15, 'Pendiente de revision preventiva.'),
    (activo_grupo_id, tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, 'Grupo presion agua', 'Grupo de presion', 'DemoPress', 'GP-220', 'DEMO-GP-003', 'correcto', 'media', current_date - 800, current_date - 60, current_date + 120, 'Funcionamiento normal.'),
    (activo_pci_id, tenant_id, instalacion_clinica_id, ubicacion_pci_id, 'Bomba PCI demo', 'Bomba contra incendios', 'DemoFire', 'PCI-90', 'DEMO-PCI-004', 'correcto', 'critica', current_date - 1450, current_date - 25, current_date + 65, 'Equipo critico con pruebas de arranque documentadas.'),
    (activo_bt_id, tenant_id, instalacion_clinica_id, ubicacion_pci_id, 'Cuadro general BT demo', 'Cuadro electrico', 'Demo', 'BT-800', 'DEMO-BT-005', 'correcto', 'alta', current_date - 1700, current_date - 80, current_date + 285, 'Cuadro principal de servicios generales.'),
    (activo_acs_id, tenant_id, instalacion_residencia_id, ubicacion_acs_id, 'Produccion ACS demo', 'Produccion ACS', 'DemoTherm', 'ACS-500', 'DEMO-ACS-006', 'pendiente', 'alta', current_date - 980, current_date - 120, current_date + 20, 'Revisar valvulas, acumulacion y lectura de temperaturas.');

  insert into public.documentos (tenant_id, instalacion_id, ubicacion_id, activo_id, tipo, titulo, descripcion, bucket, storage_path, file_name, mime_type, size_bytes, visibilidad)
  values
    (tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, activo_cuadro_id, 'Esquema unifilar', 'Esquema unifilar cuadro garaje', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_cuadro_id || '/documentos/esquema-unifilar-demo.pdf', 'esquema-unifilar-demo.pdf', 'application/pdf', 0, 'tecnico'),
    (tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, activo_bomba_id, 'Manual', 'Manual bomba achique', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_bomba_id || '/documentos/manual-bomba-demo.pdf', 'manual-bomba-demo.pdf', 'application/pdf', 0, 'cliente'),
    (tenant_id, instalacion_garaje_id, null, null, 'OCA', 'Informe OCA instalacion garaje', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/instalaciones/' || instalacion_garaje_id || '/documentos/oca-demo.pdf', 'oca-demo.pdf', 'application/pdf', 0, 'privado'),
    (tenant_id, instalacion_clinica_id, ubicacion_pci_id, activo_pci_id, 'Procedimiento', 'Prueba mensual bomba PCI', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_pci_id || '/documentos/procedimiento-bomba-pci-demo.pdf', 'procedimiento-bomba-pci-demo.pdf', 'application/pdf', 0, 'tecnico'),
    (tenant_id, instalacion_residencia_id, ubicacion_acs_id, activo_acs_id, 'Checklist', 'Checklist control ACS', 'Metadato demo, sin archivo real.', 'documents-private', tenant_id || '/activos/' || activo_acs_id || '/documentos/checklist-acs-demo.pdf', 'checklist-acs-demo.pdf', 'application/pdf', 0, 'tecnico');

  insert into public.historial_mantenimiento (tenant_id, activo_id, fecha, tipo, titulo, descripcion, estado_final, proxima_accion)
  values
    (tenant_id, activo_cuadro_id, current_date - 40, 'revision', 'Revision anual cuadro general', 'Comprobacion visual y reapriete de bornes.', 'Correcto', 'Nueva revision anual.'),
    (tenant_id, activo_bomba_id, current_date - 190, 'preventivo', 'Prueba de funcionamiento bomba', 'Arranque correcto, se recomienda limpieza de boya.', 'Pendiente limpieza', 'Limpiar boya en proxima visita.'),
    (tenant_id, activo_pci_id, current_date - 25, 'revision', 'Prueba arranque bomba PCI', 'Arranque manual y automatico correctos.', 'Correcto', 'Repetir prueba mensual.'),
    (tenant_id, activo_acs_id, current_date - 120, 'preventivo', 'Revision circuito ACS', 'Lectura de temperaturas y purga de acumulador.', 'Pendiente ajuste', 'Revisar valvula mezcladora.');

  insert into public.incidencias (tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, prioridad, estado)
  values
    (tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, activo_bomba_id, 'Revision preventiva proxima', 'Programar revision de bomba de achique antes de la temporada de lluvias.', 'alta', 'abierta'),
    (tenant_id, instalacion_residencia_id, ubicacion_acs_id, activo_acs_id, 'Temperatura ACS irregular', 'El responsable indica oscilaciones de temperatura en horas punta.', 'urgente', 'en_proceso');

  insert into public.videos (tenant_id, instalacion_id, ubicacion_id, activo_id, titulo, descripcion, tipo, external_url, visibilidad)
  values
    (tenant_id, instalacion_garaje_id, ubicacion_cuarto_id, activo_bomba_id, 'Como parar bomba en emergencia', 'Video externo demo para procedimiento de emergencia.', 'url', 'https://example.com/video-demo', 'cliente'),
    (tenant_id, instalacion_clinica_id, ubicacion_pci_id, activo_pci_id, 'Prueba guiada de bomba PCI', 'Video externo demo para explicar la prueba mensual.', 'url', 'https://example.com/video-pci-demo', 'tecnico');
end $$;
