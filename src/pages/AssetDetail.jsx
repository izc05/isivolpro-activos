import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardList, FileText, History, Image, MapPin, Package, QrCode, ShieldAlert, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import QRCodeCard from '../components/QR/QRCodeCard';
import DataTable from '../components/Cards/DataTable';
import { useRowById } from '../hooks/useRowById';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { exportAssetPdf } from '../utils/pdfExport';
import { qrDataUrl } from '../services/qrService';
import { loadAssetTimeline } from '../services/assetTimelineService';
import EntityImageViewer from '../components/Media/EntityImageViewer';
import { maintenanceStatusClass, maintenanceStatusLabel, maintenanceTypeLabel } from '../constants/maintenance';

export default function AssetDetail() {
  const { id } = useParams();
  const { row: asset } = useRowById('activos', id, '*, instalaciones(nombre), ubicaciones(nombre)');
  const { rows: documents } = useTenantRows('documentos', '*', { order: 'created_at' });
  const { rows: history } = useTenantRows('historial_mantenimiento', '*', { order: 'fecha' });
  const { rows: incidents } = useTenantRows('incidencias', '*', { order: 'fecha_apertura' });
  const [timelineData, setTimelineData] = useState(null);
  const [timelineError, setTimelineError] = useState('');

  useEffect(() => {
    if (!asset?.tenant_id || !id) return;
    let mounted = true;
    setTimelineError('');
    loadAssetTimeline(asset.tenant_id, id)
      .then((data) => {
        if (mounted) setTimelineData(data);
      })
      .catch((err) => {
        if (mounted) setTimelineError(err.message);
      });
    return () => {
      mounted = false;
    };
  }, [asset?.tenant_id, id]);

  if (!asset) return <PageHeader title="Activo" subtitle="Cargando ficha tecnica..." />;

  const assetDocuments = documents.filter((item) => item.activo_id === id);
  const assetHistory = history.filter((item) => item.activo_id === id);
  const assetIncidents = incidents.filter((item) => item.activo_id === id);
  const openIncidents = assetIncidents.filter((item) => item.estado !== 'cerrada' && item.estado !== 'descartada' && item.estado !== 'convertida_en_ot');
  const nextReview = asset.fecha_proxima_revision ? new Date(asset.fecha_proxima_revision) : null;
  const reviewDue = nextReview ? nextReview <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : false;
  const statusClass = asset.estado === 'correcto' ? 'ok' : asset.estado === 'averiado' || asset.estado === 'fuera_servicio' ? 'danger' : 'warn';
  const criticalClass = ['alta', 'critica'].includes(asset.criticidad) ? 'danger' : asset.criticidad === 'media' ? 'warn' : 'ok';
  const timeline = timelineData?.timeline || [];
  const metrics = timelineData?.metrics || { workOrders: 0, openWorkOrders: 0, incidents: 0, openIncidents: 0, materials: 0, reports: 0, photos: 0 };
  const assetPlans = timelineData?.plans || [];
  const activePlans = assetPlans.filter((item) => item.activo);
  const scheduledMaintenances = timelineData?.scheduled || [];
  const openCorrectives = scheduledMaintenances.filter((item) => item.tipo === 'correctivo' && !['completado', 'cancelado', 'no_aplica'].includes(item.estado));
  const overdueMaintenances = scheduledMaintenances.filter((item) => item.fecha_programada && new Date(item.fecha_programada) < new Date() && !['completado', 'cancelado', 'no_aplica'].includes(item.estado));
  const lastMaintenance = timelineData?.history?.[0];
  const pendingMaintenances = scheduledMaintenances.filter((item) => item.fecha_programada && !['completado', 'cancelado', 'no_aplica'].includes(item.estado)).sort((a, b) => new Date(a.fecha_programada) - new Date(b.fecha_programada));
  const nextMaintenance = pendingMaintenances[0];
  const accumulatedCost = (timelineData?.history || []).reduce((sum, item) => sum + Number(item.coste_total || 0), 0);
  const downtime = (timelineData?.history || []).reduce((sum, item) => sum + Number(item.tiempo_parada_minutos || 0), 0);
  const maintenanceHealthClass = overdueMaintenances.length || openCorrectives.length ? 'danger' : !activePlans.length ? 'warn' : 'ok';

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
        subtitle="Ficha tecnica, mantenimiento, incidencias, OT, materiales, fotos e historial del activo."
        action={<button className="primary-button" onClick={handlePdf}>Exportar PDF</button>}
      />

      <section className="asset-hero">
        <div className="asset-hero-main">
          <EntityImageViewer row={asset} entityType="activo" title={asset.nombre} className="asset-image-panel" />
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
        <article className="asset-summary-card"><FileText size={20} /><span>Documentos</span><strong>{assetDocuments.length}</strong></article>
        <article className="asset-summary-card"><ClipboardList size={20} /><span>Revisiones</span><strong>{assetHistory.length}</strong></article>
        <article className={`asset-summary-card ${metrics.openIncidents ? 'danger' : ''}`}><AlertTriangle size={20} /><span>Incidencias abiertas</span><strong>{metrics.openIncidents || openIncidents.length}</strong></article>
        <article className={`asset-summary-card ${reviewDue ? 'warn' : ''}`}><CalendarClock size={20} /><span>Proxima revision</span><strong>{formatDate(asset.fecha_proxima_revision)}</strong></article>
        <article className="asset-summary-card"><Wrench size={20} /><span>OT realizadas</span><strong>{metrics.workOrders}</strong></article>
        <article className="asset-summary-card"><Package size={20} /><span>Materiales</span><strong>{metrics.materials}</strong></article>
        <article className="asset-summary-card"><Image size={20} /><span>Fotos incidencia</span><strong>{metrics.photos}</strong></article>
        <article className="asset-summary-card"><FileText size={20} /><span>Informes OT</span><strong>{metrics.reports}</strong></article>
      </section>

      <section className="card maintenance-asset-panel">
        <div className={`asset-maintenance-header ${maintenanceHealthClass}`}>
          <div>
            <span className="section-eyebrow">Bloque Mantenimiento</span>
            <h2>Mantenimiento del activo</h2>
            <p>Planes, próximos trabajos, correctivos abiertos y resultado técnico consolidado.</p>
          </div>
          <span className={`badge ${maintenanceHealthClass}`}>{overdueMaintenances.length ? 'Tiene vencidos' : openCorrectives.length ? 'Correctivo abierto' : activePlans.length ? 'Planificado' : 'Sin plan'}</span>
        </div>
        <div className="section-title asset-maintenance-actions">
          <p className="muted">El plan define qué hacer, el calendario cuándo, la OT ejecuta y el historial conserva el resultado.</p>
          <div className="button-row">
            <Link className="secondary-button" to="/mantenimiento/planes">Crear plan</Link>
            <Link className="secondary-button" to="/mantenimiento/correctivos">Crear correctivo</Link>
            <Link className="secondary-button" to="/mantenimiento/historial">Registrar trabajo</Link>
            <Link className="primary-button" to="/mantenimiento/calendario">Abrir calendario</Link>
          </div>
        </div>
        <div className="asset-summary-grid maintenance-asset-metrics">
          <article className="asset-summary-card"><ClipboardList size={20} /><span>Planes activos</span><strong>{activePlans.length}</strong></article>
          <article className="asset-summary-card"><History size={20} /><span>Último mantenimiento</span><strong>{formatDate(lastMaintenance?.fecha)}</strong></article>
          <article className={`asset-summary-card ${nextMaintenance ? '' : 'warn'}`}><CalendarClock size={20} /><span>Próximo mantenimiento</span><strong>{formatDate(nextMaintenance?.fecha_programada)}</strong></article>
          <article className={`asset-summary-card ${overdueMaintenances.length ? 'danger' : ''}`}><AlertTriangle size={20} /><span>Vencidos</span><strong>{overdueMaintenances.length}</strong></article>
          <article className={`asset-summary-card ${openCorrectives.length ? 'danger' : ''}`}><Wrench size={20} /><span>Correctivos abiertos</span><strong>{openCorrectives.length}</strong></article>
          <article className="asset-summary-card"><Package size={20} /><span>Coste acumulado</span><strong>{accumulatedCost.toFixed(2)} €</strong></article>
          <article className="asset-summary-card"><CalendarClock size={20} /><span>Parada acumulada</span><strong>{downtime} min</strong></article>
        </div>
        <div className="asset-maintenance-board">
          <section>
            <h3>Planes del activo</h3>
            {activePlans.length === 0 ? (
              <p className="muted">Este activo todavía no tiene un plan preventivo activo.</p>
            ) : (
              <div className="asset-maintenance-list">
                {activePlans.slice(0, 3).map((plan) => (
                  <Link className="asset-maintenance-row" to={`/mantenimiento/planes/${plan.id}`} key={plan.id}>
                    <strong>{plan.nombre}</strong>
                    <span>{maintenanceTypeLabel(plan.tipo)} · {plan.periodicidad_unidad === 'manual' ? 'Periodicidad manual' : `Cada ${plan.periodicidad_valor || '-'} ${plan.periodicidad_unidad || ''}`}</span>
                    <em>Próxima: {formatDate(plan.fecha_proxima_realizacion)}</em>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3>Próximas actuaciones</h3>
            {pendingMaintenances.length === 0 ? (
              <p className="muted">No hay actuaciones programadas pendientes para este activo.</p>
            ) : (
              <div className="asset-maintenance-list">
                {pendingMaintenances.slice(0, 3).map((item) => (
                  <Link className={`asset-maintenance-row ${maintenanceStatusClass(item.estado_visual || item.estado)}`} to={item.ot_id ? `/ots/${item.ot_id}` : '/mantenimiento/pendientes'} key={item.id}>
                    <strong>{item.titulo}</strong>
                    <span>{maintenanceTypeLabel(item.tipo)} · {item.prioridad || 'media'}</span>
                    <em>{formatDate(item.fecha_programada)} · {maintenanceStatusLabel(item.estado_visual || item.estado)}</em>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3>Último resultado</h3>
            {lastMaintenance ? (
              <div className="asset-maintenance-result">
                <strong>{lastMaintenance.titulo || maintenanceTypeLabel(lastMaintenance.tipo)}</strong>
                <span>{formatDate(lastMaintenance.fecha_fin || lastMaintenance.fecha)} · {lastMaintenance.tecnico?.nombre || lastMaintenance.tecnico?.email || 'Sin técnico'}</span>
                <p>{lastMaintenance.trabajo_realizado || lastMaintenance.descripcion || lastMaintenance.resultado || 'Sin detalle registrado.'}</p>
              </div>
            ) : (
              <p className="muted">Todavía no hay intervenciones cerradas en el historial técnico.</p>
            )}
          </section>
        </div>
      </section>

      <CollapsibleSection title="Línea temporal técnica" subtitle="Historial único de mantenimientos, correctivos, incidencias, OT, materiales, fotos, informes y cambios de estado" icon={History} badge={`${timeline.length} eventos`} defaultOpen>
        {timelineError && <p className="error-text">{timelineError}</p>}
        {!timelineData && !timelineError && <p className="muted">Cargando historial técnico...</p>}
        {timelineData && timeline.length === 0 && <p className="muted">Todavía no hay eventos técnicos para este activo.</p>}
        {timeline.length > 0 && (
          <div className="asset-timeline">
            {timeline.map((event) => <TimelineEvent event={event} key={event.id} />)}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Ordenes de trabajo del activo" subtitle="OT vinculadas directamente a este activo" icon={Wrench} badge={`${timelineData?.workOrders?.length || 0}`} defaultOpen={false}>
        <DataTable columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link className="table-link" to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${['VALIDADA', 'CERRADA'].includes(row.estado) ? 'ok' : row.estado === 'CANCELADA' ? 'danger' : 'warn'}`}>{row.estado}</span> },
          { key: 'tecnico', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin tecnico' },
          { key: 'materials', label: 'Materiales', render: (row) => row.materials?.length || 0 },
          { key: 'reports', label: 'Informes', render: (row) => row.reports?.length || 0 }
        ]} rows={timelineData?.workOrders || []} empty="No hay OT vinculadas a este activo." />
      </CollapsibleSection>

      <CollapsibleSection title="Fotos de incidencias" subtitle="Evidencias recibidas desde QR o añadidas internamente" icon={Image} badge={`${metrics.photos}`} defaultOpen={false}>
        {(timelineData?.incidentPhotos || []).length === 0 ? (
          <p className="muted">No hay fotos de incidencias vinculadas a este activo.</p>
        ) : (
          <div className="incident-photo-grid">
            {timelineData.incidentPhotos.map((photo) => (
              <article className="incident-photo-card" key={photo.id}>
                <img src={photo.data_url} alt={photo.comentario || photo.file_name || 'Foto de incidencia'} />
                <small>{photo.source === 'public_qr' ? 'QR publico' : 'Interna'} · {formatDateTime(photo.created_at)}</small>
                {photo.comentario && <span>{photo.comentario}</span>}
              </article>
            ))}
          </div>
        )}
      </CollapsibleSection>

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
          <h2 className="section-heading"><AlertTriangle size={20} /> Incidencias</h2>
          <DataTable columns={[
            { key: 'titulo', label: 'Incidencia' },
            { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${row.prioridad === 'urgente' || row.prioridad === 'critica' ? 'danger' : 'warn'}`}>{row.prioridad}</span> },
            { key: 'estado', label: 'Estado', render: (row) => <span className={row.estado === 'cerrada' || row.estado === 'convertida_en_ot' ? 'badge ok' : 'badge warn'}>{row.estado}</span> }
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

function TimelineEvent({ event }) {
  const isOt = event.source === 'ot';
  const isMaintenance = event.source === 'mantenimiento';
  const isHistory = event.source === 'historial';
  return (
    <article className={`asset-timeline-item ${isOt ? 'ot' : isMaintenance || isHistory ? 'maintenance' : 'incident'}`}>
      <span className="asset-timeline-dot">{isOt || isHistory || isMaintenance ? <Wrench size={16} /> : <AlertTriangle size={16} />}</span>
      <div>
        <div className="asset-timeline-head">
          <strong>{event.title}</strong>
          <span className="muted">{formatDateTime(event.date)}</span>
        </div>
        <p>{event.subtitle}</p>
        <div className="quick-actions">
          {event.source === 'mantenimiento'
            ? <span className={`badge ${maintenanceStatusClass(event.status)}`}>{maintenanceStatusLabel(event.status)}</span>
            : <span className={`badge ${event.status === 'VALIDADA' || event.status === 'convertida_en_ot' || event.status === 'cerrada' ? 'ok' : event.status === 'CANCELADA' || event.status === 'descartada' ? 'danger' : 'warn'}`}>{event.status || maintenanceTypeLabel(event.source)}</span>}
          {event.priority && <span className="badge">{event.priority}</span>}
          {isOt && <span className="badge">{event.meta.visits} visita(s)</span>}
          {event.source === 'incidencia' && <span className="badge">{event.meta.photos} foto(s)</span>}
          {isHistory && <span className="badge">{Number(event.meta.cost || 0).toFixed(2)} €</span>}
          {isOt && <span className="badge">{event.meta.materials} material(es)</span>}
          {isOt && <span className="badge">{event.meta.reports} informe(s)</span>}
          <Link className="secondary-button" to={event.link}>{isOt || event.meta.hasOt ? 'Abrir OT' : isHistory ? 'Ver historial' : isMaintenance ? 'Ver pendientes' : 'Ver incidencias'}</Link>
        </div>
        {isHistory && event.meta.done && <p className="muted">{event.meta.done}</p>}
      </div>
    </article>
  );
}

function Detail({ label, value }) {
  return <div className="detail-item"><span>{label}</span><strong>{value || '-'}</strong></div>;
}
