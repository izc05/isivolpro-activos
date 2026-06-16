import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import QRCodeCard from '../components/QR/QRCodeCard';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';

const LEVELS = {
  instalacion: 'Instalacion',
  ubicacion: 'Ubicacion',
  activo: 'Activo'
};

export default function QRGenerator() {
  const { activeInstallationId, activeInstallation } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', '*', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', '*, instalaciones(nombre)', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', '*, instalaciones(nombre), ubicaciones(nombre)', { order: 'nombre', ascending: true });
  const [level, setLevel] = useState('instalacion');
  const [selectedId, setSelectedId] = useState(activeInstallationId || '');
  const [qrKind, setQrKind] = useState('internal');

  const visibleInstallations = useMemo(() => activeInstallationId ? installations.filter((item) => item.id === activeInstallationId) : installations, [installations, activeInstallationId]);
  const visibleLocations = useMemo(() => activeInstallationId ? locations.filter((item) => item.instalacion_id === activeInstallationId) : locations, [locations, activeInstallationId]);
  const visibleAssets = useMemo(() => activeInstallationId ? assets.filter((item) => item.instalacion_id === activeInstallationId) : assets, [assets, activeInstallationId]);

  useEffect(() => {
    if (activeInstallationId) {
      setLevel('instalacion');
      setSelectedId(activeInstallationId);
    }
  }, [activeInstallationId]);

  const options = useMemo(() => {
    if (level === 'instalacion') return visibleInstallations;
    if (level === 'ubicacion') return visibleLocations;
    return visibleAssets;
  }, [level, visibleInstallations, visibleLocations, visibleAssets]);

  const selected = useMemo(() => options.find((item) => item.id === selectedId) || options[0], [options, selectedId]);
  const cascade = useMemo(() => {
    if (!selected || level !== 'instalacion') return [];
    const installationLocations = visibleLocations.filter((location) => location.instalacion_id === selected.id);
    const installationAssets = visibleAssets.filter((asset) => asset.instalacion_id === selected.id);
    return [
      ...installationLocations.map((location) => ({ id: location.id, title: location.nombre, subtitle: qrKind === 'public-incident' ? 'Aviso externo ubicacion' : 'QR ubicacion', token: location.qr_token })),
      ...installationAssets.map((asset) => ({ id: asset.id, title: asset.nombre, subtitle: `${qrKind === 'public-incident' ? 'Aviso externo activo' : 'QR activo'}${asset.ubicaciones?.nombre ? ` - ${asset.ubicaciones.nombre}` : ''}`, token: asset.qr_token }))
    ];
  }, [selected, level, visibleLocations, visibleAssets, qrKind]);

  function changeLevel(nextLevel) {
    setLevel(nextLevel);
    setSelectedId(nextLevel === 'instalacion' && activeInstallationId ? activeInstallationId : '');
  }

  function subtitleFor(item) {
    if (!item) return '';
    const prefix = qrKind === 'public-incident' ? 'Aviso externo' : 'QR interno';
    if (level === 'instalacion') return `${prefix} de instalacion`;
    if (level === 'ubicacion') return `${prefix} - ${item.instalaciones?.nombre || 'ubicacion'}`;
    return `${prefix} - ${[item.instalaciones?.nombre, item.ubicaciones?.nombre].filter(Boolean).join(' - ') || 'activo'}`;
  }

  return (
    <>
      <PageHeader title="Generador de QR" subtitle={activeInstallation ? `QR filtrados de ${activeInstallation.nombre}.` : 'QR jerarquicos: instalacion, ubicacion y activo. El QR solo contiene token seguro.'} />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeInstallation.nombre}</p>}
      <div className="grid two">
        <div className="card form-grid">
          <div className="segmented">
            {Object.entries(LEVELS).map(([key, label]) => <button key={key} type="button" className={level === key ? 'active' : ''} onClick={() => changeLevel(key)}>{label}</button>)}
          </div>
          <label className="form-field">
            <span>{LEVELS[level]}</span>
            <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>
              {options.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Uso del QR</span><select value={qrKind} onChange={(event) => setQrKind(event.target.value)}><option value="internal">Acceso interno con permisos</option><option value="public-incident">Aviso externo sin documentos</option></select></label>
          <label className="form-field"><span>Tamano etiqueta</span><select defaultValue="medio"><option value="pequeno">Pequeno</option><option value="medio">Medio</option><option value="grande">Grande</option></select></label>
          <p className="muted">{qrKind === 'public-incident' ? 'Este QR permite reportar un aviso sin entrar a documentos ni fichas privadas. Se limita un aviso por contacto y QR durante un tiempo.' : 'Escanear instalacion abre la ficha completa con ubicaciones y activos. Escanear ubicacion abre la zona. Escanear activo abre su ficha tecnica.'}</p>
        </div>
        {selected && <QRCodeCard token={selected.qr_token} title={selected.nombre} subtitle={subtitleFor(selected)} kind={qrKind} />}
      </div>

      {level === 'instalacion' && selected && (
        <section className="section-stack">
          <div className="section-title"><h2>Cascada QR de {selected.nombre}</h2></div>
          <div className="qr-grid">
            <QRCodeCard token={selected.qr_token} title={selected.nombre} subtitle={qrKind === 'public-incident' ? 'Aviso externo instalacion' : 'QR general instalacion'} compact kind={qrKind} />
            {cascade.map((item) => <QRCodeCard key={item.id} token={item.token} title={item.title} subtitle={item.subtitle} compact kind={qrKind} />)}
          </div>
        </section>
      )}
    </>
  );
}
