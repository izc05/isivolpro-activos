import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

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
