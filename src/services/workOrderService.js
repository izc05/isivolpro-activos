import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';

export const WORK_ORDER_STATUSES = [
  'BORRADOR',
  'ASIGNADA',
  'ACEPTADA',
  'EN_CURSO',
  'PENDIENTE_MATERIAL',
  'PENDIENTE_CLIENTE',
  'FINALIZADA',
  'FIRMADA',
  'INFORME_GENERADO',
  'CERRADA',
  'CANCELADA'
];

export const WORK_ORDER_PRIORITIES = ['baja', 'media', 'alta', 'urgente'];
export const WORK_ORDER_TYPES = [
  'presupuesto',
  'visita_previa',
  'toma_datos',
  'diagnostico',
  'reparacion',
  'mantenimiento_preventivo',
  'mantenimiento_correctivo',
  'inspeccion',
  'revision',
  'instalacion',
  'montaje',
  'puesta_marcha',
  'sustitucion',
  'retirada',
  'seguimiento',
  'verificacion_funcionamiento',
  'medicion',
  'urgencia',
  'formacion',
  'otro'
];
export const WORK_ORDER_TYPE_LABELS = {
  presupuesto: 'Presupuesto',
  visita_previa: 'Visita previa',
  toma_datos: 'Toma de datos',
  diagnostico: 'Diagnostico',
  reparacion: 'Reparacion',
  mantenimiento_preventivo: 'Mantenimiento preventivo',
  mantenimiento_correctivo: 'Mantenimiento correctivo',
  inspeccion: 'Inspeccion',
  revision: 'Revision',
  instalacion: 'Instalacion',
  montaje: 'Montaje',
  puesta_marcha: 'Puesta en marcha',
  sustitucion: 'Sustitucion',
  retirada: 'Retirada',
  seguimiento: 'Seguimiento',
  verificacion_funcionamiento: 'Verificacion de funcionamiento',
  medicion: 'Medicion',
  urgencia: 'Urgencia',
  formacion: 'Formacion',
  otro: 'Otro'
};
export const VISIT_TYPES = ['diagnostico', 'reparacion', 'sustitucion', 'verificacion_funcionamiento', 'presupuesto', 'toma_datos', 'mantenimiento_preventivo', 'inspeccion', 'seguimiento', 'otro'];
export const VISIT_CLOSE_RESULTS = ['trabajo_completado', 'pendiente_material', 'pendiente_cliente', 'necesita_otra_visita', 'no_realizado'];
export const ASSET_FINAL_STATUSES = ['operativo', 'operativo_limitaciones', 'fuera_servicio', 'pendiente_reparacion', 'no_comprobado', 'no_aplica'];
export const PHOTO_TYPES = ['estado_inicial', 'defecto', 'trabajo_proceso', 'material_retirado', 'material_instalado', 'estado_final', 'placa_caracteristicas', 'medicion', 'general', 'otra'];
export const MATERIAL_MOVEMENT_TYPES = ['utilizado', 'retirado', 'pendiente_pedir', 'devuelto', 'no_utilizado'];
export const CHECKLIST_RESULTS = ['pendiente', 'ok', 'no_ok', 'no_aplica'];

export const REQUIREMENT_FIELDS = [
  ['requiere_checklist', 'Checklist'],
  ['requiere_fotos_iniciales', 'Fotografias iniciales'],
  ['requiere_fotos_finales', 'Fotografias finales'],
  ['requiere_verificacion_qr', 'Verificacion mediante QR'],
  ['requiere_mediciones', 'Registro de mediciones'],
  ['requiere_materiales', 'Registro de materiales'],
  ['requiere_firma_tecnico', 'Firma del tecnico'],
  ['requiere_firma_cliente', 'Firma del cliente'],
  ['requiere_informe', 'Informe PDF'],
  ['requiere_revision_admin', 'Revision del administrador'],
  ['requiere_geolocalizacion', 'Geolocalizacion'],
  ['requiere_fecha_prevista', 'Fecha prevista'],
  ['requiere_tiempo_empleado', 'Tiempo empleado'],
  ['requiere_valoracion_economica', 'Valoracion economica o presupuesto'],
  ['requiere_documentacion_adjunta', 'Documentacion adjunta'],
  ['requiere_prueba_funcional_final', 'Prueba funcional final']
];

