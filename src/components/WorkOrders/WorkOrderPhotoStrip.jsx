import { Image, MapPin, PackageCheck, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { signedEntityImageUrl } from '../../services/imageService';

const RELATED_ENTITIES = [
  { key: 'instalaciones', type: 'instalacion', title: 'Instalacion', icon: MapPin },
  { key: 'activos', type: 'activo', title: 'Activo', icon: Wrench },
  { key: 'ubicaciones', type: 'ubicacion', title: 'Ubicacion', icon: PackageCheck }
];

export default function WorkOrderPhotoStrip({ workOrder }) {
  const [photos, setPhotos] = useState([]);
  const photoKey = useMemo(() => RELATED_ENTITIES.map(({ key, type }) => {
    const entity = workOrder?.[key];
    return [type, entity?.id, entity?.nombre, entity?.image_path, entity?.image_data_url?.length || 0].join(':');
  }).join('|'), [workOrder]);

  useEffect(() => {
    let mounted = true;

    async function resolvePhotos() {
      const resolved = [];

      for (const config of RELATED_ENTITIES) {
        const entity = workOrder?.[config.key];
        if (!entity) continue;

        try {
          const src = await signedEntityImageUrl(entity, config.type);
          if (src) {
            resolved.push({
              ...config,
              src,
              name: entity.nombre || config.title
            });
          }
        } catch {
          // If one related image fails, keep showing any other available photo.
        }
      }

      if (mounted) setPhotos(resolved);
    }

    resolvePhotos();
    return () => {
      mounted = false;
    };
  }, [photoKey, workOrder]);

  if (!photos.length) return null;

  return (
    <div className="ot-photo-strip" aria-label="Fotos de contexto de la OT">
      {photos.map((photo) => {
        const Icon = photo.icon || Image;
        return (
          <article className="ot-photo-tile" key={photo.type}>
            <img src={photo.src} alt={`${photo.title}: ${photo.name}`} />
            <span>
              <Icon size={14} />
              <b>{photo.title}</b>
              <small>{photo.name}</small>
            </span>
          </article>
        );
      })}
    </div>
  );
}
