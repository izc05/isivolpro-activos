import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';
import clinicaSanRafaelImage from '../assets/demo/clinica-san-rafael.jpg';
import comunidadLosOlivosImage from '../assets/demo/comunidad-los-olivos.jpg';
import residenciaJardinImage from '../assets/demo/residencia-jardin.jpg';
import salaTecnicaImage from '../assets/demo/sala-tecnica.jpg';

const DEMO_ENTITY_IMAGES = {
  instalacion: {
    'clinica san rafael demo': clinicaSanRafaelImage,
    'clinica san rafael': clinicaSanRafaelImage,
    'comunidad los olivos': comunidadLosOlivosImage,
    'residencia jardin': residenciaJardinImage
  },
  ubicacion: {
    'sala pci': salaTecnicaImage,
    'sala sai': salaTecnicaImage,
    'cubierta climatizacion': salaTecnicaImage,
    'zona principal': comunidadLosOlivosImage
  }
};

function normalizeImageKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function demoEntityImageUrl(row, entityType) {
  const imagesByName = DEMO_ENTITY_IMAGES[entityType];
  if (!imagesByName) return '';
  return imagesByName[normalizeImageKey(row?.nombre)] || '';
}

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
    image_mime_type: file.type
  };
}

export async function signedEntityImageUrl(row, entityType) {
  if (row?.image_bucket && row?.image_path) {
    return createSignedUrl({
      tenantId: row.tenant_id,
      bucket: row.image_bucket,
      path: row.image_path,
      entityType,
      entityId: row.id,
      expiresIn: 600
    });
  }
  const demoImage = demoEntityImageUrl(row, entityType);
  if (demoImage) return demoImage;
  if (row?.image_data_url) return row.image_data_url;
  return '';
}
