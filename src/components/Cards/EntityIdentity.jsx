import { ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signedEntityImageUrl } from '../../services/imageService';

export default function EntityIdentity({ row, entityType, title, subtitle, size = 'default' }) {
  const [src, setSrc] = useState(row?.image_data_url || '');

  useEffect(() => {
    let mounted = true;
    if (row?.image_data_url) {
      setSrc(row.image_data_url);
      return () => {
        mounted = false;
      };
    }
    signedEntityImageUrl(row, entityType)
      .then((url) => {
        if (mounted) setSrc(url || '');
      })
      .catch(() => {
        if (mounted) setSrc('');
      });
    return () => {
      mounted = false;
    };
  }, [row?.id, row?.image_path, row?.image_data_url, entityType]);

  return (
    <div className={`entity-identity ${size !== 'default' ? `entity-identity-${size}` : ''}`}>
      <div className="entity-thumb">
        {src ? <img src={src} alt={title} /> : <ImageIcon size={22} />}
      </div>
      <div>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}
