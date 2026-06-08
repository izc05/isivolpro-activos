import { supabase } from './supabaseClient';
import { buildStoragePath, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';

const ENTITY_SCOPE = {
  instalacion: { scope: 'instalaciones', field: 'instalacion_id' },
  ubicacion: { scope: 'ubicaciones', field: 'ubicacion_id' },
  activo: { scope: 'activos', field: 'activo_id' }
};

function resolveEntity(payload) {
  const config = ENTITY_SCOPE[payload.entity_type];
  if (!config) throw new Error('Tipo de entidad no permitido.');
  if (!payload.entity_id) throw new Error('Selecciona una entidad.');
  return config;
}

function entityPatch(payload) {
  const config = resolveEntity(payload);
  return {
    instalacion_id: null,
    ubicacion_id: null,
    activo_id: null,
    [config.field]: payload.entity_id
  };
}

export async function createPhotoWithFile(tenantId, payload) {
  const config = resolveEntity(payload);
  if (!payload.file) throw new Error('Selecciona una foto.');

  const { data: userData } = await supabase.auth.getUser();
  const storagePath = buildStoragePath({
    tenantId,
    scope: config.scope,
    scopeId: payload.entity_id,
    folder: 'fotos',
    file: payload.file
  });

  await uploadPrivateFile({
    tenantId,
    bucket: 'photos-private',
    path: storagePath,
    file: payload.file,
    metadata: {
      auditAction: 'upload_photo',
      entityType: payload.entity_type,
      entityId: payload.entity_id
    }
  });

  const { data, error } = await supabase
    .from('fotos')
    .insert({
      tenant_id: tenantId,
      titulo: payload.titulo || payload.file.name,
      descripcion: payload.descripcion || null,
      bucket: 'photos-private',
      storage_path: storagePath,
      file_name: payload.file.name,
      mime_type: payload.file.type,
      size_bytes: payload.file.size,
      visibilidad: payload.visibilidad || 'cliente',
      created_by: userData.user?.id || null,
      [config.field]: payload.entity_id
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'create_photo', entityType: 'foto', entityId: data.id });
  return data;
}

export async function updatePhoto(row, payload) {
  const patch = entityPatch(payload);
  const { data, error } = await supabase
    .from('fotos')
    .update({
      titulo: payload.titulo || null,
      descripcion: payload.descripcion || null,
      visibilidad: payload.visibilidad || row.visibilidad || 'cliente',
      ...patch
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'update_photo', entityType: 'foto', entityId: row.id });
  return data;
}

export async function createVideo(tenantId, payload) {
  const config = resolveEntity(payload);
  const { data: userData } = await supabase.auth.getUser();
  let storagePath = null;

  if (payload.tipo === 'archivo') {
    if (!payload.file) throw new Error('Selecciona un video.');
    storagePath = buildStoragePath({
      tenantId,
      scope: config.scope,
      scopeId: payload.entity_id,
      folder: 'videos',
      file: payload.file
    });
    await uploadPrivateFile({
      tenantId,
      bucket: 'videos-private',
      path: storagePath,
      file: payload.file,
      metadata: {
        auditAction: 'upload_video',
        entityType: payload.entity_type,
        entityId: payload.entity_id
      }
    });
  }

  if (payload.tipo === 'url' && !payload.external_url) {
    throw new Error('Introduce una URL externa.');
  }

  const { data, error } = await supabase
    .from('videos')
    .insert({
      tenant_id: tenantId,
      titulo: payload.titulo,
      descripcion: payload.descripcion || null,
      tipo: payload.tipo,
      bucket: payload.tipo === 'archivo' ? 'videos-private' : null,
      storage_path: storagePath,
      external_url: payload.tipo === 'url' ? payload.external_url : null,
      visibilidad: payload.visibilidad || 'cliente',
      created_by: userData.user?.id || null,
      [config.field]: payload.entity_id
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'create_video', entityType: 'video', entityId: data.id });
  return data;
}

export async function updateVideo(row, payload) {
  const patch = entityPatch(payload);
  if (row.tipo === 'url' && !payload.external_url) {
    throw new Error('Introduce una URL externa.');
  }

  const { data, error } = await supabase
    .from('videos')
    .update({
      titulo: payload.titulo,
      descripcion: payload.descripcion || null,
      external_url: row.tipo === 'url' ? payload.external_url : row.external_url,
      visibilidad: payload.visibilidad || row.visibilidad || 'cliente',
      ...patch
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({
    tenantId: row.tenant_id,
    action: 'update_video',
    entityType: 'video',
    entityId: row.id,
    metadata: { visibilidad: payload.visibilidad || row.visibilidad }
  });
  return data;
}

export async function softDeleteMedia({ table, row, entityType, auditAction }) {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id);

  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: auditAction, entityType, entityId: row.id });
}
