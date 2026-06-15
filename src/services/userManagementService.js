import { supabase } from './supabaseClient';

export async function getTenantMemberDetail(tenantId, memberId) {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('*, profiles(nombre,email,avatar_url,mfa_required,global_role,created_at,updated_at)')
    .eq('tenant_id', tenantId)
    .eq('id', memberId)
    .single();

  if (error) throw error;
  return data;
}

export async function listMemberWorkOrders(tenantId, userId) {
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email), creator:profiles!ordenes_trabajo_created_by_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function listMemberInstallationGrants(tenantId, userId) {
  const { data, error } = await supabase
    .from('installation_access_grants')
    .select('*, instalaciones(nombre,direccion)')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listMemberInvitations(tenantId, email) {
  if (!email) return [];
  const { data, error } = await supabase
    .from('tenant_invitations')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listMemberAuditLogs(tenantId, userId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

export async function loadUserManagementDetail(tenantId, memberId) {
  const member = await getTenantMemberDetail(tenantId, memberId);
  const [workOrders, grants, invitations, auditLogs] = await Promise.all([
    listMemberWorkOrders(tenantId, member.user_id),
    listMemberInstallationGrants(tenantId, member.user_id),
    listMemberInvitations(tenantId, member.profiles?.email),
    listMemberAuditLogs(tenantId, member.user_id)
  ]);

  return { member, workOrders, grants, invitations, auditLogs };
}
