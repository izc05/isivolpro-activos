import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

export async function createTenantInvitation({ tenantId, nombre, email, role, mfaRequired }) {
  const { data, error } = await supabase.rpc('create_tenant_invitation', {
    tenant_uuid: tenantId,
    invite_name: nombre || null,
    invite_email: email,
    invite_role: role,
    require_mfa: mfaRequired
  });

  if (error) throw error;
  return data?.[0];
}

export async function acceptTenantInvitation(token) {
  const { data, error } = await supabase.rpc('accept_tenant_invitation', {
    invitation_token: token
  });

  if (error) throw error;
  return data;
}

export async function listTenantInvitations(tenantId) {
  const { data, error } = await supabase
    .from('tenant_invitations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateTenantMember({ tenantId, memberId, role, estado }) {
  const { data, error } = await supabase
    .from('tenant_members')
    .update({ role, estado })
    .eq('id', memberId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'update_member_role', entityType: 'tenant_member', entityId: memberId, metadata: { role, estado } });
  return data;
}

function isMissingRpc(error, rpcName) {
  const message = String(error?.message || '');
  return error?.code === '42883' || message.includes(rpcName) || message.includes('function');
}

export async function setTenantMemberStatus({ tenantId, memberId, estado }) {
  const rpc = await supabase.rpc('set_tenant_member_status', {
    member_uuid: memberId,
    status_text: estado
  });

  if (!rpc.error) return rpc.data;
  if (!isMissingRpc(rpc.error, 'set_tenant_member_status')) throw rpc.error;

  const { data, error } = await supabase
    .from('tenant_members')
    .update({ estado })
    .eq('id', memberId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'update_member_status', entityType: 'tenant_member', entityId: memberId, metadata: { estado } });
  return data;
}

export async function deactivateTenantMember(row) {
  return setTenantMemberStatus({ tenantId: row.tenant_id, memberId: row.id, estado: 'inactivo' });
}

export async function activateTenantMember(row) {
  return setTenantMemberStatus({ tenantId: row.tenant_id, memberId: row.id, estado: 'activo' });
}

export async function revokeInvitation(row) {
  const { error } = await supabase
    .from('tenant_invitations')
    .update({ estado: 'revocada', revoked_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id);

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'revoke_invitation', entityType: 'tenant_invitation', entityId: row.id });
}

export async function setMemberMfaRequired(userId, required) {
  const { error } = await supabase.rpc('set_member_mfa_required', {
    member_user_id: userId,
    require_mfa: required
  });

  if (error) throw error;
}

export async function listInstallationAccessGrants(tenantId) {
  const { data, error } = await supabase
    .from('installation_access_grants')
    .select('*, profiles(nombre,email), instalaciones(nombre)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createInstallationAccessGrant(payload) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('installation_access_grants')
    .insert({
      tenant_id: payload.tenantId,
      instalacion_id: payload.instalacionId,
      user_id: payload.userId,
      role: payload.role || 'tecnico_temporal',
      can_view: true,
      can_create_incident: Boolean(payload.canCreateIncident),
      can_upload_media: Boolean(payload.canUploadMedia),
      can_download_files: Boolean(payload.canDownloadFiles),
      can_edit_data: Boolean(payload.canEditData),
      starts_at: payload.startsAt || new Date().toISOString(),
      expires_at: payload.expiresAt || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({
    tenantId: payload.tenantId,
    action: 'create_installation_access',
    entityType: 'installation_access_grant',
    entityId: data.id,
    metadata: {
      instalacion_id: payload.instalacionId,
      user_id: payload.userId,
      expires_at: payload.expiresAt || null,
      can_download_files: Boolean(payload.canDownloadFiles),
      can_edit_data: Boolean(payload.canEditData)
    }
  });
  return data;
}

export async function revokeInstallationAccessGrant(row) {
  const { error } = await supabase
    .from('installation_access_grants')
    .update({ estado: 'revocado', revoked_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id);

  if (error) throw error;
  await logAudit({
    tenantId: row.tenant_id,
    action: 'revoke_installation_access',
    entityType: 'installation_access_grant',
    entityId: row.id,
    metadata: { instalacion_id: row.instalacion_id, user_id: row.user_id }
  });
}
