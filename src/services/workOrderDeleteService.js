import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

function isMissingRpc(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42883'
    || message.includes('soft_delete_work_order')
    || message.includes('function')
    || message.includes('reason_text')
    || message.includes('schema cache');
}

function isMissingColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703'
    || error?.code === 'PGRST204'
    || message.includes('revision_admin_estado')
    || message.includes('revision_admin_notas')
    || message.includes('column');
}

async function fallbackAnnulWorkOrder(row, reason) {
  const now = new Date().toISOString();
  const basePatch = {
    estado: 'CANCELADA',
    deleted_at: now,
    fecha_fin: row.fecha_fin || now
  };
  const reviewPatch = {
    ...basePatch,
    revision_admin_estado: 'no_requerida',
    revision_admin_notas: reason
  };

  let response = await supabase
    .from('ordenes_trabajo')
    .update(reviewPatch)
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select('id')
    .single();

  if (response.error && isMissingColumn(response.error)) {
    response = await supabase
      .from('ordenes_trabajo')
      .update(basePatch)
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id)
      .select('id')
      .single();
  }

  if (response.error) throw response.error;
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
  return response.data?.id || row.id;
}

export async function softDeleteWorkOrder(row, options = {}) {
  if (!row?.id || !row?.tenant_id) throw new Error('No se ha podido identificar la OT a anular.');
  const reason = String(options.reason || '').trim();
  if (!reason) throw new Error('Indica el motivo de anulación.');

  const rpc = await supabase.rpc('soft_delete_work_order', {
    work_order_uuid: row.id,
    reason_text: reason
  });

  if (!rpc.error) return rpc.data;
  if (!isMissingRpc(rpc.error)) throw rpc.error;

  return fallbackAnnulWorkOrder(row, reason);
}
