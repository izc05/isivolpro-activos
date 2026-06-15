import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { isWorkOrderClosed, normalizedStatus } from '../utils/workOrderLifecycle';

function assertCanMove(row, status) {
  const current = normalizedStatus(row?.estado);
  if (isWorkOrderClosed(current) && status !== 'REABRIR') {
    throw new Error('La OT esta cerrada y es de solo lectura. Para modificarla debe reabrirse con motivo y permisos.');
  }
}

export async function updateWorkOrderLifecycleStatus(row, status, options = {}) {
  assertCanMove(row, status);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  if (status === 'REABRIR') {
    const patch = {
      estado: 'EN_CURSO',
      reopened_by: userId,
      reopened_at: new Date().toISOString(),
      reopen_reason: options.reopenReason || 'Reapertura manual',
      fecha_fin: null
    };
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .update(patch)
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id)
      .select()
      .single();
    if (error) throw error;
    await logAudit({ tenantId: row.tenant_id, action: 'reopen_work_order', entityType: 'orden_trabajo', entityId: row.id, metadata: { from: row.estado, to: 'EN_CURSO', reason: patch.reopen_reason } });
    return data;
  }

  const patch = { estado: status };
  if (status === 'EN_CURSO' && !row.fecha_inicio) patch.fecha_inicio = new Date().toISOString();
  if (status === 'FINALIZADA' && !row.fecha_fin) patch.fecha_fin = new Date().toISOString();
  if (status === 'VALIDADA') {
    patch.fecha_fin = row.fecha_fin || new Date().toISOString();
    patch.closed_by = userId;
    patch.closed_at = new Date().toISOString();
  }
  if (status === 'CANCELADA') {
    patch.fecha_fin = row.fecha_fin || new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(patch)
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_work_order_status', entityType: 'orden_trabajo', entityId: row.id, metadata: { from: row.estado, to: status } });
  return data;
}
