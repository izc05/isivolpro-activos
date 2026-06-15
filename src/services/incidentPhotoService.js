import { supabase } from './supabaseClient';

const MAX_INCIDENT_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_INCIDENT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateIncidentPhotoFile(file) {
  if (!file) return true;
  if (!ALLOWED_INCIDENT_PHOTO_TYPES.includes(file.type)) throw new Error('La foto debe ser JPG, PNG o WEBP.');
  if (file.size > MAX_INCIDENT_PHOTO_SIZE) throw new Error('La foto supera 2 MB. Reduce el tamaño o haz una captura más ligera.');
  return true;
}

export async function incidentPhotoFileToDataUrl(file) {
  if (!file) return '';
  validateIncidentPhotoFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la foto seleccionada.'));
    reader.readAsDataURL(file);
  });
}

export async function listIncidentPhotos(tenantId, incidentId) {
  const { data, error } = await supabase
    .from('incident_photos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('incidencia_id', incidentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createIncidentPhoto({ tenantId, incidentId, file, tipoFoto = 'problema', comentario = '' }) {
  if (!file) throw new Error('Selecciona una foto.');
  const dataUrl = await incidentPhotoFileToDataUrl(file);
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('incident_photos')
    .insert({
      tenant_id: tenantId,
      incidencia_id: incidentId,
      source: 'internal',
      tipo_foto: tipoFoto,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      data_url: dataUrl,
      comentario: comentario || null,
      created_by: userData.user?.id || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export { MAX_INCIDENT_PHOTO_SIZE, ALLOWED_INCIDENT_PHOTO_TYPES };
