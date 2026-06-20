import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { createDocumentWithFile } from './documentService';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function listOcaDocuments(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('oca_documentos')
    .select('*, documentos(*), controles_oca(nombre,especialidad,instalaciones(nombre)), inspecciones_oca(codigo,fecha_realizada,resultado,instalaciones(nombre)), incidencias_oca(codigo,titulo,instalaciones(nombre))')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listOcaDocumentsForInspection(tenantId, inspectionId) {
  if (!tenantId || !inspectionId) return [];
  const { data, error } = await supabase
    .from('oca_documentos')
    .select('*, documentos(*)')
    .eq('tenant_id', tenantId)
    .eq('inspeccion_oca_id', inspectionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function linkOcaDocument(tenantId, payload) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('oca_documentos')
    .insert({
      tenant_id: tenantId,
      control_oca_id: payload.control_oca_id || null,
      inspeccion_oca_id: payload.inspeccion_oca_id || null,
      incidencia_oca_id: payload.incidencia_oca_id || null,
      documento_id: payload.documento_id,
      tipo_documento: payload.tipo_documento || 'otra_documentacion',
      obligatorio: Boolean(payload.obligatorio),
      observaciones: payload.observaciones || null,
      created_by: userId
    })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId, action: 'link_oca_document', entityType: 'oca_documento', entityId: data.id, metadata: { documentoId: payload.documento_id } });
  return data;
}

export async function uploadOcaDocument(tenantId, payload) {
  const documentPayload = {
    entity_type: payload.activo_id ? 'activo' : payload.ubicacion_id ? 'ubicacion' : 'instalacion',
    entity_id: payload.activo_id || payload.ubicacion_id || payload.instalacion_id,
    titulo: payload.titulo,
    tipo: payload.tipo || 'OCA',
    descripcion: payload.descripcion || null,
    visibilidad: payload.visibilidad || 'cliente',
    file: payload.file
  };
  await createDocumentWithFile(tenantId, documentPayload);
  const { data: documents, error } = await supabase
    .from('documentos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('titulo', documentPayload.titulo)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const documentId = documents?.[0]?.id;
  if (!documentId) throw new Error('El documento se ha subido, pero no se ha podido vincular a OCA.');
  return linkOcaDocument(tenantId, { ...payload, documento_id: documentId });
}

export async function unlinkOcaDocument(row) {
  const { error } = await supabase
    .from('oca_documentos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', row.tenant_id)
    .eq('id', row.id);
  if (error) throw error;
  await logAudit({ tenantId: row.tenant_id, action: 'unlink_oca_document', entityType: 'oca_documento', entityId: row.id });
}