const BASE_REQUIREMENTS = {
  requiere_checklist: false,
  requiere_fotos_iniciales: false,
  requiere_fotos_finales: false,
  requiere_verificacion_qr: false,
  requiere_mediciones: false,
  requiere_materiales: false,
  requiere_firma_tecnico: false,
  requiere_firma_cliente: false,
  requiere_informe: false,
  requiere_revision_admin: false,
  requiere_geolocalizacion: false,
  requiere_fecha_prevista: false,
  requiere_tiempo_empleado: false,
  requiere_valoracion_economica: false,
  requiere_documentacion_adjunta: false,
  requiere_prueba_funcional_final: false
};

const TYPE_REQUIREMENTS = {
  presupuesto: { requiere_fotos_iniciales: true, requiere_mediciones: true, requiere_valoracion_economica: true, requiere_informe: true },
  visita_previa: { requiere_fotos_iniciales: true },
  toma_datos: { requiere_fotos_iniciales: true, requiere_mediciones: true },
  diagnostico: { requiere_checklist: true, requiere_fotos_iniciales: true, requiere_informe: true },
  reparacion: { requiere_checklist: true, requiere_fotos_iniciales: true, requiere_fotos_finales: true, requiere_materiales: true, requiere_firma_cliente: true, requiere_informe: true, requiere_prueba_funcional_final: true },
  mantenimiento_preventivo: { requiere_checklist: true, requiere_fotos_finales: true, requiere_firma_tecnico: true, requiere_informe: true },
  mantenimiento_correctivo: { requiere_checklist: true, requiere_fotos_iniciales: true, requiere_fotos_finales: true, requiere_materiales: true, requiere_informe: true },
  inspeccion: { requiere_checklist: true, requiere_mediciones: true, requiere_informe: true },
  revision: { requiere_checklist: true, requiere_informe: true },
  instalacion: { requiere_checklist: true, requiere_fotos_iniciales: true, requiere_fotos_finales: true, requiere_materiales: true, requiere_firma_cliente: true, requiere_informe: true, requiere_prueba_funcional_final: true },
  montaje: { requiere_checklist: true, requiere_fotos_finales: true, requiere_materiales: true },
  puesta_marcha: { requiere_checklist: true, requiere_mediciones: true, requiere_prueba_funcional_final: true, requiere_informe: true },
  sustitucion: { requiere_checklist: true, requiere_fotos_iniciales: true, requiere_fotos_finales: true, requiere_materiales: true, requiere_informe: true },
  retirada: { requiere_fotos_iniciales: true, requiere_fotos_finales: true, requiere_materiales: true },
  seguimiento: { requiere_fotos_finales: true },
  verificacion_funcionamiento: { requiere_checklist: true, requiere_mediciones: true, requiere_prueba_funcional_final: true },
  medicion: { requiere_mediciones: true, requiere_informe: true },
  urgencia: { requiere_fotos_iniciales: true, requiere_fotos_finales: true, requiere_materiales: true, requiere_informe: true },
  formacion: { requiere_firma_cliente: true, requiere_informe: true },
  otro: {}
};

export function defaultRequirementsForType(type = 'mantenimiento_preventivo') {
  return {
    ...BASE_REQUIREMENTS,
    ...(TYPE_REQUIREMENTS[type] || TYPE_REQUIREMENTS.otro)
  };
}

export function normalizeWorkOrderType(type) {
  const legacy = {
    averia: 'diagnostico',
    mantenimiento: 'mantenimiento_preventivo'
  };
  return legacy[type] || type || 'mantenimiento_preventivo';
}

export function statusLabel(status = '') {
  return status.replaceAll('_', ' ').toLowerCase();
}

