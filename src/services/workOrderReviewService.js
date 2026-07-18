import { supabase } from './supabaseClient';
import { buildWorkOrderClosingRequirements, toFinalReviewItems } from './workOrderClosingRequirements';

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

export function buildFinalReviewItems(workOrder, reviewData) {
  const requirements = buildWorkOrderClosingRequirements({
    workOrder,
    visits: reviewData?.visits || [],
    checklistResponses: reviewData?.checklist || [],
    materials: reviewData?.materials || [],
    photos: reviewData?.photos || [],
    reports: reviewData?.reports || [],
    qrVerifications: reviewData?.qrVerifications || []
  });

  return toFinalReviewItems(requirements);
}

export function finalReviewCanValidate(items) {
  return !items.some((item) => item.blocking);
}

export async function validateWorkOrderAsAdmin(workOrder, reviewItems, notes = '') {
  if (!finalReviewCanValidate(reviewItems)) {
    throw new Error('No se puede validar la OT. Hay requisitos obligatorios pendientes.');
  }
  const { data, error } = await supabase.rpc('review_work_order', { work_order_uuid: workOrder.id, decision_text: 'validada', notes_text: notes });
  if (error) throw error;
  return data;
}

export async function requestWorkOrderCorrections(workOrder, notes = '') {
  if (!notes.trim()) throw new Error('Indica claramente qué debe corregir el técnico.');
  const { data, error } = await supabase.rpc('review_work_order', { work_order_uuid: workOrder.id, decision_text: 'correccion_solicitada', notes_text: notes });
  if (error) throw error;
  return data;
}
