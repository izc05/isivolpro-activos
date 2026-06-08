import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { qrDataUrl } from '../../services/qrService';
import { shortId } from '../../utils/qrUtils';

export default function QRCodeCard({ token, title, subtitle, compact = false }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (token) qrDataUrl(token).then(setSrc);
  }, [token]);

  function download() {
    const link = document.createElement('a');
    link.href = src;
    link.download = `qr-${shortId(token)}.png`;
    link.click();
  }

  if (!token) return null;

  return (
    <article className={`qr-card ${compact ? 'compact' : ''}`}>
      {src && <img src={src} alt={`QR ${title}`} />}
      <strong>{title}</strong>
      {subtitle && <small>{subtitle}</small>}
      <span>ID {shortId(token)}</span>
      <button className="secondary-button" onClick={download}><Download size={16} /> Descargar PNG</button>
    </article>
  );
}
