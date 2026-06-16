import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { signedEntityImageUrl } from '../../services/imageService';

function demoImage(title = 'Elemento demo', entityType = 'activo') {
  const label = encodeURIComponent(title || 'Elemento demo').replaceAll('%20', ' ');
  const typeLabel = encodeURIComponent(entityType || 'activo').replaceAll('%20', ' ');
  return `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22900%22%20height%3D%22560%22%20viewBox%3D%220%200%20900%20560%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%20y1%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23dff6fb%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23eafdf4%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22900%22%20height%3D%22560%22%20rx%3D%2232%22%20fill%3D%22url(%23g)%22/%3E%3Crect%20x%3D%2232%22%20y%3D%2232%22%20width%3D%22836%22%20height%3D%22496%22%20rx%3D%2228%22%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.9%22%20stroke%3D%22%230e7490%22%20stroke-width%3D%226%22/%3E%3Crect%20x%3D%2260%22%20y%3D%2260%22%20width%3D%22780%22%20height%3D%22100%22%20rx%3D%2220%22%20fill%3D%22%230e7490%22/%3E%3Ctext%20x%3D%2285%22%20y%3D%22124%22%20font-family%3D%22Arial%22%20font-size%3D%2244%22%20font-weight%3D%22700%22%20fill%3D%22white%22%3EIsiVoltPro%3C/text%3E%3Ctext%20x%3D%2285%22%20y%3D%22228%22%20font-family%3D%22Arial%22%20font-size%3D%2254%22%20font-weight%3D%22700%22%20fill%3D%22%230f172a%22%3EImagen%20demo%3C/text%3E%3Ctext%20x%3D%2285%22%20y%3D%22290%22%20font-family%3D%22Arial%22%20font-size%3D%2232%22%20fill%3D%22%230e7490%22%3E${label}%3C/text%3E%3Ctext%20x%3D%2285%22%20y%3D%22338%22%20font-family%3D%22Arial%22%20font-size%3D%2227%22%20fill%3D%22%23475569%22%3EFicha%20de%20${typeLabel}%20sin%20foto%20real%3C/text%3E%3Ccircle%20cx%3D%22145%22%20cy%3D%22442%22%20r%3D%2246%22%20fill%3D%22%230e7490%22/%3E%3Ccircle%20cx%3D%22265%22%20cy%3D%22442%22%20r%3D%2246%22%20fill%3D%22%232563eb%22/%3E%3Ccircle%20cx%3D%22385%22%20cy%3D%22442%22%20r%3D%2246%22%20fill%3D%22%2316a34a%22/%3E%3Crect%20x%3D%22550%22%20y%3D%22388%22%20width%3D%22280%22%20height%3D%22110%22%20rx%3D%2218%22%20fill%3D%22%23f8fafc%22%20stroke%3D%22%230e7490%22%20stroke-width%3D%224%22/%3E%3Ctext%20x%3D%22575%22%20y%3D%22435%22%20font-family%3D%22Arial%22%20font-size%3D%2228%22%20font-weight%3D%22700%22%20fill%3D%22%230f172a%22%3EDemo%20visual%3C/text%3E%3Ctext%20x%3D%22575%22%20y%3D%22475%22%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20fill%3D%22%230e7490%22%3EQR%20%2B%20activo%3C/text%3E%3C/svg%3E`;
}

export default function EntityImageViewer({ row, entityType, title, className = '' }) {
  const [realSrc, setRealSrc] = useState('');
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fallbackSrc = useMemo(() => demoImage(title || row?.nombre, entityType), [title, row?.nombre, entityType]);
  const src = realSrc || fallbackSrc;

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

  return (
    <>
      <button
        className={`entity-image-viewer ${className}`}
        type="button"
        onClick={() => src && setOpen(true)}
        aria-label={`Ampliar imagen de ${title}`}
      >
        <img src={src} alt={title} />
        <span>{realSrc ? 'Ampliar imagen' : 'Imagen demo'}</span>
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
                <button className="ghost-button" type="button" onClick={close}>Cerrar</button>
              </div>
            </header>
            <div className="image-lightbox-stage">
              <img
                src={src}
                alt={title}
                style={{
                  width: `${zoom * 100}%`,
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
