import QRCode from 'qrcode';
import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { incidentPhotoFileToDataUrl } from './incidentPhotoService';

export function qrPathFromToken(token) {
  return `#/qr/${encodeURIComponent(token)}`;
}

export function publicIncidentPathFromToken(token) {
  return `#/aviso/${encodeURIComponent(token)}`;
}

function appBaseUrl() {
  const path = window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`;
  return `${window.location.origin}${path}`;
}

export function tokenFromQrValue(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const hashParts = parsed.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (hashParts[0] === 'qr' || hashParts[0] === 'aviso') return hashParts[1] || '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0] === 'qr' || parts[0] === 'aviso' ? parts[1] : value;
  } catch {
    return value.replace(/^#?\/?(qr|aviso)\//, '').trim();
  }
}

export async function resolveQr(rawValue) {
  const token = tokenFromQrValue(rawValue);
  const { data, error } = await supabase.rpc('resolve_qr', { qr_token_text: token });
  if (error) throw error;
  const resolved = data?.[0];
  if (!resolved) return null;

  await logAudit({
    tenantId: resolved.tenant_id,
    action: 'qr_scan',
    entityType: resolved.entity_type,
    entityId: resolved.entity_id,
    metadata: { tokenSuffix: token.slice(-6) }
  });

  return resolved;
}

export async function verifyWorkOrderQr(workOrderId, rawValue) {
  const token = tokenFromQrValue(rawValue);
  if (!workOrderId || !token) throw new Error('No se ha podido identificar la OT o el QR.');
  const { data, error } = await supabase.rpc('verify_work_order_qr', {
    work_order_uuid: workOrderId,
    qr_token_text: token
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function qrDataUrl(token, baseUrl = appBaseUrl(), kind = 'internal') {
  const path = kind === 'public-incident' ? publicIncidentPathFromToken(token) : qrPathFromToken(token);
  return QRCode.toDataURL(`${baseUrl}${path}`, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512
  });
}

export async function publicQrContext(token) {
  const { data, error } = await supabase.rpc('public_qr_context', { qr_token_text: tokenFromQrValue(token) });
  if (error) throw error;
  return data?.[0] || null;
}

export async function submitPublicIncident(token, payload) {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ].join('|');

  const photoFile = payload.foto || null;
  const photoDataUrl = photoFile ? await incidentPhotoFileToDataUrl(photoFile) : null;

  const { data, error } = await supabase.rpc('submit_public_incident', {
    qr_token_text: tokenFromQrValue(token),
    reporter_name: payload.nombre,
    reporter_contact: payload.contacto,
    report_title: payload.titulo,
    report_description: payload.descripcion,
    report_priority: payload.prioridad || 'media',
    browser_fingerprint: fingerprint,
    photo_data_url: photoDataUrl,
    photo_file_name: photoFile?.name || null,
    photo_mime_type: photoFile?.type || null,
    photo_size_bytes: photoFile?.size || null,
    photo_comment: payload.comentarioFoto || null
  });
  if (error) throw error;
  return data?.[0] || data;
}
