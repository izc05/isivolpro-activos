import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { isWorkOrderClosed, normalizedStatus } from '../utils/workOrderLifecycle';
import { closeMaintenanceFromWorkOrder } from './maintenanceOtBridgeService';

function assertCanMove(row, status) {
  const current = normalizedStatus(row?.estado);
  const target = normalizedStatus(status);
  if (target === 'FINALIZADA') {
    throw new Error('La OT solo puede finalizarse desde el cierre guiado, después de completar las firmas, el PDF y los demás requisitos obligatorios.');
  }
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
      revision_admin_estado: 'correccion_solicitada',
      revision_admin_notas: options.reopenReason || row.revision_admin_notas || null,
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
  if (status === 'FINALIZADA' && !row.fecha_fin) {
    patch.fecha_fin = new Date().toISOString();
    patch.revision_admin_estado = row.configuracion?.requiere_revision_admin ? 'pendiente' : row.revision_admin_estado || 'no_requerida';
  }
  if (status === 'VALIDADA') {
    patch.fecha_fin = row.fecha_fin || new Date().toISOString();
    patch.closed_by = userId;
    patch.closed_at = new Date().toISOString();
    patch.revision_admin_estado = 'validada';
    patch.revision_admin_by = userId;
    patch.revision_admin_at = new Date().toISOString();
    patch.revision_admin_notas = options.adminNotes || row.revision_admin_notas || null;
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
  await logAudit({
    tenantId: row.tenant_id,
    action: status === 'ACEPTADA' ? 'accept_work_order' : 'update_work_order_status',
    entityType: 'orden_trabajo',
    entityId: row.id,
    metadata: { from: row.estado, to: status, adminNotes: options.adminNotes || null }
  });
  if (['FINALIZADA', 'VALIDADA', 'CERRADA'].includes(status)) {
    await closeMaintenanceFromWorkOrder(data);
  }
  return data;
}
