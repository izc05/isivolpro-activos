export const FV_MASTER_CATALOGS = [
  {
    title: 'Tipos de instalación FV',
    description: 'Valores recomendados para instalaciones fotovoltaicas y autoconsumo.',
    values: ['fotovoltaica', 'autoconsumo', 'fotovoltaica_cubierta', 'fotovoltaica_marquesina', 'fotovoltaica_suelo', 'vertido_cero']
  },
  {
    title: 'Ubicaciones FV',
    description: 'Zonas habituales en instalaciones FV.',
    values: ['cubierta_modulos_fv', 'sala_inversores', 'cuadro_dc', 'cuadro_ac', 'contador_bidireccional', 'seccionador_bomberos', 'marquesina_parking']
  },
  {
    title: 'Activos FV',
    description: 'Tipos de equipos para inventario FV.',
    values: ['campo_fotovoltaico', 'inversor_fotovoltaico', 'cuadro_dc_fv', 'cuadro_ac_fv', 'contador_fv', 'seccionador_emergencia_fv', 'sistema_monitorizacion_fv']
  },
  {
    title: 'Plantillas OT FV',
    description: 'Trabajos repetibles para OT y preventivos.',
    values: ['revision_inversor_fv', 'revision_cuadro_dc_fv', 'medicion_strings_fv', 'aislamiento_dc_fv', 'revision_cuadro_ac_fv', 'contador_vertido_cero', 'limpieza_modulos_fv', 'seccionador_emergencia_bomberos']
  },
  {
    title: 'Materiales FV',
    description: 'Materiales habituales para registrar en intervención.',
    values: ['spd_dc_tipo_ii_1000v', 'fusible_gpv', 'portafusible_dc', 'conector_mc4', 'seccionador_dc', 'magnetotermico_ac', 'diferencial_tipo_a', 'contador_bidireccional', 'etiqueta_riesgo_dc']
  },
  {
    title: 'Requisitos de cierre FV',
    description: 'Bloques recomendados para cerrar una OT FV profesional.',
    values: ['checklist_obligatorio', 'fotos_finales', 'mediciones', 'firma_tecnico', 'informe_pdf', 'revision_admin', 'qr_activo', 'materiales_si_aplica']
  }
];

export function flattenCatalogs(catalogs = FV_MASTER_CATALOGS) {
  return catalogs.flatMap((catalog) => catalog.values.map((value) => ({ catalog: catalog.title, value })));
}

export function catalogText(catalog = {}) {
  return [catalog.title, catalog.description, ...(catalog.values || [])].join(' ').toLowerCase();
}
