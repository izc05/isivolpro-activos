import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Filter, FileText, Package, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';
import { normalizedStatus, priorityLabel, priorityTone, workOrderTypeLabel } from '../utils/workOrderLifecycle';
import { supabase } from '../services/supabaseClient';

const DONE_STATUSES = ['FINALIZADA', 'VALIDADA', 'CERRADA', 'FIRMADA', 'INFORME_GENERADO'];

export default function CompletedWorkOrders() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [reports, setReports] = useState([]);
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
      const [materialsRes, reportsRes] = await Promise.all([
        otIds.length ? supabase.from('ot_visita_materiales').select('*').eq('tenant_id', activeTenantId).in('ot_id', otIds) : Promise.resolve({ data: [], error: null }),
        otIds.length ? supabase.from('ot_informes').select('*').eq('tenant_id', activeTenantId).in('ot_id', otIds) : Promise.resolve({ data: [], error: null })
      ]);
      if (materialsRes.error) throw materialsRes.error;
      if (reportsRes.error) throw reportsRes.error;
      setRows(completed);
      setMaterials(materialsRes.data || []);
      setReports(reportsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId]);

  const materialCountByOt = useMemo(() => countBy(materials, 'ot_id'), [materials]);
  const reportCountByOt = useMemo(() => countBy(reports, 'ot_id'), [reports]);

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    const now = new Date();
    return rows.filter((row) => {
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
  }, [rows, filters]);

  const metrics = useMemo(() => ({
    realizadas: rows.length,
    finalizadas: rows.filter((row) => normalizedStatus(row.estado) === 'FINALIZADA').length,
    validadas: rows.filter((row) => normalizedStatus(row.estado) === 'VALIDADA' || row.estado === 'CERRADA').length,
    materiales: materials.length,
    informes: reports.length
  }), [rows, materials, reports]);

  if (loading) return <p className="muted">Cargando OT realizadas...</p>;

  return (
    <>
      <PageHeader title="OT realizadas" subtitle="Histórico de trabajos finalizados, validados, materiales usados e informes generados." action={<Link className="primary-button" to="/ots">Nueva / todas las OT</Link>} />
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link to="/ots">Todas</Link>
        <Link className="active" to="/ots-realizadas">OT realizadas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mí</Link>
      </div>
      {error && <p className="error-text">{error}</p>}

      <CollapsibleSection title="Resumen OT realizadas" subtitle="Trabajos cerrados o pendientes solo de validación" icon={CheckCircle2} badge={`${metrics.realizadas}`} defaultOpen>
        <section className="grid metrics user-module-metrics">
          <article className="metric-card"><span>Realizadas</span><strong>{metrics.realizadas}</strong></article>
          <article className="metric-card warn"><span>Finalizadas sin validar</span><strong>{metrics.finalizadas}</strong></article>
          <article className="metric-card"><span>Validadas/cerradas</span><strong>{metrics.validadas}</strong></article>
          <article className="metric-card"><span>Materiales</span><strong>{metrics.materiales}</strong></article>
          <article className="metric-card"><span>Informes</span><strong>{metrics.informes}</strong></article>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title="Filtros" subtitle="Busca por OT, instalación, activo o técnico" icon={Filter} badge={`${filteredRows.length}/${rows.length}`} defaultOpen>
        <div className="user-filter-grid">
          <label><span>Buscar</span><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Código, trabajo, instalación, activo o técnico" /></label>
          <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="todas">Todas</option><option value="FINALIZADA">Finalizada</option><option value="VALIDADA">Validada</option><option value="CERRADA">Cerrada</option><option value="FIRMADA">Firmada</option><option value="INFORME_GENERADO">Informe generado</option></select></label>
          <label><span>Fecha</span><select value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}><option value="todas">Todas</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="year">Este año</option></select></label>
          <label><span>Vista rápida</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="todas">Todas</option><option value="FINALIZADA">Pendientes validar</option><option value="VALIDADA">Validadas</option></select></label>
        </div>
        <div className="quick-actions user-filter-actions"><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, status: 'FINALIZADA' }))}>Pendientes validar</button><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, date: '30' }))}>Últimos 30 días</button><button className="ghost-button" type="button" onClick={() => setFilters({ search: '', status: 'todas', date: 'todas' })}>Limpiar</button></div>
      </CollapsibleSection>

      <CollapsibleSection title="Listado de OT realizadas" subtitle="Trabajos finalizados con acceso a informe y detalle" icon={Wrench} defaultOpen>
        <DataTable
          columns={[
            { key: 'codigo_ot', label: 'OT', render: (row) => <Link className="table-link" to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
            { key: 'titulo', label: 'Trabajo' },
            { key: 'tipo_ot', label: 'Tipo', render: (row) => workOrderTypeLabel(row.tipo_ot || row.tipo) },
            { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
            { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
            { key: 'tecnico', label: 'Técnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin técnico' },
            { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad)}</span> },
            { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
            { key: 'fecha_fin', label: 'Finalización', render: (row) => row.fecha_fin || row.closed_at ? formatDateTime(row.fecha_fin || row.closed_at) : '-' },
            { key: 'materiales', label: 'Materiales', render: (row) => <span className="badge"><Package size={14} /> {materialCountByOt.get(row.id) || 0}</span> },
            { key: 'informes', label: 'Informes', render: (row) => <span className="badge"><FileText size={14} /> {reportCountByOt.get(row.id) || 0}</span> },
            { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions"><Link className="secondary-button" to={`/ots/${row.id}`}>Ver OT</Link><Link className="primary-button" to={`/ots/${row.id}/informe`}>Informe</Link></div> }
          ]}
          rows={filteredRows}
          empty="Todavía no hay OT realizadas."
        />
      </CollapsibleSection>
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
