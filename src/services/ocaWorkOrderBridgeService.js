import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { createWorkOrder } from './workOrderService';
import { setOcaIncidentState } from './ocaIncidentService';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function listOcaIncidentWorkOrders(tenantId, incidentId) {
  if (!tenantId || !incidentId) return [];
  const { data, error } = await supabase
    .from('incidencia_oca_ot')
    .select('*, ordenes_trabajo(id,codigo_ot,titulo,estado,prioridad,fecha_prevista,assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email))')
    .eq('tenant_id', tenantId)
    .eq('incidencia_oca_id', incidentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listOcaWorkOrdersForInspection(tenantId, inspectionId) {
  if (!tenantId || !inspectionId) return [];
  const { data, error } = await supabase
    .from('incidencia_oca_ot')
    .select('*, incidencias_oca!inner(id,inspeccion_oca_id,titulo), ordenes_trabajo(id,codigo_ot,titulo,estado,prioridad,fecha_prevista)')
    .eq('tenant_id', tenantId)
    .eq('incidencias_oca.inspeccion_oca_id', inspectionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function linkOcaIncidentToWorkOrder(tenantId, incidentId, workOrderId) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('incidencia_oca_ot')
    .upsert({
      tenant_id: tenantId,
      incidencia_oca_id: incidentId,
      ot_id: workOrderId,
      created_by: userId,
      deleted_at: null
    }, { onConflict: 'incidencia_oca_id,ot_id' })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId, action: 'link_oca_incident_work_order', entityType: 'incidencia_oca_ot', entityId: data.id, metadata: { incidentId, workOrderId } });
  return data;
}

export async function createOcaCorrectiveWorkOrder(tenantId, incident, payload = {}) {
  const workOrder = await createWorkOrder(tenantId, {
    instalacion_id: incident.instalacion_id,
    ubicacion_id: incident.ubicacion_id || null,
    activo_id: incident.activo_id || null,
    titulo: payload.titulo || `Subsanación OCA: ${incident.titulo}`,
    descripcion: payload.descripcion || incident.descripcion,
    tipo: 'mantenimiento_correctivo',
    prioridad: payload.prioridad || (['grave', 'muy_grave'].includes(incident.clasificacion) ? 'alta' : 'media'),
    estado: 'ASIGNADA',
    assigned_to: payload.assigned_to || incident.responsable_id || null,
    fecha_prevista: payload.fecha_prevista || incident.fecha_limite || null,
    fecha_limite: incident.fecha_limite || null,
    instrucciones_tecnico: payload.instrucciones_tecnico || `Incidencia OCA ${incident.codigo || incident.id}: ${incident.descripcion}`,
    resultado_esperado: 'Incidencia OCA subsanada y documentada con evidencias.'
  });
  await linkOcaIncidentToWorkOrder(tenantId, incident.id, workOrder.id);
  await setOcaIncidentState(incident, 'ot_creada');
  await logAudit({ tenantId, action: 'create_oca_corrective_work_order', entityType: 'orden_trabajo', entityId: workOrder.id, metadata: { incidentId: incident.id } });
  return workOrder;
}

export async function markOcaIncidentAfterWorkOrderClose(tenantId, incidentId, evidence = '') {
  const { data: incident, error } = await supabase
    .from('incidencias_oca')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', incidentId)
    .single();
  if (error) throw error;
  return setOcaIncidentState(incident, 'pendiente_verificacion', { evidencia_subsanacion: evidence || incident.evidencia_subsanacion || null });
}
