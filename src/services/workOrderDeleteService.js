import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

function isMissingRpc(error) {
  const message = String(error?.message || '');
  return error?.code === '42883' || message.includes('soft_delete_work_order') || message.includes('function');
}

export async function softDeleteWorkOrder(row) {
  if (!row?.id || !row?.tenant_id) throw new Error('No se ha podido identificar la OT a borrar.');

  const rpc = await supabase.rpc('soft_delete_work_order', {
    work_order_uuid: row.id
  });

  if (!rpc.error) return rpc.data;
  if (!isMissingRpc(rpc.error)) throw rpc.error;

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({
      estado: 'CANCELADA',
      deleted_at: new Date().toISOString()
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select('id')
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'delete_work_order', entityType: 'orden_trabajo', entityId: row.id });
  return data?.id || row.id;
}
