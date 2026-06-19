import { supabase } from './supabaseClient';

export async function listRecentNotifications(tenantId, limit = 12) {
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

export function subscribeToNotifications(tenantId, onInsert) {
  if (!tenantId) return null;
  const channel = supabase
    .channel(`audit-notifications:${tenantId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `tenant_id=eq.${tenantId}` },
      (payload) => onInsert?.(payload.new)
    )
    .subscribe();

  return channel;
}
