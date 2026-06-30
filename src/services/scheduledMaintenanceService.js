import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { createWorkOrder } from './workOrderService';
import { planChecklistToOtItems, statusForScheduledDate, workOrderStatusToMaintenanceStatus } from '../constants/maintenance';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function listScheduledMaintenances(tenantId, filters = {}) {
  if (!tenantId) return [];
  let query = supabase
    .from('mantenimientos_programados')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre,tipo,criticidad,estado), plan:planes_mantenimiento(nombre,periodicidad_valor,periodicidad_unidad,checklist_json), ordenes_trabajo(id,codigo_ot,estado,fecha_inicio,fecha_fin), assigned:profiles!mantenimientos_programados_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (filters.estado) query = query.eq('estado', filters.estado);
  if (filters.tipo) query = query.eq('tipo', filters.tipo);
  if (filters.activo_id) query = query.eq('activo_id', filters.activo_id);
  if (filters.instalacion_id) query = query.eq('instalacion_id', filters.instalacion_id);
  if (filters.from) query = query.gte('fecha_programada', filters.from);
  if (filters.to) query = query.lte('fecha_programada', filters.to);
  const { data, error } = await query.order('fecha_programada', { ascending: true });
  if (error) throw error;
  return (data || []).map(syncVisualStatus);
}

export async function getScheduledMaintenance(tenantId, id) {
  const { data, error } = await supabase
    .from('mantenimientos_programados')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre,tipo,criticidad,estado), plan:planes_mantenimiento(*), ordenes_trabajo(id,codigo_ot,estado), assigned:profiles!mantenimientos_programados_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();
  if (error) throw error;
  return syncVisualStatus(data);
}

export async function createScheduledMaintenance(tenantId, payload) {
  const userId = await currentUserId();
  const insert = {
    tenant_id: tenantId,
    plan_id: payload.plan_id || null,
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id,
    incidencia_id: payload.incidencia_id || null,
    titulo: payload.titulo?.trim(),
    descripcion: payload.descripcion || null,
    tipo: payload.tipo || 'preventivo',
    estado: payload.estado || statusForScheduledDate(payload.fecha_programada),
    prioridad: payload.prioridad || 'media',
    fecha_programada: payload.fecha_programada || null,
    fecha_limite: payload.fecha_limite || null,
    assigned_to: payload.assigned_to || null,
    origen: payload.origen || 'manual',
    created_by: userId
  };
  const { data, error } = await supabase.from('mantenimientos_programados').insert(insert).select().single();
  if (error) throw error;
  await logAudit({ tenantId, action: 'create_scheduled_maintenance', entityType: 'mantenimiento_programado', entityId: data.id, metadata: { origen: data.origen } });
  return data;
}

export async function updateScheduledMaintenance(row, payload) {
  const patch = {
    titulo: payload.titulo || row.titulo,
    descripcion: payload.descripcion ?? row.descripcion,
    estado: payload.estado || row.estado,
    prioridad: payload.prioridad || row.prioridad,
    fecha_programada: payload.fecha_programada || row.fecha_programada,
    fecha_limite: payload.fecha_limite ?? row.fecha_limite,
    assigned_to: payload.assigned_to ?? row.assigned_to
  };
  const { data, error } = await supabase
    .from('mantenimientos_programados')
    .update(patch)
    .eq('tenant_id', row.tenant_id)
    .eq('id', row.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_scheduled_maintenance', entityType: 'mantenimiento_programado', entityId: row.id });
  return data;
}

export async function cancelScheduledMaintenance(row, reason = '') {
  const { data, error } = await supabase
    .from('mantenimientos_programados')
    .update({ estado: 'cancelado', cancelled_at: new Date().toISOString(), motivo_cancelacion: reason || null })
    .eq('tenant_id', row.tenant_id)
    .eq('id', row.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'cancel_scheduled_maintenance', entityType: 'mantenimiento_programado', entityId: row.id, metadata: { reason } });
  return data;
}

export async function markScheduledNotApplicable(row, reason = '') {
  const { data, error } = await supabase
    .from('mantenimientos_programados')
    .update({ estado: 'no_aplica', completed_at: new Date().toISOString(), motivo_cancelacion: reason || null })
    .eq('tenant_id', row.tenant_id)
    .eq('id', row.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'mark_scheduled_maintenance_not_applicable', entityType: 'mantenimiento_programado', entityId: row.id });
  return data;
}

export async function generateWorkOrderForScheduledMaintenance(row) {
  if (row.ot_id) throw new Error('Esta actuación ya tiene una OT vinculada.');
  const type = row.tipo === 'correctivo' ? 'mantenimiento_correctivo' : row.tipo === 'sustitucion' ? 'sustitucion' : 'mantenimiento_preventivo';
  const workOrder = await createWorkOrder(row.tenant_id, {
    instalacion_id: row.instalacion_id,
    ubicacion_id: row.ubicacion_id || null,
    activo_id: row.activo_id,
    titulo: row.titulo,
    descripcion: row.descripcion || null,
    tipo: type,
    tipo_ot: type,
    prioridad: row.prioridad || 'media',
    assigned_to: row.assigned_to || null,
    fecha_prevista: row.fecha_programada || '',
    fecha_limite: row.fecha_limite || '',
    trabajo_solicitado: row.descripcion || row.titulo,
    instrucciones_tecnico: row.plan?.instrucciones || null,
    estado: row.assigned_to ? 'ASIGNADA' : 'NUEVA'
  });

  const checklistItems = planChecklistToOtItems(row.plan?.checklist_json);
  if (checklistItems.length) {
    await supabase.from('ot_checklist_respuestas').delete().eq('tenant_id', row.tenant_id).eq('ot_id', workOrder.id);
    const { error: checklistError } = await supabase.from('ot_checklist_respuestas').insert(checklistItems.map((item, index) => ({
      tenant_id: row.tenant_id,
      ot_id: workOrder.id,
      orden: index + 1,
      punto: item.punto,
      descripcion: item.descripcion,
      requiere_foto: item.requiere_foto,
      obligatorio: item.obligatorio,
      tipo_respuesta: item.tipo_respuesta,
      unidad: item.unidad,
      valor_minimo: item.valor_minimo,
      valor_maximo: item.valor_maximo,
      plantilla_item_id: item.plantilla_item_id,
      resultado: 'pendiente',
      created_by: workOrder.created_by || null
    })));
    if (checklistError) throw checklistError;
    const { error: snapshotError } = await supabase.from('ordenes_trabajo').update({
      checklist_snapshot: checklistItems.map((item, index) => ({ ...item, orden: index + 1 })),
      checklist_snapshot_version: 1,
      checklist_snapshot_at: new Date().toISOString()
    }).eq('tenant_id', row.tenant_id).eq('id', workOrder.id);
    if (snapshotError) throw snapshotError;
  }

  const { data, error } = await supabase
    .from('mantenimientos_programados')
    .update({ ot_id: workOrder.id, estado: workOrderStatusToMaintenanceStatus(workOrder.estado) || 'ot_generada' })
    .eq('tenant_id', row.tenant_id)
    .eq('id', row.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'generate_maintenance_work_order', entityType: 'mantenimiento_programado', entityId: row.id, metadata: { otId: workOrder.id } });
  return { scheduled: data, workOrder };
}

function syncVisualStatus(row) {
  const linkedStatus = workOrderStatusToMaintenanceStatus(row?.ordenes_trabajo?.estado);
  if (!linkedStatus) return row;
  return { ...row, estado_visual: linkedStatus };
}
