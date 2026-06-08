import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardList, FileText, MapPin, QrCode, ShieldAlert, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import QRCodeCard from '../components/QR/QRCodeCard';
import DataTable from '../components/Cards/DataTable';
import { useRowById } from '../hooks/useRowById';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDate } from '../utils/dateUtils';
import { exportAssetPdf } from '../utils/pdfExport';
import { qrDataUrl } from '../services/qrService';

export default function AssetDetail() {
  const { id } = useParams();
  const { row: asset } = useRowById('activos', id, '*, instalaciones(nombre), ubicaciones(nombre)');
  const { rows: documents } = useTenantRows('documentos', '*', { order: 'created_at' });
  const { rows: history } = useTenantRows('historial_mantenimiento', '*', { order: 'fecha' });
  const { rows: incidents } = useTenantRows('incidencias', '*', { order: 'fecha_apertura' });

  if (!asset) return <PageHeader title="Activo" subtitle="Cargando ficha tecnica..." />;

  const assetDocuments = documents.filter((item) => item.activo_id === id);
  const assetHistory = history.filter((item) => item.activo_id === id);
  const assetIncidents = incidents.filter((item) => item.activo_id === id);
  const openIncidents = assetIncidents.filter((item) => item.estado !== 'cerrada');
  const nextReview = asset.fecha_proxima_revision ? new Date(asset.fecha_proxima_revision) : null;
  const reviewDue = nextReview ? nextReview <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : false;
  const statusClass = asset.estado === 'correcto' ? 'ok' : asset.estado === 'averiado' || asset.estado === 'fuera_servicio' ? 'danger' : 'warn';
  const criticalClass = ['alta', 'critica'].includes(asset.criticidad) ? 'danger' : asset.criticidad === 'media' ? 'warn' : 'ok';

  async function handlePdf() {
    exportAssetPdf({
      asset,
      installation: asset.instalaciones,
      location: asset.ubicaciones,
      documents: assetDocuments,
      history: assetHistory,
      qrDataUrl: await qrDataUrl(asset.qr_token)
    });
  }

  return (
    <>
      <PageHeader
        title={asset.nombre}
        subtitle="Ficha tecnica, mantenimiento, incidencias y QR del activo."
        action={<button className="primary-button" onClick={handlePdf}>Exportar PDF</button>}
      />

      <section className="asset-hero">
        <div className="asset-hero-main">
          <div className="asset-icon-panel">
            <Wrench size={42} />
          </div>
          <div>
            <div className="inline-actions">
              <span className={`badge ${statusClass}`}>{asset.estado}</span>
              <span className={`badge ${criticalClass}`}>Criticidad {asset.criticidad}</span>
              {reviewDue && <span className="badge warn">Revision cercana</span>}
              {openIncidents.length > 0 && <span className="badge danger">{openIncidents.length} incidencia abierta</span>}
            </div>
            <h2>{asset.tipo || 'Activo tecnico'}</h2>
            <p>{asset.descripcion || asset.observaciones || 'Sin descripcion tecnica registrada.'}</p>
            <div className="asset-location-line">
              <MapPin size={17} />
              <span>{asset.instalaciones?.nombre || 'Sin instalacion'}{asset.ubicaciones?.nombre ? ` / ${asset.ubicaciones.nombre}` : ''}</span>
            </div>
          </div>
        </div>
        <div className="asset-qr-panel">
          <QRCodeCard token={asset.qr_token} title={asset.nombre} compact />
        </div>
      </section>

      <section className="asset-summary-grid">
        <article className="asset-summary-card">
          <FileText size={20} />
          <span>Documentos</span>
          <strong>{assetDocuments.length}</strong>
        </article>
        <article className="asset-summary-card">
          <ClipboardList size={20} />
          <span>Revisiones</span>
          <strong>{assetHistory.length}</strong>
        </article>
        <article className={`asset-summary-card ${openIncidents.length ? 'danger' : ''}`}>
          <AlertTriangle size={20} />
          <span>Incidencias abiertas</span>
          <strong>{openIncidents.length}</strong>
        </article>
        <article className={`asset-summary-card ${reviewDue ? 'warn' : ''}`}>
          <CalendarClock size={20} />
          <span>Proxima revision</span>
          <strong>{formatDate(asset.fecha_proxima_revision)}</strong>
        </article>
      </section>

      <div className="grid two asset-detail-grid">
        <section className="card">
          <h2 className="section-heading"><Wrench size={20} /> Datos tecnicos</h2>
          <div className="detail-list">
            <Detail label="Marca" value={asset.marca} />
            <Detail label="Modelo" value={asset.modelo} />
            <Detail label="Numero de serie" value={asset.numero_serie} />
            <Detail label="Referencia" value={asset.referencia} />
            <Detail label="Fecha instalacion" value={formatDate(asset.fecha_instalacion)} />
            <Detail label="Ultima revision" value={formatDate(asset.fecha_ultima_revision)} />
          </div>
        </section>

        <section className="card">
          <h2 className="section-heading"><ShieldAlert size={20} /> Control operativo</h2>
          <div className="detail-list">
            <Detail label="Instalacion" value={asset.instalaciones?.nombre} />
            <Detail label="Ubicacion" value={asset.ubicaciones?.nombre} />
            <Detail label="Estado" value={asset.estado} />
            <Detail label="Criticidad" value={asset.criticidad} />
            <Detail label="QR" value={asset.qr_token?.slice(0, 10)?.toUpperCase()} />
            <Detail label="Observaciones" value={asset.observaciones} />
          </div>
        </section>
      </div>

      <div className="section-stack">
        <section>
          <h2 className="section-heading"><FileText size={20} /> Documentacion del activo</h2>
          <DataTable columns={[
            { key: 'titulo', label: 'Documento' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'visibilidad', label: 'Visibilidad', render: (row) => <span className="badge">{row.visibilidad}</span> }
          ]} rows={assetDocuments} empty="Este activo no tiene documentos asociados." />
        </section>

        <section>
          <h2 className="section-heading"><ClipboardList size={20} /> Historial de mantenimiento</h2>
          <DataTable columns={[
            { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha) },
            { key: 'tipo', label: 'Tipo' },
            { key: 'titulo', label: 'Trabajo realizado' }
          ]} rows={assetHistory} empty="Todavia no hay historial para este activo." />
        </section>

        <section>
          <h2 className="section-heading"><AlertTriangle size={20} /> Incidencias</h2>
          <DataTable columns={[
            { key: 'titulo', label: 'Incidencia' },
            { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${row.prioridad === 'urgente' ? 'danger' : 'warn'}`}>{row.prioridad}</span> },
            { key: 'estado', label: 'Estado', render: (row) => <span className={row.estado === 'cerrada' ? 'badge ok' : 'badge warn'}>{row.estado}</span> }
          ]} rows={assetIncidents} empty="No hay incidencias registradas." />
        </section>

        <div className="button-row">
          <Link className="ghost-button" to="/activos">Volver a activos</Link>
          <Link className="secondary-button" to="/documentos">Subir documento</Link>
          <Link className="secondary-button" to="/incidencias">Crear incidencia</Link>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}
