import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';

export const WORK_ORDER_STATUSES = ['BORRADOR', 'NUEVA', 'ASIGNADA', 'ACEPTADA', 'EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'FINALIZADA', 'FIRMADA', 'INFORME_GENERADO', 'VALIDADA', 'CERRADA', 'CANCELADA'];
export const WORK_ORDER_PRIORITIES = ['baja', 'media', 'normal', 'alta', 'urgente', 'critica'];
export const WORK_ORDER_TYPES = ['presupuesto', 'visita_previa', 'toma_datos', 'diagnostico', 'reparacion', 'mantenimiento_preventivo', 'mantenimiento_correctivo', 'inspeccion', 'revision', 'instalacion', 'montaje', 'puesta_marcha', 'sustitucion', 'retirada', 'seguimiento', 'verificacion_funcionamiento', 'medicion', 'urgencia', 'formacion', 'otro'];
export const WORK_ORDER_TYPE_LABELS = {
  presupuesto: 'Presupuesto', visita_previa: 'Visita previa', toma_datos: 'Toma de datos', diagnostico: 'Diagnostico', reparacion: 'Reparacion', mantenimiento_preventivo: 'Mantenimiento preventivo', mantenimiento_correctivo: 'Mantenimiento correctivo', inspeccion: 'Inspeccion', revision: 'Revision', instalacion: 'Instalacion', montaje: 'Montaje', puesta_marcha: 'Puesta en marcha', sustitucion: 'Sustitucion', retirada: 'Retirada', seguimiento: 'Seguimiento', verificacion_funcionamiento: 'Verificacion de funcionamiento', medicion: 'Medicion', urgencia: 'Urgencia', formacion: 'Formacion', otro: 'Otro'
};
export const VISIT_TYPES = ['diagnostico', 'reparacion', 'sustitucion', 'verificacion_funcionamiento', 'presupuesto', 'toma_datos', 'mantenimiento_preventivo', 'inspeccion', 'seguimiento', 'otro'];
export const VISIT_CLOSE_RESULTS = ['trabajo_completado', 'pendiente_material', 'pendiente_cliente', 'necesita_otra_visita', 'no_realizado'];
export const ASSET_FINAL_STATUSES = ['operativo', 'operativo_limitaciones', 'fuera_servicio', 'pendiente_reparacion', 'no_comprobado', 'no_aplica'];
export const PHOTO_TYPES = ['estado_inicial', 'defecto', 'trabajo_proceso', 'material_retirado', 'material_instalado', 'estado_final', 'placa_caracteristicas', 'medicion', 'general', 'otra'];
export const MATERIAL_MOVEMENT_TYPES = ['utilizado', 'retirado', 'pendiente_pedir', 'devuelto', 'no_utilizado'];
export const MATERIAL_MOVEMENT_LABELS = { utilizado: 'Utilizado', retirado: 'Retirado', pendiente_pedir: 'Pendiente de pedir', devuelto: 'Devuelto', no_utilizado: 'No utilizado' };
export const CHECKLIST_RESULTS = ['pendiente', 'ok', 'no_ok', 'no_aplica'];
export const REQUIREMENT_FIELDS = [
  ['requiere_checklist', 'Checklist'], ['requiere_fotos_iniciales', 'Fotografias iniciales'], ['requiere_fotos_finales', 'Fotografias finales'], ['requiere_verificacion_qr', 'Verificacion mediante QR'], ['requiere_mediciones', 'Registro de mediciones'], ['requiere_materiales', 'Registro de materiales'], ['requiere_firma_tecnico', 'Firma del tecnico'], ['requiere_firma_cliente', 'Firma del cliente'], ['requiere_informe', 'Informe PDF'], ['requiere_revision_admin', 'Revision del administrador'], ['requiere_geolocalizacion', 'Geolocalizacion'], ['requiere_fecha_prevista', 'Fecha prevista'], ['requiere_tiempo_empleado', 'Tiempo empleado'], ['requiere_valoracion_economica', 'Valoracion economica o presupuesto'], ['requiere_documentacion_adjunta', 'Documentacion adjunta'], ['requiere_prueba_funcional_final', 'Prueba funcional final']
];

const BASE_REQUIREMENTS = { requiere_checklist: false, requiere_fotos_iniciales: false, requiere_fotos_finales: false, requiere_verificacion_qr: false, requiere_mediciones: false, requiere_materiales: false, requiere_firma_tecnico: false, requiere_firma_cliente: false, requiere_informe: false, requiere_revision_admin: false, requiere_geolocalizacion: false, requiere_fecha_prevista: false, requiere_tiempo_empleado: false, requiere_valoracion_economica: false, requiere_documentacion_adjunta: false, requiere_prueba_funcional_final: false };
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

const CHECKLIST_TEMPLATES = {
  averia: [['Confirmar el sintoma comunicado por el cliente o responsable', false], ['Registrar estado inicial y evidencias del defecto', true], ['Identificar causa probable y actuacion realizada', true], ['Verificar que la averia queda resuelta o documentar pendiente', false]],
  mantenimiento: [['Realizar limpieza, reapriete y revision preventiva aplicable', true], ['Comprobar desgaste, consumibles y puntos criticos', false], ['Registrar mediciones, ajustes o material utilizado', false]],
  revision: [['Comprobar identificacion y documentacion del equipo', false], ['Revisar estado visual, conexiones y conservacion', true], ['Registrar mediciones y resultado de la revision', false]],
  instalacion: [['Comprobar montaje, fijaciones y conexionado', true], ['Verificar puesta en marcha y condiciones de seguridad', true], ['Registrar pruebas funcionales y entrega al responsable', false]],
  inspeccion: [['Comprobar acceso, identificacion y condiciones de inspeccion', false], ['Registrar defectos, incumplimientos o riesgos detectados', true], ['Documentar mediciones, resultado y recomendaciones', false]],
  otro: [['Realizar la actuacion indicada en la OT', true], ['Registrar resultado y observaciones relevantes', false]],
  presupuesto: [['Documentar situacion observada y necesidades detectadas', true], ['Registrar mediciones necesarias para valorar el trabajo', false], ['Indicar trabajo propuesto y condicionantes del presupuesto', false]],
  diagnostico: [['Confirmar sintomas comunicados', false], ['Identificar causa probable', true], ['Documentar pruebas realizadas y siguiente accion', false]],
  reparacion: [['Registrar diagnostico y causa', true], ['Documentar material utilizado o pendiente', false], ['Verificar funcionamiento tras la reparacion', true]],
  mantenimiento_preventivo: [['Realizar revision preventiva aplicable', true], ['Comprobar puntos criticos y desgaste', false], ['Registrar ajustes y observaciones', false]],
  mantenimiento_correctivo: [['Confirmar desviacion o defecto', true], ['Documentar correccion realizada', true], ['Registrar trabajo pendiente si aplica', false]]
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

export function defaultRequirementsForType(type = 'mantenimiento_preventivo') {
  return { ...BASE_REQUIREMENTS, ...(TYPE_REQUIREMENTS[type] || TYPE_REQUIREMENTS.otro) };
}

export function normalizeWorkOrderType(type) {
  const legacy = { averia: 'diagnostico', mantenimiento: 'mantenimiento_preventivo' };
  return legacy[type] || type || 'mantenimiento_preventivo';
}

export function statusLabel(status = '') {
  return String(status || '').replaceAll('_', ' ').toLowerCase();
}

export function validNextActions(row = {}) {
  if (!row?.estado) return [];
  if (row.estado === 'CERRADA') return ['REABRIR'];
  if (row.estado === 'CANCELADA') return [];
  const actions = {
    BORRADOR: ['ASIGNADA', 'CANCELADA'], NUEVA: ['ASIGNADA', 'CANCELADA'], ASIGNADA: ['ACEPTADA', 'EN_CURSO', 'CANCELADA'], ACEPTADA: ['EN_CURSO', 'CANCELADA'], EN_CURSO: ['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'FINALIZADA', 'CANCELADA'], PENDIENTE_MATERIAL: ['EN_CURSO', 'CANCELADA'], PENDIENTE_CLIENTE: ['EN_CURSO', 'CANCELADA'], FINALIZADA: ['FIRMADA', 'INFORME_GENERADO', 'VALIDADA', 'CERRADA'], FIRMADA: ['INFORME_GENERADO', 'VALIDADA', 'CERRADA'], INFORME_GENERADO: ['VALIDADA', 'CERRADA'], VALIDADA: ['CERRADA']
  };
  return actions[row.estado] || [];
}

export function checklistTemplateForType(type = 'mantenimiento') {
  const normalizedType = normalizeWorkOrderType(type);
  const base = [['Comprobar acceso seguro a la zona de trabajo', false], ['Identificar instalacion, ubicacion y activo intervenido', true], ['Revisar estado visual general antes de intervenir', true]];
  const specific = CHECKLIST_TEMPLATES[normalizedType] || CHECKLIST_TEMPLATES.otro;
  const closing = [['Realizar prueba funcional final', false], ['Registrar material utilizado o material pendiente', false], ['Dejar la zona limpia, segura y operativa', true], ['Informar al cliente o responsable de la actuacion realizada', false]];
  return [...base, ...specific, ...closing].map(([descripcion, requiere_foto], index) => ({ punto: String(index + 1), descripcion, requiere_foto }));
}

function normalizePayload(payload) {
  const type = normalizeWorkOrderType(payload.tipo_ot || payload.tipo);
  const configuracion = { ...defaultRequirementsForType(type), ...(payload.configuracion || {}) };
  return {
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    titulo: payload.titulo,
    descripcion: payload.descripcion || null,
    tipo: type,
    tipo_ot: type,
    prioridad: payload.prioridad || 'media',
    estado: payload.estado || 'ASIGNADA',
    assigned_to: payload.assigned_to || null,
    fecha_prevista: payload.fecha_prevista || null,
    fecha_inicio: payload.fecha_inicio || null,
    fecha_fin: payload.fecha_fin || null,
    trabajo_solicitado: payload.trabajo_solicitado || payload.descripcion || null,
    instrucciones_tecnico: payload.instrucciones_tecnico || null,
    resultado_esperado: payload.resultado_esperado || null,
    fecha_limite: payload.fecha_limite || null,
    tiempo_estimado_min: payload.tiempo_estimado_min ? Number(payload.tiempo_estimado_min) : null,
    duracion_estimada_minutos: payload.duracion_estimada_minutos ? Number(payload.duracion_estimada_minutos) : null,
    coste_estimado: payload.coste_estimado ? Number(payload.coste_estimado) : null,
    configuracion
  };
}

function isMissingConfigurationColumn(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return text.includes('configuracion') && (text.includes('pgrst204') || text.includes('schema cache') || text.includes('could not find'));
}

function isLegacyWorkOrderSchemaError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  const modernColumns = ['configuracion', 'tipo_ot', 'sintomas', 'trabajo_solicitado', 'instrucciones_tecnico', 'resultado_esperado', 'fecha_limite', 'duracion_estimada_minutos'];
  return isMissingConfigurationColumn(error)
    || (modernColumns.some((column) => text.includes(column)) && (text.includes('pgrst204') || text.includes('schema cache') || text.includes('could not find')))
    || text.includes('ordenes_trabajo_tipo_check')
    || text.includes('ordenes_trabajo_prioridad_check')
    || text.includes('ordenes_trabajo_estado_check');
}

function legacyWorkOrderType(type) {
  const normalized = normalizeWorkOrderType(type);
  if (['revision', 'instalacion', 'inspeccion'].includes(normalized)) return normalized;
  if (['diagnostico', 'reparacion', 'urgencia', 'mantenimiento_correctivo'].includes(normalized)) return 'averia';
  if (['mantenimiento_preventivo', 'seguimiento', 'verificacion_funcionamiento', 'medicion'].includes(normalized)) return 'mantenimiento';
  return 'otro';
}

function legacyPriority(priority) {
  if (priority === 'baja' || priority === 'alta' || priority === 'urgente') return priority;
  if (priority === 'critica') return 'urgente';
  return 'media';
}

function legacyStatus(status) {
  if (status === 'BORRADOR') return 'BORRADOR';
  if (status === 'CANCELADA') return 'CANCELADA';
  return 'ASIGNADA';
}

function legacyWorkOrderPayload(payload) {
  return {
    tenant_id: payload.tenant_id,
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    titulo: payload.titulo,
    descripcion: payload.descripcion || payload.trabajo_solicitado || null,
    tipo: legacyWorkOrderType(payload.tipo_ot || payload.tipo),
    prioridad: legacyPriority(payload.prioridad),
    estado: legacyStatus(payload.estado),
    assigned_to: payload.assigned_to || null,
    fecha_prevista: payload.fecha_prevista || null,
    fecha_inicio: payload.fecha_inicio || null,
    fecha_fin: payload.fecha_fin || null,
    created_by: payload.created_by || null
  };
}

function withDefaultConfiguration(row, fallbackConfiguration = null) {
  if (!row) return row;
  const type = normalizeWorkOrderType(row.tipo_ot || row.tipo);
  return {
    ...row,
    configuracion: {
      ...defaultRequirementsForType(type),
      ...(row.configuracion || fallbackConfiguration || {})
    }
  };
}

function assertEditable(workOrder) {
  if (['CERRADA', 'VALIDADA', 'CANCELADA'].includes(workOrder?.estado)) throw new Error('La OT esta cerrada y no admite cambios.');
}

async function assertWorkOrderOpen(tenantId, workOrderId) {
  const { data, error } = await supabase.from('ordenes_trabajo').select('id,estado').eq('tenant_id', tenantId).eq('id', workOrderId).single();
  if (error) throw error;
  assertEditable(data);
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function listWorkOrders(tenantId, options = {}) {
  const userId = options.onlyMine || options.createdByMe ? await currentUserId() : null;
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(id,tenant_id,nombre,direccion,contacto_nombre,contacto_telefono,latitud,longitud,maps_url), ubicaciones(id,tenant_id,nombre), activos(id,tenant_id,nombre), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (options.onlyMine) {
    if (!userId) return [];
    query = query.eq('assigned_to', userId);
    query = query.neq('estado', 'BORRADOR');
  }

  if (options.createdByMe) {
    if (!userId) return [];
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => withDefaultConfiguration(row));
}

export async function getWorkOrder(tenantId, id) {
  const { data, error } = await supabase.from('ordenes_trabajo').select('*, instalaciones(id,tenant_id,nombre,direccion,contacto_nombre,contacto_telefono,latitud,longitud,maps_url), ubicaciones(id,tenant_id,nombre), activos(id,tenant_id,nombre,marca,modelo,numero_serie), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email), created_by_profile:profiles!ordenes_trabajo_created_by_fkey(nombre,email)').eq('tenant_id', tenantId).eq('id', id).single();
  if (error) throw error;
  return withDefaultConfiguration(data);
}

export async function createWorkOrder(tenantId, payload) {
  const userId = await currentUserId();
  const normalized = normalizePayload(payload);
  const basePayload = { tenant_id: tenantId, ...normalized, created_by: userId };
  let { data, error } = await supabase.from('ordenes_trabajo').insert(basePayload).select().single();
  if (error && isLegacyWorkOrderSchemaError(error)) {
    console.warn('El esquema de ordenes_trabajo en Supabase parece anterior al modelo OT actual. Creando OT con payload compatible hasta aplicar las migraciones OT.', error);
    ({ data, error } = await supabase.from('ordenes_trabajo').insert(legacyWorkOrderPayload(basePayload)).select().single());
  }
  if (error) throw error;
  const created = withDefaultConfiguration(data, normalized.configuracion);
  if (created.configuracion?.requiere_checklist !== false) {
    await ensureDefaultChecklist(created).catch((checklistError) => {
      console.warn('No se pudo crear el checklist base de la OT', checklistError);
    });
  }
  await logAudit({ tenantId, action: 'create_work_order', entityType: 'orden_trabajo', entityId: created.id, metadata: { status: created.estado, type: created.tipo } }).catch((auditError) => {
    console.warn('No se pudo registrar auditoria de creacion de OT', auditError);
  });
  return created;
}

export async function seedChecklist(tenantId, workOrderId, type = 'mantenimiento', createdBy = null) {
  const existing = await supabase.from('ot_checklist_respuestas').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('ot_id', workOrderId);
  if (existing.error) throw existing.error;
  if ((existing.count || 0) > 0) return listWorkOrderChecklist(tenantId, workOrderId);
  const items = checklistTemplateForType(type).map((item, index) => ({ tenant_id: tenantId, ot_id: workOrderId, orden: index + 1, punto: item.punto, descripcion: item.descripcion, requiere_foto: item.requiere_foto, created_by: createdBy }));
  const { data, error } = await supabase.from('ot_checklist_respuestas').insert(items).select();
  if (error) throw error;
  return data || [];
}

export async function ensureDefaultChecklist(workOrder) {
  const userId = await currentUserId();
  return seedChecklist(workOrder.tenant_id, workOrder.id, workOrder.tipo_ot || workOrder.tipo, userId);
}

export async function createChecklistItem(workOrder, payload) {
  assertEditable(workOrder);
  const userId = await currentUserId();
  const existing = await supabase.from('ot_checklist_respuestas').select('orden').eq('tenant_id', workOrder.tenant_id).eq('ot_id', workOrder.id).order('orden', { ascending: false }).limit(1);
  if (existing.error) throw existing.error;
  const nextOrder = (existing.data?.[0]?.orden || 0) + 1;
  const { data, error } = await supabase.from('ot_checklist_respuestas').insert({ tenant_id: workOrder.tenant_id, ot_id: workOrder.id, visita_id: payload.visita_id || null, orden: nextOrder, punto: String(nextOrder), descripcion: payload.descripcion, requiere_foto: Boolean(payload.requiere_foto), resultado: 'pendiente', created_by: userId }).select().single();
  if (error) throw error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'create_work_order_checklist_item', entityType: 'ot_checklist_respuesta', entityId: data.id, metadata: { otId: workOrder.id } });
  return data;
}

export async function listWorkOrderVisits(tenantId, workOrderId) {
  const { data, error } = await supabase.from('ot_visitas').select('*, tecnico:profiles!ot_visitas_tecnico_id_fkey(nombre,email)').eq('tenant_id', tenantId).eq('ot_id', workOrderId).order('fecha_inicio', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listWorkOrderVisitsForTenant(tenantId) {
  const { data, error } = await supabase
    .from('ot_visitas')
    .select('*, tecnico:profiles!ot_visitas_tecnico_id_fkey(nombre,email), orden:ordenes_trabajo(codigo_ot,titulo,estado)')
    .eq('tenant_id', tenantId)
    .order('fecha_inicio', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function startWorkOrderVisit(workOrder, location = {}, payload = {}) {
  assertEditable(workOrder);
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('ot_visitas').insert({ tenant_id: workOrder.tenant_id, ot_id: workOrder.id, tecnico_id: userId || workOrder.assigned_to || null, fecha_inicio: now, estado: 'EN_CURSO', latitud: location.latitude || null, longitud: location.longitude || null, tipo_visita: payload.tipo_visita || workOrder.tipo_ot || workOrder.tipo || 'diagnostico', tipo_visita_detalle: payload.tipo_visita_detalle || null, estado_inicial: payload.estado_inicial || null, situacion_encontrada: payload.situacion_encontrada || null, observaciones: payload.observaciones || null }).select().single();
  if (error) throw error;
  const updateResult = await supabase.from('ordenes_trabajo').update({ estado: 'EN_CURSO', fecha_inicio: workOrder.fecha_inicio || now, updated_at: now }).eq('tenant_id', workOrder.tenant_id).eq('id', workOrder.id).select('id,estado').single();
  if (updateResult.error) throw updateResult.error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'start_work_order_visit', entityType: 'ot_visita', entityId: data.id, metadata: { otId: workOrder.id } });
  return data;
}

export async function updateWorkOrderVisit(visit, payload = {}) {
  const { data, error } = await supabase.from('ot_visitas').update({ tipo_visita: payload.tipo_visita || visit.tipo_visita, tipo_visita_detalle: payload.tipo_visita_detalle || null, estado_inicial: payload.estado_inicial || null, situacion_encontrada: payload.situacion_encontrada || null, trabajo_realizado: payload.trabajo_realizado || null, diagnostico: payload.diagnostico || null, causa: payload.causa || null, pruebas_realizadas: payload.pruebas_realizadas || null, recomendaciones: payload.recomendaciones || null, trabajo_pendiente: payload.trabajo_pendiente || null, estado_final_activo: payload.estado_final_activo || null, observaciones: payload.observaciones || null, updated_at: new Date().toISOString() }).eq('tenant_id', visit.tenant_id).eq('id', visit.id).select().single();
  if (error) throw error;
  return data;
}

export async function finishWorkOrderVisit(visit, payload = {}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('ot_visitas').update({ ...payload, estado: 'FINALIZADA', fecha_fin: now, resultado_cierre: payload.resultado_cierre || 'trabajo_completado', motivo_cierre: payload.motivo_cierre || null, proxima_accion: payload.proxima_accion || null, updated_at: now }).eq('tenant_id', visit.tenant_id).eq('id', visit.id).select().single();
  if (error) throw error;
  const nextStatus = payload.resultado_cierre === 'pendiente_material' ? 'PENDIENTE_MATERIAL' : payload.resultado_cierre === 'pendiente_cliente' ? 'PENDIENTE_CLIENTE' : payload.resultado_cierre === 'necesita_otra_visita' ? 'PAUSADA' : 'FINALIZADA';
  const updateResult = await supabase.from('ordenes_trabajo').update({ estado: nextStatus, fecha_fin: nextStatus === 'FINALIZADA' ? now : null, updated_at: now }).eq('tenant_id', visit.tenant_id).eq('id', visit.ot_id).select('id,estado').single();
  if (updateResult.error) throw updateResult.error;
  await logAudit({ tenantId: visit.tenant_id, action: 'finish_work_order_visit', entityType: 'ot_visita', entityId: visit.id, metadata: { otId: visit.ot_id, result: payload.resultado_cierre } });
  return data;
}

export async function listWorkOrderChecklist(tenantId, workOrderId) {
  const { data, error } = await supabase.from('ot_checklist_respuestas').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId).order('orden', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateChecklistItem(item, payload) {
  await assertWorkOrderOpen(item.tenant_id, item.ot_id);
  const { data, error } = await supabase.from('ot_checklist_respuestas').update({ visita_id: payload.visita_id || item.visita_id || null, punto: payload.punto || item.punto, descripcion: payload.descripcion ?? item.descripcion, resultado: payload.resultado || item.resultado || 'pendiente', observacion: payload.observacion || null, requiere_foto: Boolean(payload.requiere_foto), medicion_valor: payload.medicion_valor || null, accion_realizada: payload.accion_realizada || null, defecto: payload.defecto || null, estado_despues: payload.estado_despues || null, recomendacion: payload.recomendacion || null, updated_at: new Date().toISOString() }).eq('id', item.id).eq('tenant_id', item.tenant_id).select().single();
  if (error) throw error;
  await logAudit({ tenantId: item.tenant_id, action: 'update_work_order_checklist_item', entityType: 'ot_checklist_respuesta', entityId: item.id, metadata: { otId: item.ot_id, result: payload.resultado } });
  return data;
}

export async function deleteChecklistItem(item) {
  await assertWorkOrderOpen(item.tenant_id, item.ot_id);
  const { error } = await supabase.from('ot_checklist_respuestas').delete().eq('id', item.id).eq('tenant_id', item.tenant_id);
  if (error) throw error;
  await logAudit({ tenantId: item.tenant_id, action: 'delete_work_order_checklist_item', entityType: 'ot_checklist_respuesta', entityId: item.id, metadata: { otId: item.ot_id } });
}

export async function listChecklistPhotos(tenantId, checklistItemId) {
  const { data, error } = await supabase.from('ot_fotos').select('*, created_by_profile:profiles!ot_fotos_created_by_fkey(nombre,email)').eq('tenant_id', tenantId).eq('checklist_respuesta_id', checklistItemId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadChecklistPhoto({ workOrder, checklistItem, visitId = null, file, comentario = '', tipoFoto = 'otra' }) {
  assertEditable(workOrder);
  if (!file) throw new Error('Selecciona una foto.');
  const userId = await currentUserId();
  const path = buildStoragePath({ tenantId: workOrder.tenant_id, scope: 'ordenes-trabajo', scopeId: workOrder.id, folder: `checklist/${checklistItem.id}`, file });
  await uploadPrivateFile({ tenantId: workOrder.tenant_id, bucket: 'photos-private', path, file, metadata: { auditAction: 'upload_work_order_checklist_photo', entityType: 'ot_checklist_respuesta', entityId: checklistItem.id } });
  const insertPayload = { tenant_id: workOrder.tenant_id, ot_id: workOrder.id, visita_id: visitId || checklistItem.visita_id || null, checklist_respuesta_id: checklistItem.id, bucket: 'photos-private', path, file_name: file.name, mime_type: file.type, comentario: comentario || null, tipo_foto: tipoFoto || 'otra', size_bytes: file.size || null, created_by: userId };
  const { data, error } = await supabase.from('ot_fotos').insert(insertPayload).select().single();
  if (error) throw error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'register_work_order_checklist_photo', entityType: 'ot_foto', entityId: data.id, metadata: { otId: workOrder.id, checklistItemId: checklistItem.id } });
  return data;
}

export async function listVisitMaterials(tenantId, visitId) {
  const { data, error } = await supabase.from('ot_visita_materiales').select('*, created_by_profile:profiles!ot_visita_materiales_created_by_fkey(nombre,email)').eq('tenant_id', tenantId).eq('visita_id', visitId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listWorkOrderMaterials(tenantId, workOrderId) {
  const { data, error } = await supabase.from('ot_visita_materiales').select('*, created_by_profile:profiles!ot_visita_materiales_created_by_fkey(nombre,email), visita:ot_visitas(fecha_inicio,fecha_fin,estado)').eq('tenant_id', tenantId).eq('ot_id', workOrderId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createVisitMaterial(workOrder, visit, payload) {
  assertEditable(workOrder);
  if (!payload.descripcion_libre && !payload.material_id) throw new Error('Indica material o descripcion libre.');
  const userId = await currentUserId();
  const { data, error } = await supabase.from('ot_visita_materiales').insert({ tenant_id: workOrder.tenant_id, ot_id: workOrder.id, visita_id: visit?.id || null, material_id: payload.material_id || null, descripcion_libre: payload.descripcion_libre || null, referencia: payload.referencia || null, cantidad: payload.cantidad ? Number(payload.cantidad) : 1, unidad: payload.unidad || 'ud', tipo_movimiento: payload.tipo_movimiento || 'utilizado', numero_serie: payload.numero_serie || null, observaciones: payload.observaciones || null, created_by: userId }).select().single();
  if (error) throw error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'create_work_order_visit_material', entityType: 'ot_visita_material', entityId: data.id, metadata: { otId: workOrder.id, visitId: visit?.id || null } });
  return data;
}

export async function signedChecklistPhotoUrl(photo, expiresIn = 600) {
  if (photo?.data_url) return photo.data_url;
  if (!photo?.bucket || !photo?.path) return '';
  return createSignedUrl({ tenantId: photo.tenant_id, bucket: photo.bucket, path: photo.path, entityType: 'ot_foto', entityId: photo.id, expiresIn });
}

