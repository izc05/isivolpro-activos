import { supabase } from './supabaseClient';
import { validateFileForBucket } from '../utils/fileValidation';
import { logAudit } from './auditService';

export function buildStoragePath({ tenantId, scope, scopeId, folder, file }) {
  const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${tenantId}/${scope}/${scopeId}/${folder}/${safeName}`;
}

export async function uploadPrivateFile({ tenantId, bucket, path, file, metadata }) {
  validateFileForBucket(bucket, file);

  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type
  });
  if (error) throw error;

  await logAudit({
    tenantId,
    action: metadata?.auditAction || 'upload_document',
    entityType: metadata?.entityType || 'storage_object',
    entityId: metadata?.entityId || null,
    metadata: { bucket, path, fileName: file.name, size: file.size, mimeType: file.type }
  });

  return data;
}

export async function createSignedUrl({ tenantId, bucket, path, entityType = 'documento', entityId = null, expiresIn = 300 }) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;

  await logAudit({
    tenantId,
    action: entityType === 'documento' ? 'view_document' : 'view_media',
    entityType,
    entityId,
    metadata: { bucket, expiresIn }
  });

  return data.signedUrl;
}