export function validNextActions(row = {}) {
  if (!row?.estado) return [];
  if (row.estado === 'CERRADA') return ['REABRIR'];
  if (row.estado === 'CANCELADA') return [];
  const actions = {
    BORRADOR: ['ASIGNADA', 'CANCELADA'],
    ASIGNADA: ['ACEPTADA', 'CANCELADA'],
    ACEPTADA: ['EN_CURSO', 'CANCELADA'],
    EN_CURSO: ['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'FINALIZADA', 'CANCELADA'],
    PENDIENTE_MATERIAL: ['EN_CURSO', 'CANCELADA'],
    PENDIENTE_CLIENTE: ['EN_CURSO', 'CANCELADA'],
    FINALIZADA: ['FIRMADA', 'INFORME_GENERADO', 'CERRADA'],
    FIRMADA: ['INFORME_GENERADO', 'CERRADA'],
    INFORME_GENERADO: ['CERRADA']
  };
  return actions[row.estado] || [];
}

const CHECKLIST_TEMPLATES = {
  averia: [
    ['Confirmar el sintoma comunicado por el cliente o responsable', false],
    ['Registrar estado inicial y evidencias del defecto', true],
    ['Identificar causa probable y actuacion realizada', true],
    ['Verificar que la averia queda resuelta o documentar pendiente', false]
  ],
  mantenimiento: [
    ['Realizar limpieza, reapriete y revision preventiva aplicable', true],
    ['Comprobar desgaste, consumibles y puntos criticos', false],
    ['Registrar mediciones, ajustes o material utilizado', false]
  ],
  revision: [
    ['Comprobar identificacion y documentacion del equipo', false],
    ['Revisar estado visual, conexiones y conservacion', true],
    ['Registrar mediciones y resultado de la revision', false]
  ],
  instalacion: [
    ['Comprobar montaje, fijaciones y conexionado', true],
    ['Verificar puesta en marcha y condiciones de seguridad', true],
    ['Registrar pruebas funcionales y entrega al responsable', false]
  ],
  inspeccion: [
    ['Comprobar acceso, identificacion y condiciones de inspeccion', false],
    ['Registrar defectos, incumplimientos o riesgos detectados', true],
    ['Documentar mediciones, resultado y recomendaciones', false]
  ],
  otro: [
    ['Realizar la actuacion indicada en la OT', true],
    ['Registrar resultado y observaciones relevantes', false]
  ],
  presupuesto: [
    ['Documentar situacion observada y necesidades detectadas', true],
    ['Registrar mediciones necesarias para valorar el trabajo', false],
    ['Indicar trabajo propuesto y condicionantes del presupuesto', false]
  ],
  diagnostico: [
    ['Confirmar sintomas comunicados', false],
    ['Identificar causa probable', true],
    ['Documentar pruebas realizadas y siguiente accion', false]
  ],
  reparacion: [
    ['Registrar diagnostico y causa', true],
    ['Documentar material utilizado o pendiente', false],
    ['Verificar funcionamiento tras la reparacion', true]
  ],
  mantenimiento_preventivo: [
    ['Realizar revision preventiva aplicable', true],
    ['Comprobar puntos criticos y desgaste', false],
    ['Registrar ajustes y observaciones', false]
  ],
  mantenimiento_correctivo: [
    ['Confirmar desviacion o defecto', true],
    ['Documentar correccion realizada', true],
    ['Registrar trabajo pendiente si aplica', false]
  ]
};

export const DEFAULT_CHECKLIST_ITEMS = [
  { punto: '1', descripcion: 'Comprobar acceso seguro a la zona de trabajo', requiere_foto: false },
  { punto: '2', descripcion: 'Identificar instalacion, ubicacion y activo intervenido', requiere_foto: true },
  { punto: '3', descripcion: 'Revisar estado visual general del equipo o instalacion', requiere_foto: true },
  { punto: '4', descripcion: 'Comprobar protecciones, alimentacion o elementos de seguridad aplicables', requiere_foto: false },
  { punto: '5', descripcion: 'Realizar prueba funcional tras la intervencion', requiere_foto: false },
  { punto: '6', descripcion: 'Registrar material utilizado o material pendiente', requiere_foto: false },
  { punto: '7', descripcion: 'Dejar la zona limpia, segura y operativa', requiere_foto: false },
  { punto: '8', descripcion: 'Informar al cliente o responsable de la actuacion realizada', requiere_foto: false }
];

export function checklistTemplateForType(type = 'mantenimiento') {
  const normalizedType = normalizeWorkOrderType(type);
  const base = [
    ['Comprobar acceso seguro a la zona de trabajo', false],
    ['Identificar instalacion, ubicacion y activo intervenido', true],
    ['Revisar estado visual general antes de intervenir', true]
  ];
  const specific = CHECKLIST_TEMPLATES[normalizedType] || CHECKLIST_TEMPLATES.otro;
  const closing = [
    ['Realizar prueba funcional final', false],
    ['Registrar material utilizado o material pendiente', false],
    ['Dejar la zona limpia, segura y operativa', true],
    ['Informar al cliente o responsable de la actuacion realizada', false]
  ];

  return [...base, ...specific, ...closing].map(([descripcion, requiere_foto], index) => ({
    punto: String(index + 1),
    descripcion,
    requiere_foto
  }));
}

function withTimeout(promise, label = 'La operacion', timeoutMs = 15000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ha tardado demasiado. Revisa la conexion y pulsa Reintentar.`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizePayload(payload) {
  const type = normalizeWorkOrderType(payload.tipo_ot || payload.tipo);
  const configuracion = {
    ...defaultRequirementsForType(type),
    ...(payload.configuracion || {})
  };
  return {
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    activos_relacionados: payload.activos_relacionados || [],
    titulo: payload.titulo,
    descripcion: payload.descripcion || null,
    tipo: type,
    tipo_ot: type,
    tipo_ot_detalle: type === 'otro' ? payload.tipo_ot_detalle || null : payload.tipo_ot_detalle || null,
    sintomas: payload.sintomas || null,
    trabajo_solicitado: payload.trabajo_solicitado || null,
    instrucciones_tecnico: payload.instrucciones_tecnico || null,
    riesgos_precauciones: payload.riesgos_precauciones || null,
    resultado_esperado: payload.resultado_esperado || null,
    prioridad: payload.prioridad || 'media',
    estado: payload.estado || 'ASIGNADA',
    assigned_to: payload.assigned_to || null,
    fecha_prevista: payload.fecha_prevista ? new Date(payload.fecha_prevista).toISOString() : null,
    fecha_limite: payload.fecha_limite ? new Date(payload.fecha_limite).toISOString() : null,
    duracion_estimada_minutos: payload.duracion_estimada_minutos ? Number(payload.duracion_estimada_minutos) : null,
    configuracion
  };
}

function assertEditable(row) {
  if (row?.estado === 'CERRADA') {
    throw new Error('La OT esta cerrada y es de solo lectura.');
  }
}

async function assertWorkOrderOpen(tenantId, workOrderId) {
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('estado')
    .eq('tenant_id', tenantId)
    .eq('id', workOrderId)
    .single();
  if (error) throw error;
  assertEditable(data);
}

export async function listWorkOrders(tenantId, { onlyMine = false, createdByMe = false } = {}) {
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre,direccion), ubicaciones(nombre), activos(nombre), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (onlyMine) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) query = query.eq('assigned_to', userData.user.id);
  }

  if (createdByMe) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) query = query.eq('created_by', userData.user.id);
  }

  const { data, error } = await withTimeout(query, 'La carga de ordenes de trabajo');
  if (error) throw error;
  return data || [];
}

export async function getWorkOrder(tenantId, id) {
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre,direccion,latitud,longitud,maps_url,contacto_nombre,contacto_telefono,contacto_email,descripcion), ubicaciones(nombre,codigo,planta,zona,descripcion), activos(nombre,tipo,marca,modelo,numero_serie,estado,image_bucket,image_path), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email), creator:profiles!ordenes_trabajo_created_by_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createWorkOrder(tenantId, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const normalized = normalizePayload(payload);
  if (normalized.assigned_to) {
    normalized.assigned_by = userData.user?.id || null;
    normalized.assigned_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      tenant_id: tenantId,
      ...normalized,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'create_work_order', entityType: 'orden_trabajo', entityId: data.id });
  return data;
}

export async function updateWorkOrder(row, payload) {
  assertEditable(row);
  const normalized = normalizePayload({ ...row, ...payload });
  if (payload.assigned_to && payload.assigned_to !== row.assigned_to) {
    const { data: userData } = await supabase.auth.getUser();
    normalized.assigned_by = userData.user?.id || null;
    normalized.assigned_at = new Date().toISOString();
    normalized.reassignment_reason = payload.reassignment_reason || null;
  }
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(normalized)
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_work_order', entityType: 'orden_trabajo', entityId: row.id });
  return data;
}

export async function updateWorkOrderStatus(row, status) {
  if (row.estado === 'CERRADA' && status !== 'REABRIR') assertEditable(row);
  const { data: userData } = await supabase.auth.getUser();
  if (status === 'REABRIR') {
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .update({
        estado: 'EN_CURSO',
        reopened_by: userData.user?.id || null,
        reopened_at: new Date().toISOString(),
        reopen_reason: row.reopen_reason || 'Reapertura manual',
        fecha_fin: null
      })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id)
      .select()
      .single();
    if (error) throw error;
    await logAudit({ tenantId: row.tenant_id, action: 'reopen_work_order', entityType: 'orden_trabajo', entityId: row.id });
    return data;
  }
  const patch = { estado: status };
  if (status === 'EN_CURSO' && !row.fecha_inicio) patch.fecha_inicio = new Date().toISOString();
  if (['FINALIZADA', 'FIRMADA', 'INFORME_GENERADO', 'CERRADA'].includes(status) && !row.fecha_fin) patch.fecha_fin = new Date().toISOString();
  if (status === 'CERRADA') {
    patch.closed_by = userData.user?.id || null;
    patch.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(patch)
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_work_order_status', entityType: 'orden_trabajo', entityId: row.id, metadata: { status } });
  return data;
}

export async function listWorkOrderVisits(tenantId, workOrderId) {
  const { data, error } = await supabase
    .from('ot_visitas')
    .select('*, tecnico:profiles!ot_visitas_tecnico_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('ot_id', workOrderId)
    .order('fecha_inicio', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function startWorkOrderVisit(row, location = {}, payload = {}) {
  assertEditable(row);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  const { data: activeVisits, error: activeError } = await supabase
    .from('ot_visitas')
    .select('id')
    .eq('tenant_id', row.tenant_id)
    .eq('ot_id', row.id)
    .eq('tecnico_id', userId)
    .eq('estado', 'EN_CURSO')
    .limit(1);
  if (activeError) throw activeError;
  if (activeVisits?.length) throw new Error('Ya tienes una intervencion en curso para esta OT.');

  const { data, error } = await supabase
    .from('ot_visitas')
    .insert({
      tenant_id: row.tenant_id,
      ot_id: row.id,
      tecnico_id: userId,
      estado: 'EN_CURSO',
      tipo_visita: payload.tipo_visita || normalizeWorkOrderType(row.tipo_ot || row.tipo),
      tipo_visita_detalle: payload.tipo_visita_detalle || null,
      estado_inicial: payload.estado_inicial || null,
      dispositivo: {
        userAgent: navigator.userAgent,
        online: navigator.onLine
      },
      latitud: location.latitude || null,
      longitud: location.longitude || null
    })
    .select()
    .single();

  if (error) throw error;

  if (row.estado !== 'EN_CURSO') {
    await updateWorkOrderStatus(row, 'EN_CURSO');
  }

  await logAudit({ tenantId: row.tenant_id, action: 'start_work_order_visit', entityType: 'ot_visita', entityId: data.id, metadata: { otId: row.id } });
  return data;
}

export async function updateWorkOrderVisit(row, payload) {
  await assertWorkOrderOpen(row.tenant_id, row.ot_id);
  const { data, error } = await supabase
    .from('ot_visitas')
    .update({
      observaciones: payload.observaciones || null,
      situacion_encontrada: payload.situacion_encontrada || row.situacion_encontrada || null,
      trabajo_realizado: payload.trabajo_realizado || row.trabajo_realizado || null,
      diagnostico: payload.diagnostico || row.diagnostico || null,
      causa: payload.causa || row.causa || null,
      pruebas_realizadas: payload.pruebas_realizadas || row.pruebas_realizadas || null,
      recomendaciones: payload.recomendaciones || row.recomendaciones || null,
      trabajo_pendiente: payload.trabajo_pendiente || row.trabajo_pendiente || null,
      estado_final_activo: payload.estado_final_activo || row.estado_final_activo || 'no_comprobado',
      latitud: payload.latitud || row.latitud || null,
      longitud: payload.longitud || row.longitud || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_work_order_visit', entityType: 'ot_visita', entityId: row.id, metadata: { otId: row.ot_id } });
  return data;
}

export async function finishWorkOrderVisit(visit, payload = {}) {
  await assertWorkOrderOpen(visit.tenant_id, visit.ot_id);
  const result = payload.resultado_cierre || 'trabajo_completado';
  const statusByResult = {
    trabajo_completado: 'FINALIZADA',
    pendiente_material: 'PENDIENTE_MATERIAL',
    pendiente_cliente: 'PENDIENTE_CLIENTE',
    necesita_otra_visita: 'EN_CURSO',
    no_realizado: 'FINALIZADA'
  };
  const nextStatus = statusByResult[result] || 'FINALIZADA';
  const { data, error } = await supabase
    .from('ot_visitas')
    .update({
      estado: 'FINALIZADA',
      fecha_fin: new Date().toISOString(),
      observaciones: payload.observaciones || visit.observaciones || null,
      trabajo_realizado: payload.trabajo_realizado || visit.trabajo_realizado || null,
      diagnostico: payload.diagnostico || visit.diagnostico || null,
      causa: payload.causa || visit.causa || null,
      pruebas_realizadas: payload.pruebas_realizadas || visit.pruebas_realizadas || null,
      recomendaciones: payload.recomendaciones || visit.recomendaciones || null,
      trabajo_pendiente: payload.trabajo_pendiente || visit.trabajo_pendiente || null,
      resultado_cierre: result,
      motivo_cierre: payload.motivo_cierre || null,
      proxima_accion: payload.proxima_accion || null,
      proximo_tipo_visita: payload.proximo_tipo_visita || null,
      estado_final_activo: payload.estado_final_activo || visit.estado_final_activo || 'no_comprobado',
      updated_at: new Date().toISOString()
    })
    .eq('id', visit.id)
    .eq('tenant_id', visit.tenant_id)
    .select()
    .single();

  if (error) throw error;

  const { data: workOrder } = await supabase
    .from('ordenes_trabajo')
    .select('*')
    .eq('tenant_id', visit.tenant_id)
    .eq('id', visit.ot_id)
    .single();

  if (workOrder && !['CERRADA', 'CANCELADA'].includes(workOrder.estado)) {
    await updateWorkOrderStatus(workOrder, nextStatus);
  }

  await logAudit({ tenantId: visit.tenant_id, action: 'finish_work_order_visit', entityType: 'ot_visita', entityId: visit.id, metadata: { otId: visit.ot_id } });
  return data;
}

export async function listWorkOrderVisitsForTenant(tenantId) {
  const { data, error } = await withTimeout(supabase
    .from('ot_visitas')
    .select('id,tenant_id,ot_id,tecnico_id,fecha_inicio,fecha_fin,estado')
    .eq('tenant_id', tenantId)
    .order('fecha_inicio', { ascending: false }), 'La carga de visitas de OT');

  if (error) throw error;
  return data || [];
}

export async function listWorkOrderChecklist(tenantId, workOrderId) {
  const { data, error } = await withTimeout(supabase
    .from('ot_checklist_respuestas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ot_id', workOrderId)
    .order('orden', { ascending: true }), 'La carga del checklist');

  if (error) throw error;
  return data || [];
}

export async function ensureDefaultChecklist(row) {
  if (row.configuracion && row.configuracion.requiere_checklist === false) return [];
  const existing = await listWorkOrderChecklist(row.tenant_id, row.id);
  if (existing.length > 0) return existing;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;
  const payload = checklistTemplateForType(row.tipo).map((item, index) => ({
    tenant_id: row.tenant_id,
    ot_id: row.id,
    orden: index + 1,
    punto: item.punto,
    descripcion: item.descripcion,
    resultado: 'pendiente',
    requiere_foto: item.requiere_foto,
    created_by: userId
  }));

  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .insert(payload)
    .select()
    .order('orden', { ascending: true });

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'create_default_work_order_checklist', entityType: 'orden_trabajo', entityId: row.id });
  return data || [];
}

export async function createChecklistItem(row, payload) {
  assertEditable(row);
  const { data: userData } = await supabase.auth.getUser();
  const current = await listWorkOrderChecklist(row.tenant_id, row.id);
  const nextOrder = current.length + 1;

  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .insert({
      tenant_id: row.tenant_id,
      ot_id: row.id,
      visita_id: payload.visita_id || null,
      orden: payload.orden || nextOrder,
      punto: payload.punto || String(nextOrder),
      descripcion: payload.descripcion,
      resultado: payload.resultado || 'pendiente',
      observacion: payload.observacion || null,
      requiere_foto: Boolean(payload.requiere_foto),
      requiere_observacion: Boolean(payload.requiere_observacion),
      requiere_accion: Boolean(payload.requiere_accion),
      requiere_medicion: Boolean(payload.requiere_medicion),
      tipo_campo: payload.tipo_campo || 'resultado',
      valor_referencia: payload.valor_referencia || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'create_work_order_checklist_item', entityType: 'ot_checklist_respuesta', entityId: data.id, metadata: { otId: row.id } });
  return data;
}

export async function updateChecklistItem(item, payload) {
  await assertWorkOrderOpen(item.tenant_id, item.ot_id);
  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .update({
      visita_id: payload.visita_id || item.visita_id || null,
      resultado: payload.resultado || item.resultado || 'pendiente',
      observacion: payload.observacion || null,
      requiere_foto: Boolean(payload.requiere_foto),
      medicion_valor: payload.medicion_valor || null,
      accion_realizada: payload.accion_realizada || null,
      defecto: payload.defecto || null,
      estado_despues: payload.estado_despues || null,
      recomendacion: payload.recomendacion || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', item.id)
    .eq('tenant_id', item.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: item.tenant_id, action: 'update_work_order_checklist_item', entityType: 'ot_checklist_respuesta', entityId: item.id, metadata: { otId: item.ot_id, result: payload.resultado } });
  return data;
}

export async function listChecklistPhotos(tenantId, checklistItemId) {
  const { data, error } = await supabase
    .from('ot_fotos')
    .select('*, created_by_profile:profiles!ot_fotos_created_by_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('checklist_respuesta_id', checklistItemId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadChecklistPhoto({ workOrder, checklistItem, visitId = null, file, comentario = '', tipoFoto = 'otra' }) {
  assertEditable(workOrder);
  if (!file) throw new Error('Selecciona una foto.');

  const { data: userData } = await supabase.auth.getUser();
  const path = buildStoragePath({
    tenantId: workOrder.tenant_id,
    scope: 'ordenes-trabajo',
    scopeId: workOrder.id,
    folder: `checklist/${checklistItem.id}`,
    file
  });

  await uploadPrivateFile({
    tenantId: workOrder.tenant_id,
    bucket: 'photos-private',
    path,
    file,
    metadata: {
      auditAction: 'upload_work_order_checklist_photo',
      entityType: 'ot_checklist_respuesta',
      entityId: checklistItem.id
    }
  });

  const { data, error } = await supabase
    .from('ot_fotos')
    .insert({
      tenant_id: workOrder.tenant_id,
      ot_id: workOrder.id,
      visita_id: visitId || checklistItem.visita_id || null,
      checklist_respuesta_id: checklistItem.id,
      bucket: 'photos-private',
      path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      comentario: comentario || null,
      tipo_foto: tipoFoto || 'otra',
      instalacion_id: workOrder.instalacion_id,
      ubicacion_id: workOrder.ubicacion_id || null,
      activo_id: workOrder.activo_id || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'register_work_order_checklist_photo', entityType: 'ot_foto', entityId: data.id, metadata: { otId: workOrder.id, checklistItemId: checklistItem.id } });
  return data;
}

export async function listVisitMaterials(tenantId, visitId) {
  const { data, error } = await supabase
    .from('ot_visita_materiales')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visita_id', visitId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createVisitMaterial(workOrder, visit, payload) {
  assertEditable(workOrder);
  if (!payload.descripcion_libre && !payload.material_id) throw new Error('Indica material o descripcion libre.');
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('ot_visita_materiales')
    .insert({
      tenant_id: workOrder.tenant_id,
      ot_id: workOrder.id,
      visita_id: visit?.id || null,
      material_id: payload.material_id || null,
      descripcion_libre: payload.descripcion_libre || null,
      referencia: payload.referencia || null,
      cantidad: payload.cantidad ? Number(payload.cantidad) : 1,
      unidad: payload.unidad || 'ud',
      tipo_movimiento: payload.tipo_movimiento || 'utilizado',
      numero_serie: payload.numero_serie || null,
      observaciones: payload.observaciones || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'create_work_order_visit_material', entityType: 'ot_visita_material', entityId: data.id, metadata: { otId: workOrder.id, visitId: visit?.id || null } });
  return data;
}

export async function signedChecklistPhotoUrl(photo, expiresIn = 600) {
  if (!photo?.bucket || !photo?.path) return '';
  return createSignedUrl({
    tenantId: photo.tenant_id,
    bucket: photo.bucket,
    path: photo.path,
    entityType: 'ot_foto',
    entityId: photo.id,
    expiresIn
  });
}
