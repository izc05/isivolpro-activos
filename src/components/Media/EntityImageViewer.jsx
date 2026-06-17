import { ExternalLink, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signedEntityImageUrl } from '../../services/imageService';

export default function EntityImageViewer({ row, entityType, title, className = '' }) {
  const [realSrc, setRealSrc] = useState('');
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let mounted = true;
    signedEntityImageUrl(row, entityType)
      .then((url) => {
        if (mounted) setRealSrc(url || '');
      })
      .catch(() => {
        if (mounted) setRealSrc('');
      });
    return () => {
      mounted = false;
    };
  }, [row?.id, row?.image_path, entityType]);

  function close() {
    setOpen(false);
    setZoom(1);
  }

  function changeZoom(nextZoom) {
    setZoom(Math.min(3, Math.max(1, nextZoom)));
  }

  if (!realSrc) {
    return (
      <div className={`entity-image-viewer entity-image-empty ${className}`} aria-label={`Sin imagen de ${title}`}>
        <span>Sin imagen</span>
      </div>
    );
  }

  return (
    <>
      <button
        className={`entity-image-viewer ${className}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ampliar imagen de ${title}`}
      >
        <img src={realSrc} alt={title} />
        <span>Ampliar imagen</span>
      </button>

      {open && (
        <div className="image-lightbox-backdrop" role="presentation" onMouseDown={close}>
          <section className="image-lightbox" role="dialog" aria-modal="true" aria-label={`Imagen de ${title}`} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{title}</h2>
              <div className="inline-actions">
                <button className="secondary-button" type="button" onClick={() => changeZoom(zoom - 0.25)}><ZoomOut size={16} /> Alejar</button>
                <button className="secondary-button" type="button" onClick={() => setZoom(1)}><RotateCcw size={16} /> 100%</button>
                <button className="secondary-button" type="button" onClick={() => changeZoom(zoom + 0.25)}><ZoomIn size={16} /> Acercar</button>
                <a className="secondary-button" href={realSrc} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Original</a>
                <button className="ghost-button" type="button" onClick={close}>Cerrar</button>
              </div>
            </header>
            <div className="image-lightbox-stage">
              <img
                src={realSrc}
                alt={title}
                style={{
                  width: zoom === 1 ? 'auto' : `${zoom * 100}%`,
                  maxWidth: zoom === 1 ? '100%' : 'none',
                  maxHeight: zoom === 1 ? '100%' : 'none'
                }}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
