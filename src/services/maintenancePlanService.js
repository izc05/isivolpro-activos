import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { nextDateFrom, statusForScheduledDate } from '../constants/maintenance';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function normalizeJson(value, fallback = []) {
  if (!value) return fallback;
  return Array.isArray(value) ? value : fallback;
}

function normalizePlanPayload(payload) {
  const nextDate = payload.fecha_proxima_realizacion || nextDateFrom(payload.fecha_inicio, payload.periodicidad_valor, payload.periodicidad_unidad);
  return {
    instalacion_id: payload.instalacion_id,
    ubicacion_id: payload.ubicacion_id || null,
    activo_id: payload.activo_id,
    nombre: payload.nombre?.trim(),
    descripcion: payload.descripcion || null,
    tipo: payload.tipo || 'preventivo',
    categoria: payload.categoria || null,
    periodicidad_valor: payload.periodicidad_valor ? Number(payload.periodicidad_valor) : null,
    periodicidad_unidad: payload.periodicidad_unidad || 'meses',
    fecha_inicio: payload.fecha_inicio || null,
    fecha_ultima_realizacion: payload.fecha_ultima_realizacion || null,
    fecha_proxima_realizacion: nextDate || null,
    dias_aviso: payload.dias_aviso ? Number(payload.dias_aviso) : 15,
    tolerancia_dias: payload.tolerancia_dias ? Number(payload.tolerancia_dias) : 0,
    prioridad: payload.prioridad || 'media',
    responsable_id: payload.responsable_id || null,
    tiempo_estimado_minutos: payload.tiempo_estimado_minutos ? Number(payload.tiempo_estimado_minutos) : null,
    instrucciones: payload.instrucciones || null,
    checklist_json: normalizeJson(payload.checklist_json),
    materiales_previstos_json: normalizeJson(payload.materiales_previstos_json),
    herramientas_json: normalizeJson(payload.herramientas_json),
    auto_generar_ot: Boolean(payload.auto_generar_ot),
    activo: payload.activo ?? true
  };
}

export async function listMaintenancePlans(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('planes_mantenimiento')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre,tipo,criticidad), responsable:profiles!planes_mantenimiento_responsable_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('fecha_proxima_realizacion', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getMaintenancePlan(tenantId, id) {
  const { data, error } = await supabase
    .from('planes_mantenimiento')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre,tipo,criticidad), responsable:profiles!planes_mantenimiento_responsable_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMaintenancePlan(tenantId, payload) {
  if (!tenantId) throw new Error('No hay cliente activo.');
  const userId = await currentUserId();
  const normalized = normalizePlanPayload(payload);
  const { data, error } = await supabase
    .from('planes_mantenimiento')
    .insert({ tenant_id: tenantId, ...normalized, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId, action: 'create_maintenance_plan', entityType: 'plan_mantenimiento', entityId: data.id, metadata: { tipo: data.tipo } });
  return data;
}

export async function updateMaintenancePlan(plan, payload) {
  const normalized = normalizePlanPayload(payload);
  const { data, error } = await supabase
    .from('planes_mantenimiento')
    .update(normalized)
    .eq('tenant_id', plan.tenant_id)
    .eq('id', plan.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: plan.tenant_id, action: 'update_maintenance_plan', entityType: 'plan_mantenimiento', entityId: plan.id });
  return data;
}

