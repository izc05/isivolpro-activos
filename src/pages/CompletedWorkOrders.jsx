import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Download, Filter, FileText, Image, Package, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import DataTable from '../components/Cards/DataTable';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderThumbnail from '../components/WorkOrders/WorkOrderThumbnail';
import { useTenant } from '../hooks/useTenant';
import {
  listChecklistPhotos,
  listWorkOrderChecklist,
  listWorkOrders,
  signedChecklistPhotoUrl
} from '../services/workOrderService';
import { generateWorkOrderPdfBlob } from '../services/workOrderPdfService';
import { formatDateTime } from '../utils/dateUtils';
import { normalizedStatus, priorityLabel, priorityTone, workOrderTypeLabel } from '../utils/workOrderLifecycle';
import { supabase } from '../services/supabaseClient';

const DONE_STATUSES = ['FINALIZADA', 'VALIDADA', 'CERRADA', 'FIRMADA', 'INFORME_GENERADO'];

export default function CompletedWorkOrders() {
  const { activeTenantId, activeInstallationId, activeInstallation } = useTenant();
  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [reports, setReports] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [checklistRows, setChecklistRows] = useState([]);
  const [checklistPhotos, setChecklistPhotos] = useState({});
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: 'todas', date: 'todas' });

  async function refresh() {
    if (!activeTenantId) return;
    setLoading(true);
    setError('');
    try {
      const workOrders = await listWorkOrders(activeTenantId);
      const completed = workOrders.filter((row) => DONE_STATUSES.includes(normalizedStatus(row.estado)) || DONE_STATUSES.includes(row.estado));
      const otIds = completed.map((row) => row.id);
      const [materialsRes, reportsRes, photosRes] = await Promise.all([
        otIds.length ? supabase.from('ot_visita_materiales').select('*').eq('tenant_id', activeTenantId).in('ot_id', otIds) : Promise.resolve({ data: [], error: null }),
        otIds.length ? supabase.from('ot_informes').select('*').eq('tenant_id', activeTenantId).in('ot_id', otIds) : Promise.resolve({ data: [], error: null }),
        otIds.length ? supabase.from('ot_fotos').select('*').eq('tenant_id', activeTenantId).in('ot_id', otIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null })
      ]);
      if (materialsRes.error) throw materialsRes.error;
      if (reportsRes.error) throw reportsRes.error;
      if (photosRes.error) throw photosRes.error;
      setRows(completed);
      setMaterials(materialsRes.data || []);
      setReports(reportsRes.data || []);
      setPhotos(photosRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId]);

  const visibleRows = useMemo(
    () => activeInstallationId ? rows.filter((row) => row.instalacion_id === activeInstallationId) : rows,
    [rows, activeInstallationId]
  );

  const visibleOtIds = useMemo(() => new Set(visibleRows.map((row) => row.id)), [visibleRows]);
  const visibleMaterials = useMemo(() => materials.filter((item) => visibleOtIds.has(item.ot_id)), [materials, visibleOtIds]);
  const visibleReports = useMemo(() => reports.filter((item) => visibleOtIds.has(item.ot_id)), [reports, visibleOtIds]);
  const visiblePhotos = useMemo(() => photos.filter((item) => visibleOtIds.has(item.ot_id)), [photos, visibleOtIds]);

  const materialCountByOt = useMemo(() => countBy(visibleMaterials, 'ot_id'), [visibleMaterials]);
  const reportCountByOt = useMemo(() => countBy(visibleReports, 'ot_id'), [visibleReports]);
  const photoCountByOt = useMemo(() => countBy(visiblePhotos, 'ot_id'), [visiblePhotos]);

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    const now = new Date();
    return visibleRows.filter((row) => {
      const searchable = `${row.codigo_ot || ''} ${row.titulo || ''} ${row.instalaciones?.nombre || ''} ${row.ubicaciones?.nombre || ''} ${row.activos?.nombre || ''} ${row.assigned?.nombre || ''} ${row.assigned?.email || ''}`.toLowerCase();
      const matchText = !text || searchable.includes(text);
      const matchStatus = filters.status === 'todas' || normalizedStatus(row.estado) === filters.status || row.estado === filters.status;
      const dateValue = row.fecha_fin || row.closed_at || row.updated_at || row.created_at;
      const date = dateValue ? new Date(dateValue) : null;
      const matchDate = filters.date === 'todas'
        || (filters.date === '30' && date && now - date <= 30 * 24 * 60 * 60 * 1000)
        || (filters.date === '90' && date && now - date <= 90 * 24 * 60 * 60 * 1000)
        || (filters.date === 'year' && date && date.getFullYear() === now.getFullYear());
      return matchText && matchStatus && matchDate;
    });
  }, [visibleRows, filters]);

  const metrics = useMemo(() => ({
    realizadas: visibleRows.length,
    finalizadas: visibleRows.filter((row) => normalizedStatus(row.estado) === 'FINALIZADA').length,
    validadas: visibleRows.filter((row) => normalizedStatus(row.estado) === 'VALIDADA' || row.estado === 'CERRADA').length,
    materiales: visibleMaterials.length,
    informes: visibleReports.length,
    fotos: visiblePhotos.length
  }), [visibleRows, visibleMaterials, visibleReports, visiblePhotos]);

  async function openChecklist(row) {
    setSelectedOrder(row);
    setChecklistRows([]);
    setChecklistPhotos({});
    setChecklistOpen(true);
    setLoadingChecklist(true);
    setError('');
    try {
      const checklist = await listWorkOrderChecklist(row.tenant_id, row.id);
      const photosByItem = {};
      for (const item of checklist) {
        const itemPhotos = await listChecklistPhotos(row.tenant_id, item.id);
        photosByItem[item.id] = await Promise.all((itemPhotos || []).map(async (photo) => {
          try {
            return { ...photo, signedUrl: await signedChecklistPhotoUrl(photo, 900) };
          } catch (err) {
            console.warn('No se pudo firmar foto de checklist', err);
            return { ...photo, signedUrl: '' };
          }
        }));
      }
      setChecklistRows(checklist);
      setChecklistPhotos(photosByItem);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingChecklist(false);
    }
  }

  async function downloadFinalActa(row) {
    setError('');
    setGeneratingPdfId(row.id);
    try {
      const { blob, filename } = await generateWorkOrderPdfBlob(row.tenant_id, row.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingPdfId('');
    }
  }

  if (loading) return <p className="muted">Cargando OT realizadas...</p>;

  return (
    <>
      <PageHeader title="OT realizadas" subtitle={activeInstallation ? `Histórico de trabajos realizados en ${activeInstallation.nombre}.` : 'Historico de trabajos finalizados, validados, checklist completo, fotos, materiales e informes.'} action={<Link className="primary-button" to="/ots">Nueva / todas las OT</Link>} />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeInstallation.nombre}</p>}
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link to="/ots">Todas</Link>
        <Link className="active" to="/ots-realizadas">OT realizadas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}

      <CollapsibleSection title="Resumen OT realizadas" subtitle="Trabajos cerrados o pendientes solo de validacion" icon={CheckCircle2} badge={`${metrics.realizadas}`} defaultOpen>
        <section className="grid metrics user-module-metrics">
          <article className="metric-card"><span>Realizadas</span><strong>{metrics.realizadas}</strong></article>
          <article className="metric-card warn"><span>Finalizadas sin validar</span><strong>{metrics.finalizadas}</strong></article>
          <article className="metric-card"><span>Validadas/cerradas</span><strong>{metrics.validadas}</strong></article>
          <article className="metric-card"><span>Fotos OT</span><strong>{metrics.fotos}</strong></article>
          <article className="metric-card"><span>Materiales</span><strong>{metrics.materiales}</strong></article>
          <article className="metric-card"><span>Informes</span><strong>{metrics.informes}</strong></article>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title="Filtros" subtitle="Busca por OT, instalacion, activo o tecnico" icon={Filter} badge={`${filteredRows.length}/${visibleRows.length}`} defaultOpen>
        <div className="user-filter-grid">
          <label><span>Buscar</span><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Codigo, trabajo, instalacion, activo o tecnico" /></label>
          <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="todas">Todas</option><option value="FINALIZADA">Finalizada</option><option value="VALIDADA">Validada</option><option value="CERRADA">Cerrada</option><option value="FIRMADA">Firmada</option><option value="INFORME_GENERADO">Informe generado</option></select></label>
          <label><span>Fecha</span><select value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}><option value="todas">Todas</option><option value="30">Ultimos 30 dias</option><option value="90">Ultimos 90 dias</option><option value="year">Este ano</option></select></label>
          <label><span>Vista rapida</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="todas">Todas</option><option value="FINALIZADA">Pendientes validar</option><option value="VALIDADA">Validadas</option></select></label>
        </div>
        <div className="quick-actions user-filter-actions"><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, status: 'FINALIZADA' }))}>Pendientes validar</button><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, date: '30' }))}>Ultimos 30 dias</button><button className="ghost-button" type="button" onClick={() => setFilters({ search: '', status: 'todas', date: 'todas' })}>Limpiar</button></div>
      </CollapsibleSection>

      <CollapsibleSection title="Listado de OT realizadas" subtitle="Trabajos finalizados con checklist, fotos, informe y detalle" icon={Wrench} defaultOpen>
        <DataTable
          columns={[
            { key: 'foto', label: 'Foto', render: (row) => <WorkOrderThumbnail row={row} /> },
            { key: 'codigo_ot', label: 'OT', render: (row) => <Link className="table-link" to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
            { key: 'titulo', label: 'Trabajo' },
            { key: 'tipo_ot', label: 'Tipo', render: (row) => workOrderTypeLabel(row.tipo_ot || row.tipo) },
            { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
            { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
            { key: 'tecnico', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin tecnico' },
            { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad)}</span> },
            { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
            { key: 'fecha_fin', label: 'Finalizacion', render: (row) => row.fecha_fin || row.closed_at ? formatDateTime(row.fecha_fin || row.closed_at) : '-' },
            { key: 'fotos', label: 'Fotos', render: (row) => <span className="badge"><Image size={14} /> {photoCountByOt.get(row.id) || 0}</span> },
            { key: 'materiales', label: 'Materiales', render: (row) => <span className="badge"><Package size={14} /> {materialCountByOt.get(row.id) || 0}</span> },
            { key: 'informes', label: 'Informes', render: (row) => <span className="badge"><FileText size={14} /> {reportCountByOt.get(row.id) || 0}</span> },
            { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions"><button className="secondary-button" type="button" onClick={() => openChecklist(row)}><ClipboardCheck size={16} /> Checklist + fotos</button><button className="primary-button" type="button" disabled={generatingPdfId === row.id} onClick={() => downloadFinalActa(row)}><Download size={16} /> {generatingPdfId === row.id ? 'Generando...' : 'Acta PDF'}</button><Link className="secondary-button" to={`/ots/${row.id}`}>Ver OT</Link></div> }
          ]}
          rows={filteredRows}
          empty="Todavia no hay OT realizadas para la instalación activa."
        />
      </CollapsibleSection>

      <Modal title={selectedOrder ? `Checklist + fotos · ${selectedOrder.codigo_ot || selectedOrder.titulo}` : 'Checklist + fotos'} open={checklistOpen} onClose={() => setChecklistOpen(false)}>
        {loadingChecklist ? <p className="muted">Cargando checklist y fotos...</p> : (
          <div className="ot-checklist-review-list">
            {selectedOrder && (
              <div className="ot-checklist-review-header">
                <strong>{selectedOrder.titulo}</strong>
                <span>{selectedOrder.instalaciones?.nombre || '-'} · {selectedOrder.activos?.nombre || 'Sin activo'}</span>
                <button className="primary-button" type="button" disabled={generatingPdfId === selectedOrder.id} onClick={() => downloadFinalActa(selectedOrder)}><Download size={16} /> {generatingPdfId === selectedOrder.id ? 'Generando acta...' : 'Descargar acta final PDF'}</button>
              </div>
            )}
            {checklistRows.length === 0 && <p className="muted">Esta OT no tiene checklist registrado.</p>}
            {checklistRows.map((item) => (
              <article className={`ot-checklist-review-item ${item.resultado === 'ok' ? 'ok' : item.resultado === 'no_ok' ? 'danger' : ''}`} key={item.id}>
                <div className="ot-checklist-review-title">
                  <strong>{item.punto}. {item.descripcion}</strong>
                  <span className={`badge ${item.resultado === 'ok' ? 'ok' : item.resultado === 'no_ok' ? 'danger' : 'warn'}`}>{item.resultado || 'pendiente'}</span>
                </div>
                {item.observacion && <p>{item.observacion}</p>}
                {item.medicion_valor && <small>Medicion: {item.medicion_valor}</small>}
                {item.accion_realizada && <small>Accion: {item.accion_realizada}</small>}
                {(checklistPhotos[item.id] || []).length > 0 ? (
                  <div className="incident-photo-grid">
                    {(checklistPhotos[item.id] || []).map((photo) => (
                      <article className="incident-photo-card" key={photo.id}>
                        {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.comentario || photo.file_name || 'Foto de checklist'} /> : <div className="muted">Foto no disponible</div>}
                        <small>{photo.tipo_foto || 'foto'} · {formatDateTime(photo.created_at)}</small>
                        {photo.comentario && <span>{photo.comentario}</span>}
                      </article>
                    ))}
                  </div>
                ) : <p className="muted">Sin fotos asociadas a este punto.</p>}
              </article>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function countBy(rows, field) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[field];
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}
