import { supabase } from './supabaseClient';

export const AUDIT_ACTION_LABELS = {
  create_work_order: 'OT creada',
  update_work_order_status: 'Cambio de estado de OT',
  start_work_order_visit: 'Intervención iniciada',
  finish_work_order_visit: 'Intervención cerrada',
  update_work_order_checklist_item: 'Checklist actualizado',
  create_work_order_checklist_item: 'Punto de checklist creado',
  delete_work_order_checklist_item: 'Punto de checklist eliminado',
  register_work_order_checklist_photo: 'Foto añadida al checklist',
  upload_work_order_checklist_photo: 'Foto subida',
  create_work_order_visit_material: 'Material registrado',
  save_work_order_signature: 'Firma cliente registrada',
  save_work_order_technician_signature: 'Firma técnico registrada',
  generate_work_order_pdf_report: 'Informe PDF generado',
  upload_work_order_pdf_report: 'Informe PDF subido',
  validate_work_order: 'OT validada',
  request_work_order_corrections: 'Corrección solicitada',
  annul_work_order: 'OT anulada',
  delete_work_order: 'OT anulada',
  qr_resolve: 'QR consultado',
  qr_scan: 'QR escaneado'
};

export const TECHNICIAN_VISIBLE_AUDIT_ACTIONS = new Set([
  'start_work_order_visit',
  'finish_work_order_visit',
  'update_work_order_checklist_item',
  'register_work_order_checklist_photo',
  'create_work_order_visit_material',
  'save_work_order_signature',
  'save_work_order_technician_signature',
  'generate_work_order_pdf_report',
  'request_work_order_corrections',
  'validate_work_order',
  'annul_work_order'
]);

export function auditActionLabel(action = '') {
  return AUDIT_ACTION_LABELS[action] || String(action || 'Acción registrada').replaceAll('_', ' ');
}

function normalizeMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return { raw: metadata };
    }
  }
  return metadata;
}

export function auditMetadataSummary(metadata = {}) {
  const meta = normalizeMetadata(metadata);
  const parts = [];
  if (meta.from || meta.to) parts.push(`Estado: ${meta.from || '-'} → ${meta.to || '-'}`);
  if (meta.status) parts.push(`Estado: ${meta.status}`);
  if (meta.type) parts.push(`Tipo: ${meta.type}`);
  if (meta.result) parts.push(`Resultado: ${String(meta.result).replaceAll('_', ' ')}`);
  if (meta.decision) parts.push(`Decisión: ${String(meta.decision).replaceAll('_', ' ')}`);
  if (meta.reason) parts.push(`Motivo: ${meta.reason}`);
  if (meta.notes) parts.push(`Notas: ${meta.notes}`);
  if (meta.filename) parts.push(`Archivo: ${meta.filename}`);
  if (meta.visitId) parts.push(`Visita: ${String(meta.visitId).slice(0, 8)}`);
  if (meta.checklistItemId) parts.push(`Checklist: ${String(meta.checklistItemId).slice(0, 8)}`);
  if (meta.otId) parts.push(`OT: ${String(meta.otId).slice(0, 8)}`);
  return parts.join(' · ') || 'Sin detalle adicional';
}

export function getAuditWorkOrderId(entry = {}) {
  const metadata = normalizeMetadata(entry.metadata);
  if (entry.entity_type === 'orden_trabajo') return entry.entity_id;
  return metadata.otId || metadata.workOrderId || metadata.work_order_id || null;
}

export function isWorkOrderAuditEntry(entry = {}) {
  return Boolean(getAuditWorkOrderId(entry)) || String(entry.entity_type || '').startsWith('ot_');
}

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

export async function listRecentAuditLogs(tenantId, { limit = 300 } = {}) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, profiles(email,nombre)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listWorkOrderAuditTrail(tenantId, workOrderId, { technicianView = false, limit = 300 } = {}) {
  const rows = await listRecentAuditLogs(tenantId, { limit });
  return rows
    .filter((entry) => getAuditWorkOrderId(entry) === workOrderId)
    .filter((entry) => !technicianView || TECHNICIAN_VISIBLE_AUDIT_ACTIONS.has(entry.action));
}
