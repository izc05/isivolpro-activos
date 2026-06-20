import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function normalizeIncidentPayload(payload) {
  return {
    inspeccion_oca_id: payload.inspeccion_oca_id,
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    codigo: payload.codigo || null,
    titulo: payload.titulo?.trim(),
    descripcion: payload.descripcion?.trim(),
    clasificacion: payload.clasificacion || 'observacion',
    fecha_deteccion: payload.fecha_deteccion || null,
    fecha_limite: payload.fecha_limite || null,
    estado: payload.estado || 'pendiente',
    responsable_id: payload.responsable_id || null,
    evidencia_subsanacion: payload.evidencia_subsanacion || null,
    observaciones: payload.observaciones || null
  };
}

const INCIDENT_SELECT = '*, inspecciones_oca(codigo,resultado,fecha_realizada,control_oca_id), instalaciones(nombre), ubicaciones(nombre), activos(nombre), responsable:profiles!incidencias_oca_responsable_id_fkey(nombre,email)';

export async function listOcaIncidents(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('incidencias_oca')
    .select(INCIDENT_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('fecha_limite', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function listOcaIncidentsForInspection(tenantId, inspectionId) {
  if (!tenantId || !inspectionId) return [];
  const { data, error } = await supabase
    .from('incidencias_oca')
    .select(INCIDENT_SELECT)
    .eq('tenant_id', tenantId)
    .eq('inspeccion_oca_id', inspectionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createOcaIncident(tenantId, payload) {
  if (!tenantId) throw new Error('No hay cliente activo.');
  const userId = await currentUserId();
  const normalized = normalizeIncidentPayload(payload);
  const { data, error } = await supabase
    .from('incidencias_oca')
    .insert({ tenant_id: tenantId, ...normalized, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  await markInspectionWithIncidents(tenantId, data.inspeccion_oca_id);
  await logAudit({ tenantId, action: 'create_oca_incident', entityType: 'incidencia_oca', entityId: data.id, metadata: { clasificacion: data.clasificacion } });
  return data;
}

export async function updateOcaIncident(incident, payload) {
  const normalized = normalizeIncidentPayload({ ...incident, ...payload });
  const { data, error } = await supabase
    .from('incidencias_oca')
    .update(normalized)
    .eq('tenant_id', incident.tenant_id)
    .eq('id', incident.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: 'update_oca_incident', entityType: 'incidencia_oca', entityId: incident.id });
  return data;
}

export async function setOcaIncidentState(incident, estado, extra = {}) {
  const now = new Date().toISOString();
  const patch = { estado, ...extra };
  if (estado === 'subsanada') patch.fecha_subsanacion = now;
  if (estado === 'pendiente_verificacion') patch.fecha_subsanacion = patch.fecha_subsanacion || now;
  if (estado === 'verificada') {
    patch.fecha_verificacion = now;
    patch.verificado_by = await currentUserId();
  }
  const { data, error } = await supabase
    .from('incidencias_oca')
    .update(patch)
    .eq('tenant_id', incident.tenant_id)
    .eq('id', incident.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: `oca_incident_${estado}`, entityType: 'incidencia_oca', entityId: incident.id });
  return data;
}

export async function softDeleteOcaIncident(incident) {
  const { error } = await supabase
    .from('incidencias_oca')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', incident.tenant_id)
    .eq('id', incident.id);
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: 'delete_oca_incident', entityType: 'incidencia_oca', entityId: incident.id });
}

async function markInspectionWithIncidents(tenantId, inspectionId) {
  if (!inspectionId) return;
  await supabase
    .from('inspecciones_oca')
    .update({ estado: 'con_incidencias' })
    .eq('tenant_id', tenantId)
    .eq('id', inspectionId)
    .in('estado', ['realizada', 'acta_pendiente', 'programada']);
}