export async function duplicateMaintenancePlan(plan) {
  const userId = await currentUserId();
  const copy = {
    tenant_id: plan.tenant_id,
    instalacion_id: plan.instalacion_id,
    ubicacion_id: plan.ubicacion_id || null,
    activo_id: plan.activo_id,
    nombre: `${plan.nombre} (copia)`,
    descripcion: plan.descripcion,
    tipo: plan.tipo,
    categoria: plan.categoria,
    periodicidad_valor: plan.periodicidad_valor,
    periodicidad_unidad: plan.periodicidad_unidad,
    fecha_inicio: plan.fecha_inicio,
    fecha_ultima_realizacion: null,
    fecha_proxima_realizacion: plan.fecha_proxima_realizacion,
    dias_aviso: plan.dias_aviso,
    tolerancia_dias: plan.tolerancia_dias,
    prioridad: plan.prioridad,
    responsable_id: plan.responsable_id,
    tiempo_estimado_minutos: plan.tiempo_estimado_minutos,
    instrucciones: plan.instrucciones,
    checklist_json: plan.checklist_json || [],
    materiales_previstos_json: plan.materiales_previstos_json || [],
    herramientas_json: plan.herramientas_json || [],
    auto_generar_ot: plan.auto_generar_ot,
    activo: false,
    created_by: userId
  };
  const { data, error } = await supabase.from('planes_mantenimiento').insert(copy).select().single();
  if (error) throw error;
  await logAudit({ tenantId: plan.tenant_id, action: 'duplicate_maintenance_plan', entityType: 'plan_mantenimiento', entityId: data.id, metadata: { sourcePlanId: plan.id } });
  return data;
}

export async function setMaintenancePlanActive(plan, active) {
  const { data, error } = await supabase
    .from('planes_mantenimiento')
    .update({ activo: Boolean(active) })
    .eq('tenant_id', plan.tenant_id)
    .eq('id', plan.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: plan.tenant_id, action: active ? 'activate_maintenance_plan' : 'deactivate_maintenance_plan', entityType: 'plan_mantenimiento', entityId: plan.id });
  return data;
}

export async function softDeleteMaintenancePlan(plan) {
  const { error } = await supabase
    .from('planes_mantenimiento')
    .update({ deleted_at: new Date().toISOString(), activo: false })
    .eq('tenant_id', plan.tenant_id)
    .eq('id', plan.id);
  if (error) throw error;
  await logAudit({ tenantId: plan.tenant_id, action: 'delete_maintenance_plan', entityType: 'plan_mantenimiento', entityId: plan.id });
}

export async function recalculateMaintenancePlanNextDate(plan, baseDate = null) {
  const nextDate = nextDateFrom(baseDate || plan.fecha_ultima_realizacion || plan.fecha_inicio, plan.periodicidad_valor, plan.periodicidad_unidad);
  const { data, error } = await supabase
    .from('planes_mantenimiento')
    .update({ fecha_proxima_realizacion: nextDate })
    .eq('tenant_id', plan.tenant_id)
    .eq('id', plan.id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: plan.tenant_id, action: 'recalculate_maintenance_plan_next_date', entityType: 'plan_mantenimiento', entityId: plan.id, metadata: { nextDate } });
  return data;
}

export async function generateScheduledFromPlan(plan) {
  if (!plan?.fecha_proxima_realizacion) throw new Error('El plan no tiene próxima fecha calculada.');
  const userId = await currentUserId();
  const fechaLimite = plan.tolerancia_dias
    ? nextDateFrom(plan.fecha_proxima_realizacion, plan.tolerancia_dias, 'dias')
    : null;
  const payload = {
    tenant_id: plan.tenant_id,
    plan_id: plan.id,
    instalacion_id: plan.instalacion_id,
    ubicacion_id: plan.ubicacion_id || null,
    activo_id: plan.activo_id,
    titulo: plan.nombre,
    descripcion: plan.descripcion || plan.instrucciones || null,
    tipo: plan.tipo,
    estado: statusForScheduledDate(plan.fecha_proxima_realizacion),
    prioridad: plan.prioridad || 'media',
    fecha_programada: plan.fecha_proxima_realizacion,
    fecha_limite: fechaLimite,
    assigned_to: plan.responsable_id || null,
    origen: 'plan',
    created_by: userId
  };
  const { data, error } = await supabase
    .from('mantenimientos_programados')
    .upsert(payload, { onConflict: 'plan_id,fecha_programada', ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: plan.tenant_id, action: 'generate_scheduled_maintenance', entityType: 'mantenimiento_programado', entityId: data.id, metadata: { planId: plan.id } });
  return data;
}
