import { supabase } from './supabaseClient';
import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';
import { isWorkOrderReadOnly } from '../utils/workOrderLifecycle';

export async function uploadVisitSignature({ workOrder, visit, file, nombreFirmante, dniFirmante = '', signatureType = 'cliente' }) {
  if (!workOrder?.id) throw new Error('No se ha encontrado la OT.');
  if (isWorkOrderReadOnly(workOrder)) throw new Error('La OT esta finalizada y no admite nuevas firmas.');
  if (!visit?.id) throw new Error('Selecciona una visita para firmar.');
  if (!file) throw new Error('No hay firma para guardar.');
  if (!nombreFirmante?.trim()) throw new Error('Introduce el nombre del firmante.');
  if (!['cliente', 'tecnico'].includes(signatureType)) throw new Error('Tipo de firma no válido.');

  const path = buildStoragePath({
    tenantId: workOrder.tenant_id,
    scope: 'ordenes-trabajo',
    scopeId: workOrder.id,
    folder: `firmas/${visit.id}/${signatureType}`,
    file
  });

  await uploadPrivateFile({
    tenantId: workOrder.tenant_id,
    bucket: 'photos-private',
    path,
    file,
    metadata: {
      auditAction: signatureType === 'tecnico' ? 'upload_work_order_technician_signature' : 'upload_work_order_customer_signature',
      entityType: 'ot_visita',
      entityId: visit.id
    }
  });

  const signaturePatch = signatureType === 'tecnico'
    ? { firma_tecnico_nombre: nombreFirmante.trim(), firma_tecnico_bucket: 'photos-private', firma_tecnico_path: path, firma_tecnico_at: new Date().toISOString() }
    : { nombre_firmante: nombreFirmante.trim(), dni_firmante: dniFirmante?.trim() || null, firma_bucket: 'photos-private', firma_path: path };
  const { data, error } = await supabase
    .from('ot_visitas')
    .update(signaturePatch)
    .eq('id', visit.id)
    .eq('tenant_id', workOrder.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    tenantId: workOrder.tenant_id,
    action: signatureType === 'tecnico' ? 'sign_work_order_visit_technician' : 'sign_work_order_visit_customer',
    entityType: 'ot_visita',
    entityId: visit.id,
    metadata: { otId: workOrder.id, nombreFirmante: nombreFirmante.trim(), signatureType }
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

export async function signedTechnicianSignatureUrl(visit, expiresIn = 600) {
  if (!visit?.firma_tecnico_bucket || !visit?.firma_tecnico_path) return '';
  return createSignedUrl({ tenantId: visit.tenant_id, bucket: visit.firma_tecnico_bucket, path: visit.firma_tecnico_path, entityType: 'ot_visita_firma_tecnico', entityId: visit.id, expiresIn });
}
