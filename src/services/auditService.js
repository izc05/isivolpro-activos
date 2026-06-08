import { supabase } from './supabaseClient';

export async function logAudit({ tenantId, action, entityType = null, entityId = null, metadata = {} }) {
  const { error } = await supabase.rpc('log_audit', {
    tenant_uuid: tenantId,
    action_text: action,
    entity_type_text: entityType,
    entity_uuid: entityId,
    metadata_json: {
      ...metadata,
      userAgent: navigator.userAgent,
      online: navigator.onLine
    }
  });

  if (error) {
    console.error('No se pudo registrar auditoria', error);
  }
}
