import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function listMaintenanceHistory(tenantId, filters = {}) {
  if (!tenantId) return [];
  let query = supabase
    .from('historial_mantenimiento')
    .select('*, activos(nombre,tipo), plan:planes_mantenimiento(nombre), mantenimiento:mantenimientos_programados(titulo), ordenes_trabajo(id,codigo_ot), incidencias(id,titulo), tecnico:profiles!historial_mantenimiento_tecnico_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (filters.activo_id) query = query.eq('activo_id', filters.activo_id);
  if (filters.tipo) query = query.eq('tipo', filters.tipo);
  if (filters.from) query = query.gte('fecha', filters.from);
  if (filters.to) query = query.lte('fecha', filters.to);
  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createManualMaintenanceHistory(tenantId, payload) {
  const userId = await currentUserId();
  const insert = {
    tenant_id: tenantId,
    activo_id: payload.activo_id,
    fecha: payload.fecha,
    tipo: payload.tipo || 'historico',
    titulo: payload.titulo,
    descripcion: payload.trabajo_realizado || payload.descripcion || null,
    origen: 'manual',
    fecha_inicio: payload.fecha_inicio || null,
    fecha_fin: payload.fecha_fin || null,
    trabajo_previsto: payload.trabajo_previsto || null,
    trabajo_realizado: payload.trabajo_realizado || payload.descripcion || null,
    resultado: payload.resultado || null,
    tecnico_id: payload.tecnico_id || userId,
    estado_final: payload.estado_final || null,
    estado_activo_final: payload.estado_final || null,
    coste_materiales: payload.coste_materiales ? Number(payload.coste_materiales) : 0,
    coste_mano_obra: payload.coste_mano_obra ? Number(payload.coste_mano_obra) : 0,
    coste_total: payload.coste_total ? Number(payload.coste_total) : Number(payload.coste_materiales || 0) + Number(payload.coste_mano_obra || 0),
    garantia_hasta: payload.garantia_hasta || null,
    proxima_accion: payload.proxima_accion || null,
    proxima_fecha: payload.proxima_fecha || null,
    observaciones: payload.observaciones || null,
    created_by: userId
  };
  const { data, error } = await supabase.from('historial_mantenimiento').insert(insert).select().single();
  if (error) throw error;
  await logAudit({ tenantId, action: 'create_manual_maintenance_history', entityType: 'historial_mantenimiento', entityId: data.id });
  return data;
}
