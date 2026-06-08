import QRCode from 'qrcode';
import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

export function qrPathFromToken(token) {
  return `/qr/${encodeURIComponent(token)}`;
}

export function tokenFromQrValue(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0] === 'qr' ? parts[1] : value;
  } catch {
    return value.replace(/^\/?qr\//, '').trim();
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

export async function qrDataUrl(token, baseUrl = window.location.origin) {
  return QRCode.toDataURL(`${baseUrl}${qrPathFromToken(token)}`, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512
  });
}
