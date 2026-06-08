import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Image, MapPin, Plus, Video, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import QRCodeCard from '../components/QR/QRCodeCard';
import DataTable from '../components/Cards/DataTable';
import MetricCard from '../components/Cards/MetricCard';
import EntityIdentity from '../components/Cards/EntityIdentity';
import Modal from '../components/Layout/Modal';
import FormField from '../components/Forms/FormField';
import { useRowById } from '../hooks/useRowById';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { createAsset, createLocation } from '../services/entityService';
import { shortId } from '../utils/qrUtils';
import { buildMapsEmbedUrl, buildMapsUrl } from '../utils/mapUtils';

export default function InstallationDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('resumen');
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [error, setError] = useState('');
  const emptyLocationForm = { instalacion_id: id, nombre: '', tipo: '', planta: '', zona: '', descripcion: '', image_file: null };
  const emptyAssetForm = {
    instalacion_id: id,
    ubicacion_id: '',
    nombre: '',
    tipo: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    referencia: '',
    estado: 'correcto',
    criticidad: 'media',
    fecha_instalacion: '',
    fecha_ultima_revision: '',
    fecha_proxima_revision: '',
    observaciones: ''
  };
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const { row } = useRowById('instalaciones', id, '*, tenants(nombre)');
  const { rows: locations, activeTenantId, refresh: refreshLocations } = useTenantRows('ubicaciones', '*', { order: 'created_at' });
  const { rows: assets, refresh: refreshAssets } = useTenantRows('activos', '*, ubicaciones(nombre)', { order: 'created_at' });
  const { rows: documents } = useTenantRows('documentos', '*, activos(nombre), ubicaciones(nombre)', { order: 'created_at' });
  const { rows: photos } = useTenantRows('fotos', '*, activos(nombre), ubicaciones(nombre)', { order: 'created_at' });
  const { rows: videos } = useTenantRows('videos', '*, activos(nombre), ubicaciones(nombre)', { order: 'created_at' });
  const { rows: incidents } = useTenantRows('incidencias', '*, activos(nombre), ubicaciones(nombre)', { order: 'fecha_apertura' });
  const { rows: history } = useTenantRows('historial_mantenimiento', '*, activos!inner(nombre,instalacion_id)', { order: 'fecha' });
  const filteredLocations = locations.filter((location) => location.instalacion_id === id);
  const filteredAssets = assets.filter((asset) => asset.instalacion_id === id);
  const filteredDocuments = documents.filter((item) => item.instalacion_id === id || filteredAssets.some((asset) => asset.id === item.activo_id) || filteredLocations.some((location) => location.id === item.ubicacion_id));
  const filteredPhotos = photos.filter((item) => item.instalacion_id === id || filteredAssets.some((asset) => asset.id === item.activo_id) || filteredLocations.some((location) => location.id === item.ubicacion_id));
  const filteredVideos = videos.filter((item) => item.instalacion_id === id || filteredAssets.some((asset) => asset.id === item.activo_id) || filteredLocations.some((location) => location.id === item.ubicacion_id));
  const filteredIncidents = incidents.filter((item) => item.instalacion_id === id);
  const filteredHistory = history.filter((item) => item.activos?.instalacion_id === id);
  const assetsByLocation = useMemo(() => {
    return filteredLocations.map((location) => ({
      ...location,
      assets: filteredAssets.filter((asset) => asset.ubicacion_id === location.id)
    }));
  }, [filteredLocations, filteredAssets]);
  const unassignedAssets = filteredAssets.filter((asset) => !asset.ubicacion_id);

  if (!row) return <PageHeader title="Instalacion" subtitle="Cargando..." />;

  const pendingAssets = filteredAssets.filter((asset) => ['pendiente', 'averiado', 'fuera_servicio'].includes(asset.estado)).length;
  const openIncidents = filteredIncidents.filter((incident) => incident.estado !== 'cerrada').length;
  const mapsUrl = buildMapsUrl(row);
  const mapsEmbedUrl = buildMapsEmbedUrl(row);

  function updateLocationField(field, value) {
    setLocationForm((current) => ({ ...current, [field]: value }));
  }

  function updateAssetField(field, value) {
    setAssetForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLocation(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    try {
      await createLocation(activeTenantId, { ...locationForm, instalacion_id: id });
      setLocationForm(emptyLocationForm);
      formElement.reset();
      setLocationModalOpen(false);
      refreshLocations();
      setActiveTab('ubicaciones');
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitAsset(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    try {
      await createAsset(activeTenantId, { ...assetForm, instalacion_id: id });
      setAssetForm(emptyAssetForm);
      formElement.reset();
      setAssetModalOpen(false);
      refreshAssets();
      setActiveTab('activos');
    } catch (err) {
      setError(err.message);
    }
  }

  function openAssetForLocation(locationId) {
    setAssetForm({ ...emptyAssetForm, ubicacion_id: locationId });
    setAssetModalOpen(true);
  }

  return (
    <>
      <PageHeader
        title={row.nombre}
        subtitle={row.descripcion || row.direccion}
        action={<Link className="secondary-button" to="/instalaciones">Volver a instalaciones</Link>}
      />
      <div className="installation-hero">
        <EntityIdentity row={row} entityType="instalacion" title={row.nombre} subtitle={row.tenants?.nombre || row.direccion || row.tipo} size="hero" />
        <div className="quick-actions">
          <button className="secondary-button" onClick={() => setLocationModalOpen(true)}><MapPin size={17} /> Nueva ubicacion</button>
          <button className="secondary-button" onClick={() => setAssetModalOpen(true)}><Wrench size={17} /> Nuevo activo</button>
          <Link className="secondary-button" to="/documentos"><FileText size={17} /> Subir documento</Link>
        </div>
      </div>
      <div className="grid metrics">
        <MetricCard label="Ubicaciones" value={filteredLocations.length} />
        <MetricCard label="Activos" value={filteredAssets.length} />
        <MetricCard label="Activos con aviso" value={pendingAssets} tone={pendingAssets ? 'warn' : 'default'} />
        <MetricCard label="Incidencias abiertas" value={openIncidents} tone={openIncidents ? 'danger' : 'default'} />
      </div>
      <div className="grid two">
        <div className="card">
          <p><strong>Codigo:</strong> {row.codigo || '-'}</p>
          <p><strong>Cliente:</strong> {row.tenants?.nombre || row.tenant_id}</p>
          <p><strong>Tipo:</strong> {row.tipo || '-'}</p>
          <p><strong>Direccion:</strong> {row.direccion || '-'}</p>
          <p><strong>Coordenadas:</strong> {row.latitud && row.longitud ? `${row.latitud}, ${row.longitud}` : '-'}</p>
          <p><strong>Contacto:</strong> {row.contacto_nombre || '-'} {row.contacto_telefono || ''}</p>
          <p><strong>Email:</strong> {row.contacto_email || '-'}</p>
          {mapsUrl && <a className="secondary-button" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={16} /> Como llegar</a>}
        </div>
        <QRCodeCard token={row.qr_token} title={row.nombre} />
      </div>
      {mapsEmbedUrl && (
        <div className="map-card">
          <iframe title={`Mapa ${row.nombre}`} src={mapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      )}

      <div className="tabs">
        {[
          ['resumen', 'Resumen'],
          ['ubicaciones', 'Ubicaciones'],
          ['activos', 'Activos'],
          ['qr', 'QR cascada'],
          ['documentos', 'Documentos'],
          ['media', 'Fotos y videos'],
          ['mantenimiento', 'Incidencias e historial']
        ].map(([tab, label]) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{label}</button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}

      <section className="section-stack">
        {activeTab === 'resumen' && (
          <InstallationMap assetsByLocation={assetsByLocation} onCreateLocation={() => setLocationModalOpen(true)} onCreateAsset={openAssetForLocation} />
        )}

        {activeTab === 'ubicaciones' && (
          <>
            <SectionTitle icon={MapPin} title="Ubicaciones de esta instalacion" action={<button className="ghost-button" onClick={() => setLocationModalOpen(true)}><Plus size={16} /> Crear ubicacion</button>} />
            <DataTable columns={[
              { key: 'nombre', label: 'Ubicacion', render: (location) => <Link to={`/ubicaciones/${location.id}`}><EntityIdentity row={location} entityType="ubicacion" title={location.nombre} subtitle={location.tipo || location.zona} /></Link> },
              { key: 'planta', label: 'Planta' },
              { key: 'zona', label: 'Zona' },
              { key: 'qr', label: 'QR zona', render: (location) => <span className="badge">QR {shortId(location.qr_token)}</span> },
              { key: 'actions', label: 'Acciones', render: (location) => <button className="secondary-button" onClick={() => openAssetForLocation(location.id)}><Plus size={15} /> Activo aqui</button> }
            ]} rows={filteredLocations} />
          </>
        )}

        {activeTab === 'activos' && (
          <>
            <SectionTitle icon={Wrench} title="Activos de esta instalacion" action={<button className="ghost-button" onClick={() => setAssetModalOpen(true)}><Plus size={16} /> Crear activo</button>} />
            <DataTable columns={[
              { key: 'nombre', label: 'Activo', render: (asset) => <Link to={`/activos/${asset.id}`}>{asset.nombre}</Link> },
              { key: 'tipo', label: 'Tipo' },
              { key: 'ubicacion', label: 'Ubicacion', render: (asset) => asset.ubicaciones?.nombre || '-' },
              { key: 'qr', label: 'QR activo', render: (asset) => <span className="badge">QR {shortId(asset.qr_token)}</span> },
              { key: 'estado', label: 'Estado', render: (asset) => <span className={`badge ${asset.estado === 'correcto' ? 'ok' : 'warn'}`}>{asset.estado}</span> },
              { key: 'fecha_proxima_revision', label: 'Proxima revision', render: (asset) => formatDate(asset.fecha_proxima_revision) }
            ]} rows={filteredAssets} />
          </>
        )}

        {activeTab === 'qr' && (
          <>
            <SectionTitle icon={MapPin} title="Codigos QR relacionados" />
            <div className="qr-cascade">
              <div>
                <h3>Instalacion general</h3>
                <QRCodeCard token={row.qr_token} title={row.nombre} subtitle="Abre toda la instalacion" compact />
              </div>
              {assetsByLocation.map((location) => (
                <div className="qr-cascade-group" key={location.id}>
                  <h3>{location.nombre}</h3>
                  <div className="qr-grid">
                    <QRCodeCard token={location.qr_token} title={location.nombre} subtitle="QR de ubicacion" compact />
                    {location.assets.map((asset) => (
                      <QRCodeCard key={asset.id} token={asset.qr_token} title={asset.nombre} subtitle="QR de activo" compact />
                    ))}
                  </div>
                </div>
              ))}
              {unassignedAssets.length > 0 && (
                <div className="qr-cascade-group">
                  <h3>Activos sin ubicacion asignada</h3>
                  <div className="qr-grid">
                    {unassignedAssets.map((asset) => (
                      <QRCodeCard key={asset.id} token={asset.qr_token} title={asset.nombre} subtitle="QR de activo" compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'documentos' && (
          <>
            <SectionTitle icon={FileText} title="Documentos asociados" action={<Link to="/documentos" className="ghost-button"><Plus size={16} /> Subir documento</Link>} />
            <DataTable columns={[
              { key: 'titulo', label: 'Documento' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'asociado', label: 'Asociado a', render: (item) => item.activos?.nombre || item.ubicaciones?.nombre || row.nombre },
              { key: 'visibilidad', label: 'Visibilidad', render: (item) => <span className="badge">{item.visibilidad}</span> }
            ]} rows={filteredDocuments} />
          </>
        )}

        {activeTab === 'media' && (
          <div className="grid two">
            <div>
              <SectionTitle icon={Image} title="Fotos" />
              <DataTable columns={[
                { key: 'titulo', label: 'Foto' },
                { key: 'asociado', label: 'Asociada a', render: (item) => item.activos?.nombre || item.ubicaciones?.nombre || row.nombre },
                { key: 'file_name', label: 'Archivo' }
              ]} rows={filteredPhotos} />
            </div>
            <div>
              <SectionTitle icon={Video} title="Videos" />
              <DataTable columns={[
                { key: 'titulo', label: 'Video' },
                { key: 'asociado', label: 'Asociado a', render: (item) => item.activos?.nombre || item.ubicaciones?.nombre || row.nombre },
                { key: 'visibilidad', label: 'Visibilidad' }
              ]} rows={filteredVideos} />
            </div>
          </div>
        )}

        {activeTab === 'mantenimiento' && (
          <>
            <SectionTitle icon={AlertTriangle} title="Incidencias e historial" />
            <div className="grid two">
              <DataTable columns={[
                { key: 'titulo', label: 'Incidencia' },
                { key: 'prioridad', label: 'Prioridad' },
                { key: 'estado', label: 'Estado' },
                { key: 'fecha_apertura', label: 'Apertura', render: (item) => formatDateTime(item.fecha_apertura) }
              ]} rows={filteredIncidents} />
              <DataTable columns={[
                { key: 'fecha', label: 'Fecha', render: (item) => formatDate(item.fecha) },
                { key: 'activo', label: 'Activo', render: (item) => item.activos?.nombre },
                { key: 'tipo', label: 'Tipo' },
                { key: 'titulo', label: 'Trabajo' }
              ]} rows={filteredHistory} />
            </div>
          </>
        )}
      </section>

      <Modal title="Nueva ubicacion de esta instalacion" open={locationModalOpen} onClose={() => setLocationModalOpen(false)}>
        <form className="form-grid" onSubmit={submitLocation}>
          <div className="locked-field">
            <span>Instalacion</span>
            <strong>{row.nombre}</strong>
          </div>
          <FormField label="Nombre de ubicacion"><input value={locationForm.nombre} onChange={(event) => updateLocationField('nombre', event.target.value)} required /></FormField>
          <div className="grid two">
            <FormField label="Tipo"><input value={locationForm.tipo} onChange={(event) => updateLocationField('tipo', event.target.value)} placeholder="Sala tecnica, cocina, planta..." /></FormField>
            <FormField label="Planta"><input value={locationForm.planta} onChange={(event) => updateLocationField('planta', event.target.value)} /></FormField>
          </div>
          <FormField label="Zona"><input value={locationForm.zona} onChange={(event) => updateLocationField('zona', event.target.value)} /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={locationForm.descripcion} onChange={(event) => updateLocationField('descripcion', event.target.value)} /></FormField>
          <FormField label="Imagen de zona"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateLocationField('image_file', event.target.files?.[0] || null)} /></FormField>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setLocationModalOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Crear ubicacion</button>
          </div>
        </form>
      </Modal>

      <Modal title="Nuevo activo de esta instalacion" open={assetModalOpen} onClose={() => setAssetModalOpen(false)}>
        <form className="form-grid" onSubmit={submitAsset}>
          <div className="locked-field">
            <span>Instalacion</span>
            <strong>{row.nombre}</strong>
          </div>
          <FormField label="Ubicacion">
            <select value={assetForm.ubicacion_id} onChange={(event) => updateAssetField('ubicacion_id', event.target.value)}>
              <option value="">Sin ubicacion concreta</option>
              {filteredLocations.map((location) => <option key={location.id} value={location.id}>{location.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Nombre del activo"><input value={assetForm.nombre} onChange={(event) => updateAssetField('nombre', event.target.value)} required /></FormField>
          <div className="grid two">
            <FormField label="Tipo"><input value={assetForm.tipo} onChange={(event) => updateAssetField('tipo', event.target.value)} /></FormField>
            <FormField label="Criticidad">
              <select value={assetForm.criticidad} onChange={(event) => updateAssetField('criticidad', event.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Critica</option>
              </select>
            </FormField>
          </div>
          <div className="grid two">
            <FormField label="Marca"><input value={assetForm.marca} onChange={(event) => updateAssetField('marca', event.target.value)} /></FormField>
            <FormField label="Modelo"><input value={assetForm.modelo} onChange={(event) => updateAssetField('modelo', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Numero de serie"><input value={assetForm.numero_serie} onChange={(event) => updateAssetField('numero_serie', event.target.value)} /></FormField>
            <FormField label="Proxima revision"><input type="date" value={assetForm.fecha_proxima_revision} onChange={(event) => updateAssetField('fecha_proxima_revision', event.target.value)} /></FormField>
          </div>
          <FormField label="Observaciones"><textarea rows="3" value={assetForm.observaciones} onChange={(event) => updateAssetField('observaciones', event.target.value)} /></FormField>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setAssetModalOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Crear activo con QR</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function SectionTitle({ icon: Icon, title, action }) {
  return (
    <div className="section-title">
      <h2>{Icon && <Icon size={20} />} {title}</h2>
      {action}
    </div>
  );
}

function InstallationMap({ assetsByLocation, onCreateLocation, onCreateAsset }) {
  return (
    <>
      <SectionTitle icon={MapPin} title="Mapa tecnico de la instalacion" action={<button className="ghost-button" onClick={onCreateLocation}><Plus size={16} /> Crear ubicacion</button>} />
      <div className="location-map">
        {assetsByLocation.length === 0 && (
          <div className="empty-state">
            <strong>Sin ubicaciones todavia</strong>
            <span>Crea una ubicacion para empezar a ordenar los activos por zonas.</span>
            <button className="primary-button" onClick={onCreateLocation}>Crear primera ubicacion</button>
          </div>
        )}
        {assetsByLocation.map((location) => (
          <article className="location-card" key={location.id}>
            <header>
              <EntityIdentity row={location} entityType="ubicacion" title={location.nombre} subtitle={location.tipo || location.zona} size="card" />
              <span className="badge">QR zona {shortId(location.qr_token)}</span>
            </header>
            <div className="location-assets">
              {location.assets.length === 0 && <p className="muted">Sin activos en esta ubicacion.</p>}
              {location.assets.map((asset) => (
                <Link className="asset-chip" to={`/activos/${asset.id}`} key={asset.id}>
                  <Wrench size={15} />
                  <span>{asset.nombre}</span>
                  <small>QR {shortId(asset.qr_token)}</small>
                </Link>
              ))}
            </div>
            <button className="secondary-button" onClick={() => onCreateAsset(location.id)}><Plus size={15} /> Crear activo en esta ubicacion</button>
          </article>
        ))}
      </div>
    </>
  );
}
