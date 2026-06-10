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
export const WORK_ORDER_TYPES = ['averia', 'mantenimiento', 'revision', 'instalacion', 'inspeccion', 'otro'];
export const CHECKLIST_RESULTS = ['pendiente', 'ok', 'no_ok', 'no_aplica'];

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

function normalizePayload(payload) {
  return {
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    titulo: payload.titulo,
    descripcion: payload.descripcion || null,
    tipo: payload.tipo || 'mantenimiento',
    prioridad: payload.prioridad || 'media',
    estado: payload.estado || 'ASIGNADA',
    assigned_to: payload.assigned_to || null,
    fecha_prevista: payload.fecha_prevista ? new Date(payload.fecha_prevista).toISOString() : null
  };
}

export async function listWorkOrders(tenantId, { onlyMine = false } = {}) {
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (onlyMine) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) query = query.eq('assigned_to', userData.user.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getWorkOrder(tenantId, id) {
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre,direccion,contacto_nombre,contacto_telefono,contacto_email), ubicaciones(nombre), activos(nombre,tipo,marca,modelo,numero_serie), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email), creator:profiles!ordenes_trabajo_created_by_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createWorkOrder(tenantId, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const normalized = normalizePayload(payload);
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
  const normalized = normalizePayload({ ...row, ...payload });
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
  const patch = { estado: status };
  if (status === 'EN_CURSO' && !row.fecha_inicio) patch.fecha_inicio = new Date().toISOString();
  if (['FINALIZADA', 'FIRMADA', 'INFORME_GENERADO', 'CERRADA'].includes(status) && !row.fecha_fin) patch.fecha_fin = new Date().toISOString();

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

export async function startWorkOrderVisit(row, location = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  const { data, error } = await supabase
    .from('ot_visitas')
    .insert({
      tenant_id: row.tenant_id,
      ot_id: row.id,
      tecnico_id: userId,
      estado: 'EN_CURSO',
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
  const { data, error } = await supabase
    .from('ot_visitas')
    .update({
      observaciones: payload.observaciones || null,
      latitud: payload.latitud || row.latitud || null,
      longitud: payload.longitud || row.longitud || null
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_work_order_visit', entityType: 'ot_visita', entityId: row.id, metadata: { otId: row.ot_id } });
  return data;
}

export async function finishWorkOrderVisit(visit, finalObservations = '') {
  const { data, error } = await supabase
    .from('ot_visitas')
    .update({
      estado: 'FINALIZADA',
      fecha_fin: new Date().toISOString(),
      observaciones: finalObservations || visit.observaciones || null
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

  if (workOrder && !['FIRMADA', 'INFORME_GENERADO', 'CERRADA'].includes(workOrder.estado)) {
    await updateWorkOrderStatus(workOrder, 'FINALIZADA');
  }

  await logAudit({ tenantId: visit.tenant_id, action: 'finish_work_order_visit', entityType: 'ot_visita', entityId: visit.id, metadata: { otId: visit.ot_id } });
  return data;
}

export async function listWorkOrderChecklist(tenantId, workOrderId) {
  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ot_id', workOrderId)
    .order('orden', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function ensureDefaultChecklist(row) {
  const existing = await listWorkOrderChecklist(row.tenant_id, row.id);
  if (existing.length > 0) return existing;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;
  const payload = DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
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
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'create_work_order_checklist_item', entityType: 'ot_checklist_respuesta', entityId: data.id, metadata: { otId: row.id } });
  return data;
}

export async function updateChecklistItem(item, payload) {
  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .update({
      visita_id: payload.visita_id || item.visita_id || null,
      resultado: payload.resultado || item.resultado || 'pendiente',
      observacion: payload.observacion || null,
      requiere_foto: Boolean(payload.requiere_foto),
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

export async function uploadChecklistPhoto({ workOrder, checklistItem, visitId = null, file, comentario = '' }) {
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
      comentario: comentario || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: workOrder.tenant_id, action: 'register_work_order_checklist_photo', entityType: 'ot_foto', entityId: data.id, metadata: { otId: workOrder.id, checklistItemId: checklistItem.id } });
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
