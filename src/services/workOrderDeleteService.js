import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

function isMissingRpc(error) {
  const message = String(error?.message || '');
  return error?.code === '42883' || message.includes('soft_delete_work_order') || message.includes('function');
}

export async function softDeleteWorkOrder(row, options = {}) {
  if (!row?.id || !row?.tenant_id) throw new Error('No se ha podido identificar la OT a anular.');
  const reason = String(options.reason || '').trim();
  if (!reason) throw new Error('Indica el motivo de anulación.');

  const rpc = await supabase.rpc('soft_delete_work_order', {
    work_order_uuid: row.id
  });

  if (!rpc.error) {
    await logAudit({
      tenantId: row.tenant_id,
      action: 'annul_work_order',
      entityType: 'orden_trabajo',
      entityId: row.id,
      metadata: {
        reason,
        previous_status: row.estado,
        soft_deleted: true,
        rpc: 'soft_delete_work_order'
      }
    });
    return rpc.data;
  }
  if (!isMissingRpc(rpc.error)) throw rpc.error;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({
      estado: 'CANCELADA',
      deleted_at: now,
      fecha_fin: row.fecha_fin || now,
      revision_admin_estado: 'no_requerida',
      revision_admin_notas: reason
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select('id')
    .single();

  if (error) throw error;
  await logAudit({
    tenantId: row.tenant_id,
    action: 'annul_work_order',
    entityType: 'orden_trabajo',
    entityId: row.id,
    metadata: {
      reason,
      previous_status: row.estado,
      soft_deleted: true,
      fallback: true
    }
  });
  return data?.id || row.id;
}
