import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { claimDemoAccess } from './authService';
import { uploadEntityImage } from './imageService';

async function ensureDemoAccessIfEnabled() {
  if (import.meta.env.VITE_ENABLE_DEMO_SIGNUP !== 'true') return null;
  const { data, error } = await claimDemoAccess('');
  if (error && !String(error.message || '').includes('demo tenant not found')) {
    console.warn('No se pudo reclamar acceso demo automaticamente', error);
  }
  return data || null;
}

export async function createInstallation(tenantId, payload) {
  const resolvedTenantId = tenantId || await ensureDemoAccessIfEnabled();
  if (!resolvedTenantId) throw new Error('No hay cliente activo. En modo demo pulsa primero "Completar acceso demo" en Registro.');
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('instalaciones')
    .insert({
      tenant_id: resolvedTenantId,
      nombre: payload.nombre,
      codigo: payload.codigo || null,
      tipo: payload.tipo || null,
      direccion: payload.direccion || null,
      latitud: payload.latitud || null,
      longitud: payload.longitud || null,
      maps_url: payload.maps_url || null,
      contacto_nombre: payload.contacto_nombre || null,
      contacto_telefono: payload.contacto_telefono || null,
      contacto_email: payload.contacto_email || null,
      descripcion: payload.descripcion || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  if (payload.image_file) {
    const imageData = await uploadEntityImage({ tenantId: data.tenant_id, entityType: 'instalacion', entityId: data.id, file: payload.image_file });
    const update = await supabase.from('instalaciones').update(imageData).eq('id', data.id).select().single();
    if (update.error) throw update.error;
    await logAudit({ tenantId: data.tenant_id, action: 'update_installation_image', entityType: 'instalacion', entityId: data.id });
    data.image_bucket = update.data.image_bucket;
    data.image_path = update.data.image_path;
    data.image_file_name = update.data.image_file_name;
    data.image_mime_type = update.data.image_mime_type;
  }
  await logAudit({ tenantId: data.tenant_id, action: 'create_installation', entityType: 'instalacion', entityId: data.id });
  return data;
}

export async function updateInstallation(row, payload) {
  const { data, error } = await supabase
    .from('instalaciones')
    .update({
      nombre: payload.nombre,
      codigo: payload.codigo || null,
      tipo: payload.tipo || null,
      direccion: payload.direccion || null,
      latitud: payload.latitud || null,
      longitud: payload.longitud || null,
      maps_url: payload.maps_url || null,
      contacto_nombre: payload.contacto_nombre || null,
      contacto_telefono: payload.contacto_telefono || null,
      contacto_email: payload.contacto_email || null,
      descripcion: payload.descripcion || null
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;

  if (payload.image_file) {
    const imageData = await uploadEntityImage({ tenantId: row.tenant_id, entityType: 'instalacion', entityId: row.id, file: payload.image_file });
    const update = await supabase.from('instalaciones').update(imageData).eq('id', row.id).select().single();
    if (update.error) throw update.error;
    Object.assign(data, update.data);
  }

  await logAudit({ tenantId: row.tenant_id, action: 'update_installation', entityType: 'instalacion', entityId: row.id });
  return data;
}

export async function listInstallationsForTenant(tenantId) {
  const { data, error } = await supabase
    .from('instalaciones')
    .select('id,nombre,direccion,tipo')
    .eq('tenant_id', tenantId)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAsset(tenantId, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('activos')
    .insert({
      tenant_id: tenantId,
      instalacion_id: payload.instalacion_id,
      ubicacion_id: payload.ubicacion_id || null,
      nombre: payload.nombre,
      tipo: payload.tipo || null,
      marca: payload.marca || null,
      modelo: payload.modelo || null,
      numero_serie: payload.numero_serie || null,
      referencia: payload.referencia || null,
      estado: payload.estado || 'correcto',
      criticidad: payload.criticidad || 'media',
      fecha_instalacion: payload.fecha_instalacion || null,
      fecha_ultima_revision: payload.fecha_ultima_revision || null,
      fecha_proxima_revision: payload.fecha_proxima_revision || null,
      descripcion: payload.descripcion || null,
      observaciones: payload.observaciones || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  if (payload.image_file) {
    const imageData = await uploadEntityImage({ tenantId: data.tenant_id, entityType: 'activo', entityId: data.id, file: payload.image_file });
    const update = await supabase.from('activos').update(imageData).eq('id', data.id).select().single();
    if (update.error) throw update.error;
    await logAudit({ tenantId: data.tenant_id, action: 'update_asset_image', entityType: 'activo', entityId: data.id });
    data.image_bucket = update.data.image_bucket;
    data.image_path = update.data.image_path;
    data.image_file_name = update.data.image_file_name;
    data.image_mime_type = update.data.image_mime_type;
  }
  await logAudit({ tenantId, action: 'create_asset', entityType: 'activo', entityId: data.id });
  return data;
}

export async function updateAsset(row, payload) {
  const { data, error } = await supabase
    .from('activos')
    .update({
      instalacion_id: payload.instalacion_id,
      ubicacion_id: payload.ubicacion_id || null,
      nombre: payload.nombre,
      tipo: payload.tipo || null,
      marca: payload.marca || null,
      modelo: payload.modelo || null,
      numero_serie: payload.numero_serie || null,
      referencia: payload.referencia || null,
      estado: payload.estado || 'correcto',
      criticidad: payload.criticidad || 'media',
      fecha_instalacion: payload.fecha_instalacion || null,
      fecha_ultima_revision: payload.fecha_ultima_revision || null,
      fecha_proxima_revision: payload.fecha_proxima_revision || null,
      descripcion: payload.descripcion || null,
      observaciones: payload.observaciones || null
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;

  if (payload.image_file) {
    const imageData = await uploadEntityImage({ tenantId: row.tenant_id, entityType: 'activo', entityId: row.id, file: payload.image_file });
    const update = await supabase.from('activos').update(imageData).eq('id', row.id).select().single();
    if (update.error) throw update.error;
    Object.assign(data, update.data);
  }

  await logAudit({ tenantId: row.tenant_id, action: 'update_asset', entityType: 'activo', entityId: row.id });
  return data;
}

export async function createLocation(tenantId, payload) {
  const resolvedTenantId = tenantId || await ensureDemoAccessIfEnabled();
  if (!resolvedTenantId) throw new Error('No hay cliente activo. En modo demo pulsa primero "Completar acceso demo" en Registro.');
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('ubicaciones')
    .insert({
      tenant_id: resolvedTenantId,
      instalacion_id: payload.instalacion_id,
      nombre: payload.nombre,
      tipo: payload.tipo || null,
      planta: payload.planta || null,
      zona: payload.zona || null,
      descripcion: payload.descripcion || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  if (payload.image_file) {
    const imageData = await uploadEntityImage({ tenantId: data.tenant_id, entityType: 'ubicacion', entityId: data.id, file: payload.image_file });
    const update = await supabase.from('ubicaciones').update(imageData).eq('id', data.id).select().single();
    if (update.error) throw update.error;
    await logAudit({ tenantId: data.tenant_id, action: 'update_location_image', entityType: 'ubicacion', entityId: data.id });
    data.image_bucket = update.data.image_bucket;
    data.image_path = update.data.image_path;
    data.image_file_name = update.data.image_file_name;
    data.image_mime_type = update.data.image_mime_type;
  }
  await logAudit({ tenantId: data.tenant_id, action: 'create_location', entityType: 'ubicacion', entityId: data.id });
  return data;
}

export async function updateLocation(row, payload) {
  const { data, error } = await supabase
    .from('ubicaciones')
    .update({
      instalacion_id: payload.instalacion_id,
      nombre: payload.nombre,
      tipo: payload.tipo || null,
      planta: payload.planta || null,
      zona: payload.zona || null,
      descripcion: payload.descripcion || null
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id)
    .select()
    .single();

  if (error) throw error;

  if (payload.image_file) {
    const imageData = await uploadEntityImage({ tenantId: row.tenant_id, entityType: 'ubicacion', entityId: row.id, file: payload.image_file });
    const update = await supabase.from('ubicaciones').update(imageData).eq('id', row.id).select().single();
    if (update.error) throw update.error;
    Object.assign(data, update.data);
  }

  await logAudit({ tenantId: row.tenant_id, action: 'update_location', entityType: 'ubicacion', entityId: row.id });
  return data;
}

export async function createMaintenanceEntry(tenantId, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('historial_mantenimiento')
    .insert({
      tenant_id: tenantId,
      activo_id: payload.activo_id,
      fecha: payload.fecha,
      tipo: payload.tipo,
      titulo: payload.titulo,
      descripcion: payload.descripcion || null,
      tecnico_id: payload.tecnico_id || userData.user?.id || null,
      estado_final: payload.estado_final || null,
      proxima_accion: payload.proxima_accion || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'create_maintenance', entityType: 'historial_mantenimiento', entityId: data.id });
  return data;
}

export async function createIncident(tenantId, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('incidencias')
    .insert({
      tenant_id: tenantId,
      instalacion_id: payload.instalacion_id,
      ubicacion_id: payload.ubicacion_id || null,
      activo_id: payload.activo_id || null,
      titulo: payload.titulo,
      descripcion: payload.descripcion || null,
      prioridad: payload.prioridad || 'media',
      estado: 'abierta',
      created_by: userData.user?.id || null,
      assigned_to: payload.assigned_to || null
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'create_incident', entityType: 'incidencia', entityId: data.id });
  return data;
}

export async function softDeleteEntity({ table, tenantId, id, entityType, auditAction }) {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  await logAudit({ tenantId, action: auditAction, entityType, entityId: id });
}
