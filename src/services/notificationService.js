import { supabase } from './supabaseClient';

export async function listAuditNotifications(tenantId, limit = 12) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id,tenant_id,user_id,action,entity_type,entity_id,metadata,created_at,profiles(email,nombre)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listTechnicianNotifications(tenantId, userId, limit = 12) {
  if (!tenantId || !userId) return [];
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('id,tenant_id,codigo_ot,titulo,estado,prioridad,fecha_prevista,updated_at,created_at,assigned_to,instalaciones(nombre),activos(nombre)')
    .eq('tenant_id', tenantId)
    .eq('assigned_to', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function subscribeToAuditNotifications(tenantId, onInsert) {
  if (!tenantId) return null;
  return supabase
    .channel(`audit-notifications:${tenantId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `tenant_id=eq.${tenantId}` },
      (payload) => onInsert?.(payload.new)
    )
    .subscribe();
}

export function subscribeToTechnicianWorkOrders(tenantId, userId, onChange) {
  if (!tenantId || !userId) return null;
  return supabase
    .channel(`technician-workorders:${tenantId}:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ordenes_trabajo', filter: `tenant_id=eq.${tenantId}` },
      (payload) => {
        const row = payload.new || payload.old;
        if (row?.assigned_to === userId) onChange?.(row);
      }
    )
    .subscribe();
}
