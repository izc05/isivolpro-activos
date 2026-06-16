import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';

export async function uploadEntityImage({ tenantId, entityType, entityId, file }) {
  if (!file) return null;

  const scopeByType = {
    instalacion: 'instalaciones',
    ubicacion: 'ubicaciones',
    activo: 'activos'
  };

  const scope = scopeByType[entityType];
  if (!scope) throw new Error('Tipo de entidad no valido para imagen.');

  const path = buildStoragePath({
    tenantId,
    scope,
    scopeId: entityId,
    folder: 'imagenes',
    file
  });

  await uploadPrivateFile({
    tenantId,
    bucket: 'photos-private',
    path,
    file,
    metadata: {
      auditAction: 'upload_entity_image',
      entityType,
      entityId
    }
  });

  await logAudit({ tenantId, action: 'update_entity_image', entityType, entityId });

  return {
    image_bucket: 'photos-private',
    image_path: path,
    image_file_name: file.name,
    image_mime_type: file.type,
    image_data_url: null
  };
}

export async function signedEntityImageUrl(row, entityType) {
  if (row?.image_data_url) return row.image_data_url;
  if (!row?.image_bucket || !row?.image_path) return '';
  return createSignedUrl({
    tenantId: row.tenant_id,
    bucket: row.image_bucket,
    path: row.image_path,
    entityType,
    entityId: row.id,
    expiresIn: 600
  });
}
