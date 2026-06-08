import { useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import QRCodeCard from '../components/QR/QRCodeCard';
import { useTenantRows } from '../hooks/useTenantRows';

const LEVELS = {
  instalacion: 'Instalacion',
  ubicacion: 'Ubicacion',
  activo: 'Activo'
};

export default function QRGenerator() {
  const { rows: installations } = useTenantRows('instalaciones', '*', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', '*, instalaciones(nombre)', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', '*, instalaciones(nombre), ubicaciones(nombre)', { order: 'nombre', ascending: true });
  const [level, setLevel] = useState('instalacion');
  const [selectedId, setSelectedId] = useState('');

  const options = useMemo(() => {
    if (level === 'instalacion') return installations;
    if (level === 'ubicacion') return locations;
    return assets;
  }, [level, installations, locations, assets]);

  const selected = useMemo(() => options.find((item) => item.id === selectedId) || options[0], [options, selectedId]);
  const cascade = useMemo(() => {
    if (!selected || level !== 'instalacion') return [];
    const installationLocations = locations.filter((location) => location.instalacion_id === selected.id);
    const installationAssets = assets.filter((asset) => asset.instalacion_id === selected.id);
    return [
      ...installationLocations.map((location) => ({
        id: location.id,
        title: location.nombre,
        subtitle: 'QR ubicacion',
        token: location.qr_token
      })),
      ...installationAssets.map((asset) => ({
        id: asset.id,
        title: asset.nombre,
        subtitle: `QR activo${asset.ubicaciones?.nombre ? ` - ${asset.ubicaciones.nombre}` : ''}`,
        token: asset.qr_token
      }))
    ];
  }, [selected, level, locations, assets]);

  function changeLevel(nextLevel) {
    setLevel(nextLevel);
    setSelectedId('');
  }

  function subtitleFor(item) {
    if (!item) return '';
    if (level === 'instalacion') return 'QR general de instalacion';
    if (level === 'ubicacion') return item.instalaciones?.nombre || 'QR de ubicacion';
    return [item.instalaciones?.nombre, item.ubicaciones?.nombre].filter(Boolean).join(' - ') || 'QR de activo';
  }

  return (
    <>
      <PageHeader title="Generador de QR" subtitle="QR jerarquicos: instalacion, ubicacion y activo. El QR solo contiene token seguro." />
      <div className="grid two">
        <div className="card form-grid">
          <div className="segmented">
            {Object.entries(LEVELS).map(([key, label]) => (
              <button key={key} type="button" className={level === key ? 'active' : ''} onClick={() => changeLevel(key)}>{label}</button>
            ))}
          </div>
          <label className="form-field">
            <span>{LEVELS[level]}</span>
            <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>
              {options.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tamano etiqueta</span>
            <select defaultValue="medio">
              <option value="pequeno">Pequeno</option>
              <option value="medio">Medio</option>
              <option value="grande">Grande</option>
            </select>
          </label>
          <p className="muted">Escanear instalacion abre la ficha completa con ubicaciones y activos. Escanear ubicacion abre la zona. Escanear activo abre su ficha tecnica.</p>
        </div>
        {selected && <QRCodeCard token={selected.qr_token} title={selected.nombre} subtitle={subtitleFor(selected)} />}
      </div>

      {level === 'instalacion' && selected && (
        <section className="section-stack">
          <div className="section-title">
            <h2>Cascada QR de {selected.nombre}</h2>
          </div>
          <div className="qr-grid">
            <QRCodeCard token={selected.qr_token} title={selected.nombre} subtitle="QR general instalacion" compact />
            {cascade.map((item) => (
              <QRCodeCard key={item.id} token={item.token} title={item.title} subtitle={item.subtitle} compact />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
