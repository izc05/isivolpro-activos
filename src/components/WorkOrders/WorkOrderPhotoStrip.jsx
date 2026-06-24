import { Image, MapPin, Maximize2, PackageCheck, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { signedEntityImageUrl } from '../../services/imageService';

const RELATED_ENTITIES = [
  { key: 'instalaciones', type: 'instalacion', title: 'Instalación', icon: MapPin },
  { key: 'ubicaciones', type: 'ubicacion', title: 'Ubicación', icon: PackageCheck },
  { key: 'activos', type: 'activo', title: 'Activo', icon: Wrench }
];

export default function WorkOrderPhotoStrip({ workOrder }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
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
    <>
      <div className="ot-photo-strip" aria-label="Fotos de contexto de la OT">
        {photos.map((photo) => {
          const Icon = photo.icon || Image;
          return (
            <button className="ot-photo-tile" key={photo.type} type="button" onClick={() => setSelectedPhoto(photo)}>
              <img src={photo.src} alt={`${photo.title}: ${photo.name}`} />
              <span>
                <Icon size={14} />
                <b>{photo.title}</b>
                <small>{photo.name}</small>
              </span>
              <em><Maximize2 size={15} /> Revisar</em>
            </button>
          );
        })}
      </div>

      {selectedPhoto && (
        <div className="ot-photo-overlay" role="dialog" aria-modal="true" aria-label={`Revisar foto de ${selectedPhoto.title}`}>
          <button className="ot-photo-overlay-backdrop" type="button" aria-label="Cerrar visor" onClick={() => setSelectedPhoto(null)} />
          <section className="ot-photo-overlay-panel">
            <header>
              <div>
                <span className="section-eyebrow">Foto de contexto</span>
                <h2>{selectedPhoto.title}</h2>
                <p>{selectedPhoto.name}</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSelectedPhoto(null)}><X size={18} /> Cerrar</button>
            </header>
            <img src={selectedPhoto.src} alt={`${selectedPhoto.title}: ${selectedPhoto.name}`} />
          </section>
        </div>
      )}
    </>
  );
}
