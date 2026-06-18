import { Image, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { signedEntityImageUrl } from '../../services/imageService';

function imageCandidates(row = {}) {
  return [
    { entity: row.activos, type: 'activo', label: row.activos?.nombre || 'Activo' },
    { entity: row.ubicaciones, type: 'ubicacion', label: row.ubicaciones?.nombre || 'Ubicacion' },
    { entity: row.instalaciones, type: 'instalacion', label: row.instalaciones?.nombre || 'Instalacion' }
  ].filter((candidate) => candidate.entity);
}

export default function WorkOrderThumbnail({ row, compact = false }) {
  const [image, setImage] = useState({ src: '', label: '', type: '' });
  const imageKey = useMemo(() => imageCandidates(row).map(({ entity, type }) => [
    type,
    entity.id,
    entity.nombre,
    entity.image_path,
    entity.image_data_url?.length || 0
  ].join(':')).join('|'), [row]);

  useEffect(() => {
    let mounted = true;

    async function resolveImage() {
      const candidates = imageCandidates(row);
      for (const candidate of candidates) {
        try {
          const src = await signedEntityImageUrl(candidate.entity, candidate.type);
          if (src) {
            if (mounted) setImage({ src, label: candidate.label, type: candidate.type });
            return;
          }
        } catch {
          // Try the next related entity if a signed URL cannot be created.
        }
      }
      if (mounted) setImage({ src: '', label: '', type: '' });
    }

    resolveImage();
    return () => {
      mounted = false;
    };
  }, [imageKey, row]);

  if (!image.src) {
    return (
      <span className={`ot-thumb ot-thumb-empty ${compact ? 'compact' : ''}`} title="Sin foto asociada">
        <Image size={compact ? 16 : 18} />
      </span>
    );
  }

  return (
    <span className={`ot-thumb ${compact ? 'compact' : ''}`} title={`${image.type}: ${image.label}`}>
      <img src={image.src} alt={image.label} />
      {!compact && <small><MapPin size={11} /> {image.type}</small>}
    </span>
  );
}
