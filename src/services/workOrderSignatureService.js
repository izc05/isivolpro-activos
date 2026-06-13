import { supabase } from './supabaseClient';
import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';
import { updateWorkOrderStatus } from './workOrderService';

export async function uploadVisitSignature({ workOrder, visit, file, nombreFirmante, dniFirmante = '' }) {
  if (!workOrder?.id) throw new Error('No se ha encontrado la OT.');
  if (workOrder.estado === 'CERRADA') throw new Error('La OT esta cerrada y no admite nuevas firmas.');
  if (!visit?.id) throw new Error('Selecciona una visita para firmar.');
  if (!file) throw new Error('No hay firma para guardar.');
  if (!nombreFirmante?.trim()) throw new Error('Introduce el nombre del firmante.');

  const path = buildStoragePath({
    tenantId: workOrder.tenant_id,
    scope: 'ordenes-trabajo',
    scopeId: workOrder.id,
    folder: `firmas/${visit.id}`,
    file
  });

  await uploadPrivateFile({
    tenantId: workOrder.tenant_id,
    bucket: 'photos-private',
    path,
    file,
    metadata: {
      auditAction: 'upload_work_order_customer_signature',
      entityType: 'ot_visita',
      entityId: visit.id
    }
  });

  const { data, error } = await supabase
    .from('ot_visitas')
    .update({
      nombre_firmante: nombreFirmante.trim(),
      dni_firmante: dniFirmante?.trim() || null,
      firma_bucket: 'photos-private',
      firma_path: path,
      fecha_fin: visit.fecha_fin || new Date().toISOString(),
      estado: visit.estado === 'EN_CURSO' ? 'FINALIZADA' : visit.estado
    })
    .eq('id', visit.id)
    .eq('tenant_id', workOrder.tenant_id)
    .select()
    .single();

  if (error) throw error;

  if (!['FIRMADA', 'INFORME_GENERADO', 'CERRADA'].includes(workOrder.estado)) {
    await updateWorkOrderStatus(workOrder, 'FIRMADA');
  }

  await logAudit({
    tenantId: workOrder.tenant_id,
    action: 'sign_work_order_visit',
    entityType: 'ot_visita',
    entityId: visit.id,
    metadata: { otId: workOrder.id, nombreFirmante: nombreFirmante.trim() }
  });

  return data;
}

export async function signedVisitSignatureUrl(visit, expiresIn = 600) {
  if (!visit?.firma_bucket || !visit?.firma_path) return '';
  return createSignedUrl({
    tenantId: visit.tenant_id,
    bucket: visit.firma_bucket,
    path: visit.firma_path,
    entityType: 'ot_visita_firma',
    entityId: visit.id,
    expiresIn
  });
}
