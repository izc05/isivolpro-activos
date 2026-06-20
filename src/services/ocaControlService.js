import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { calculateNextOcaDate } from '../constants/oca';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function normalizeControlPayload(payload) {
  const nextDate = payload.fecha_proxima_inspeccion || calculateNextOcaDate(payload.fecha_ultima_inspeccion, payload.periodicidad_valor, payload.periodicidad_unidad);
  return {
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id || null,
    nombre: payload.nombre?.trim(),
    especialidad: payload.especialidad || 'otra',
    tipo_instalacion: payload.tipo_instalacion || null,
    descripcion: payload.descripcion || null,
    periodicidad_valor: payload.periodicidad_valor ? Number(payload.periodicidad_valor) : null,
    periodicidad_unidad: payload.periodicidad_unidad || 'anos',
    fecha_ultima_inspeccion: payload.fecha_ultima_inspeccion || null,
    fecha_proxima_inspeccion: nextDate || null,
    dias_aviso: payload.dias_aviso ? Number(payload.dias_aviso) : 90,
    responsable_id: payload.responsable_id || null,
    estado: payload.estado || 'sin_datos',
    observaciones: payload.observaciones || null,
    activo: payload.activo ?? true
  };
}

export async function listOcaControls(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('controles_oca')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre), responsable:profiles!controles_oca_responsable_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('fecha_proxima_inspeccion', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function listOcaControlsByInstallation(tenantId, installationId) {
  if (!tenantId || !installationId) return [];
  const { data, error } = await supabase
    .from('controles_oca')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre)')
    .eq('tenant_id', tenantId)
    .eq('instalacion_id', installationId)
    .is('deleted_at', null)
    .order('especialidad', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getOcaControl(tenantId, id) {
  const { data, error } = await supabase
    .from('controles_oca')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre), responsable:profiles!controles_oca_responsable_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createOcaControl(tenantId, payload) {
  if (!tenantId) throw new Error('No hay cliente activo.');
  const userId = await currentUserId();
  const normalized = normalizeControlPayload(payload);
  const { data, error } = await supabase
    .from('controles_oca')
    .insert({ tenant_id: tenantId, ...normalized, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId, action: 'create_oca_control', entityType: 'control_oca', entityId: data.id, metadata: { especialidad: data.especialidad } });
  return data;
}

export async function updateOcaControl(control, payload) {
  const normalized = normalizeControlPayload(payload);
  const { data, error } = await supabase
    .from('controles_oca')
    .update(normalized)
    .eq('tenant_id', control.tenant_id)
    .eq('id', control.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: control.tenant_id, action: 'update_oca_control', entityType: 'control_oca', entityId: control.id });
  return data;
}

export async function softDeleteOcaControl(control) {
  const { error } = await supabase
    .from('controles_oca')
    .update({ deleted_at: new Date().toISOString(), activo: false })
    .eq('tenant_id', control.tenant_id)
    .eq('id', control.id);
  if (error) throw error;
  await logAudit({ tenantId: control.tenant_id, action: 'delete_oca_control', entityType: 'control_oca', entityId: control.id });
}
