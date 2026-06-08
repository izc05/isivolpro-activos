import { supabase } from './supabaseClient';
import { buildStoragePath, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';

const ENTITY_SCOPE = {
  instalacion: { scope: 'instalaciones', folder: 'documentos', field: 'instalacion_id' },
  ubicacion: { scope: 'ubicaciones', folder: 'documentos', field: 'ubicacion_id' },
  activo: { scope: 'activos', folder: 'documentos', field: 'activo_id' }
};

export async function createDocumentWithFile(tenantId, payload) {
  const config = ENTITY_SCOPE[payload.entity_type];
  if (!config) throw new Error('Tipo de entidad no permitido.');
  if (!payload.entity_id) throw new Error('Selecciona una entidad para asociar el documento.');
  if (!payload.file) throw new Error('Selecciona un archivo.');

  const { data: userData } = await supabase.auth.getUser();
  const storagePath = buildStoragePath({
    tenantId,
    scope: config.scope,
    scopeId: payload.entity_id,
    folder: config.folder,
    file: payload.file
  });

  await uploadPrivateFile({
    tenantId,
    bucket: 'documents-private',
    path: storagePath,
    file: payload.file,
    metadata: {
      auditAction: 'upload_document',
      entityType: payload.entity_type,
      entityId: payload.entity_id
    }
  });

  const documentRow = {
    tenant_id: tenantId,
    tipo: payload.tipo || 'Otro',
    titulo: payload.titulo,
    descripcion: payload.descripcion || null,
    bucket: 'documents-private',
    storage_path: storagePath,
    file_name: payload.file.name,
    mime_type: payload.file.type,
    size_bytes: payload.file.size,
    visibilidad: payload.visibilidad || 'privado',
    created_by: userData.user?.id || null,
    [config.field]: payload.entity_id
  };

  const { error } = await supabase
    .from('documentos')
    .insert(documentRow);

  if (error) throw error;
  await logAudit({
    tenantId,
    action: 'create_document',
    entityType: 'documento',
    entityId: null,
    metadata: {
      titulo: documentRow.titulo,
      tipo: documentRow.tipo,
      visibilidad: documentRow.visibilidad,
      fileName: documentRow.file_name,
      storagePath
    }
  });
  return documentRow;
}

export async function softDeleteDocument(row) {
  const { error } = await supabase
    .from('documentos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id);

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'delete_document', entityType: 'documento', entityId: row.id });
}
