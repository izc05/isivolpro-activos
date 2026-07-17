import { supabase } from './supabaseClient';
import { FINISHED_WORK_ORDER_STATUSES, normalizedStatus } from '../utils/workOrderLifecycle';

export async function loadWorkOrderFinalReview(tenantId, workOrderId) {
  const [checklistRes, visitsRes, materialsRes, photosRes, reportsRes, qrRes, reviewsRes] = await Promise.all([
    supabase.from('ot_checklist_respuestas').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId),
    supabase.from('ot_visitas').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId),
    supabase.from('ot_visita_materiales').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId),
    supabase.from('ot_fotos').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId),
    supabase.from('ot_informes').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId),
    supabase.from('ot_verificaciones_qr').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId).eq('resultado', 'correcto'),
    supabase.from('ot_revisiones_admin').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId).order('created_at', { ascending: false })
  ]);

  const firstError = [checklistRes.error, visitsRes.error, materialsRes.error, photosRes.error, reportsRes.error, qrRes.error, reviewsRes.error].find(Boolean);
  if (firstError) throw firstError;

  return {
    checklist: checklistRes.data || [],
    visits: visitsRes.data || [],
    materials: materialsRes.data || [],
    photos: photosRes.data || [],
    reports: reportsRes.data || [],
    qrVerifications: qrRes.data || [],
    reviews: reviewsRes.data || []
  };
}

function isRequired(config, key) {
  return Boolean(config?.[key]);
}

function okItem(key, label, passed, detail, required = true) {
  return {
    key,
    label,
    passed: Boolean(passed),
    required,
    blocking: Boolean(required && !passed),
    detail
  };
}

export function buildFinalReviewItems(workOrder, reviewData) {
  const config = workOrder?.configuracion || {};
  const checklist = reviewData?.checklist || [];
  const visits = reviewData?.visits || [];
  const materials = reviewData?.materials || [];
  const photos = reviewData?.photos || [];
  const reports = reviewData?.reports || [];
  const qrVerifications = reviewData?.qrVerifications || [];

  const checklistRequired = isRequired(config, 'requiere_checklist');
  const checklistDone = !checklistRequired || (checklist.length > 0 && checklist.every((item) => item.resultado && item.resultado !== 'pendiente'));
  const photosRequired = isRequired(config, 'requiere_fotos_iniciales') || isRequired(config, 'requiere_fotos_finales');
  const photosDone = !photosRequired || photos.length > 0;
  const materialsRequired = isRequired(config, 'requiere_materiales');
  const materialsDone = !materialsRequired || materials.length > 0;
  const signatureRequired = isRequired(config, 'requiere_firma_cliente');
  const signatureDone = !signatureRequired || visits.some((visit) => visit.firma_path);
  const technicianSignatureRequired = isRequired(config, 'requiere_firma_tecnico');
  const technicianSignatureDone = !technicianSignatureRequired || visits.some((visit) => visit.firma_tecnico_path);
  const reportRequired = isRequired(config, 'requiere_informe');
  const reportDone = !reportRequired || reports.length > 0;
  const qrRequired = isRequired(config, 'requiere_verificacion_qr');
  const qrDone = !qrRequired || qrVerifications.length > 0;
  const visitDone = visits.some((visit) => visit.estado === 'FINALIZADA' || visit.fecha_fin);
  const statusDone = FINISHED_WORK_ORDER_STATUSES.includes(workOrder?.estado) || normalizedStatus(workOrder?.estado) === 'FINALIZADA';

  return [
    okItem('estado_finalizado', 'OT finalizada por tecnico', statusDone, statusDone ? `Estado actual: ${workOrder.estado}` : `Estado actual: ${workOrder?.estado || '-'}`, true),
    okItem('visita', 'Existe al menos una visita finalizada', visitDone, visitDone ? `${visits.length} visita(s) registrada(s)` : 'No hay visita finalizada', true),
    okItem('checklist', 'Checklist completado', checklistDone, checklistRequired ? `${checklist.filter((item) => item.resultado && item.resultado !== 'pendiente').length}/${checklist.length} puntos completados` : 'No obligatorio', checklistRequired),
    okItem('fotos', 'Fotografias obligatorias adjuntas', photosDone, photosRequired ? `${photos.length} foto(s) en la OT` : 'No obligatorio', photosRequired),
    okItem('materiales', 'Materiales revisados', materialsDone, materialsRequired ? `${materials.length} material(es) registrado(s)` : `${materials.length} material(es), no obligatorio`, materialsRequired),
    okItem('firma', 'Firma del cliente / responsable', signatureDone, signatureRequired ? (signatureDone ? 'Firma registrada' : 'Falta firma') : 'No obligatoria', signatureRequired),
    okItem('firma_tecnico', 'Firma del técnico', technicianSignatureDone, technicianSignatureRequired ? (technicianSignatureDone ? 'Firma registrada' : 'Falta firma') : 'No obligatoria', technicianSignatureRequired),
    okItem('qr', 'QR de la intervención verificado', qrDone, qrRequired ? (qrDone ? 'QR correcto registrado' : 'Falta verificar el QR') : 'No obligatorio', qrRequired),
    okItem('informe', 'Informe PDF generado', reportDone, reportRequired ? `${reports.length} informe(s) guardado(s)` : `${reports.length} informe(s), no obligatorio`, reportRequired)
  ];
}

export function finalReviewCanValidate(items) {
  return !items.some((item) => item.blocking);
}

export async function validateWorkOrderAsAdmin(workOrder, reviewItems, notes = '') {
  if (!finalReviewCanValidate(reviewItems)) {
    throw new Error('No se puede validar la OT. Hay requisitos obligatorios pendientes.');
  }
  const { data, error } = await supabase.rpc('review_work_order', { work_order_uuid: workOrder.id, decision_text: 'validada', notes_text: notes.trim() || 'Revisión administrativa conforme' });
  if (error) throw error;
  return data;
}

export async function requestWorkOrderCorrections(workOrder, notes = '') {
  const cleanNotes = notes.trim();
  if (!cleanNotes) throw new Error('Indica claramente qué debe corregir el técnico.');
  const { data, error } = await supabase.rpc('review_work_order', { work_order_uuid: workOrder.id, decision_text: 'correccion_solicitada', notes_text: cleanNotes });
  if (error) throw error;
  return data;
}
