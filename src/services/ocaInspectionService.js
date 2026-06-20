import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { calculateNextOcaDate } from '../constants/oca';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function normalizeInspectionPayload(payload) {
  const nextDate = payload.fecha_proxima_inspeccion || calculateNextOcaDate(payload.fecha_realizada, payload.periodicidad_aplicada, payload.periodicidad_unidad);
  return {
    control_oca_id: payload.control_oca_id,
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    codigo: payload.codigo || null,
    tipo_inspeccion: payload.tipo_inspeccion || 'periodica',
    fecha_programada: payload.fecha_programada || null,
    fecha_realizada: payload.fecha_realizada || null,
    organismo_control: payload.organismo_control || null,
    inspector_nombre: payload.inspector_nombre || null,
    numero_expediente: payload.numero_expediente || null,
    numero_acta: payload.numero_acta || null,
    resultado: payload.resultado || 'pendiente',
    estado: payload.estado || (payload.fecha_realizada ? 'realizada' : 'programada'),
    periodicidad_aplicada: payload.periodicidad_aplicada ? Number(payload.periodicidad_aplicada) : null,
    periodicidad_unidad: payload.periodicidad_unidad || 'anos',
    fecha_proxima_inspeccion: nextDate || null,
    observaciones: payload.observaciones || null,
    conclusiones: payload.conclusiones || null
  };
}

const INSPECTION_SELECT = '*, controles_oca(nombre,especialidad), instalaciones(nombre), ubicaciones(nombre), activos(nombre)';

export async function listOcaInspections(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('inspecciones_oca')
    .select(INSPECTION_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('fecha_realizada', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function getOcaInspection(tenantId, id) {
  const { data, error } = await supabase
    .from('inspecciones_oca')
    .select(INSPECTION_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createOcaInspection(tenantId, payload) {
  if (!tenantId) throw new Error('No hay cliente activo.');
  const userId = await currentUserId();
  const normalized = normalizeInspectionPayload(payload);
  const { data, error } = await supabase
    .from('inspecciones_oca')
    .insert({ tenant_id: tenantId, ...normalized, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  await syncControlAfterInspection(tenantId, data);
  await logAudit({ tenantId, action: 'create_oca_inspection', entityType: 'inspeccion_oca', entityId: data.id, metadata: { resultado: data.resultado } });
  return data;
}

export async function updateOcaInspection(inspection, payload) {
  const normalized = normalizeInspectionPayload(payload);
  const { data, error } = await supabase
    .from('inspecciones_oca')
    .update(normalized)
    .eq('tenant_id', inspection.tenant_id)
    .eq('id', inspection.id)
    .select()
    .single();
  if (error) throw error;
  await syncControlAfterInspection(inspection.tenant_id, data);
  await logAudit({ tenantId: inspection.tenant_id, action: 'update_oca_inspection', entityType: 'inspeccion_oca', entityId: inspection.id });
  return data;
}

export async function closeOcaInspection(inspection) {
  const { data, error } = await supabase
    .from('inspecciones_oca')
    .update({ estado: 'cerrada' })
    .eq('tenant_id', inspection.tenant_id)
    .eq('id', inspection.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: inspection.tenant_id, action: 'close_oca_inspection', entityType: 'inspeccion_oca', entityId: inspection.id });
  return data;
}

export async function softDeleteOcaInspection(inspection) {
  const { error } = await supabase
    .from('inspecciones_oca')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', inspection.tenant_id)
    .eq('id', inspection.id);
  if (error) throw error;
  await logAudit({ tenantId: inspection.tenant_id, action: 'delete_oca_inspection', entityType: 'inspeccion_oca', entityId: inspection.id });
}

export async function syncControlAfterInspection(tenantId, inspection) {
  if (!inspection?.control_oca_id) return null;
  const estado = inspection.resultado === 'desfavorable'
    ? 'desfavorable'
    : ['condicionada', 'favorable_observaciones'].includes(inspection.resultado)
      ? 'con_incidencias'
      : inspection.fecha_proxima_inspeccion
        ? 'al_dia'
        : 'sin_datos';
  const { data, error } = await supabase
    .from('controles_oca')
    .update({
      fecha_ultima_inspeccion: inspection.fecha_realizada || null,
      fecha_proxima_inspeccion: inspection.fecha_proxima_inspeccion || null,
      periodicidad_valor: inspection.periodicidad_aplicada || null,
      periodicidad_unidad: inspection.periodicidad_unidad || 'anos',
      estado
    })
    .eq('tenant_id', tenantId)
    .eq('id', inspection.control_oca_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
