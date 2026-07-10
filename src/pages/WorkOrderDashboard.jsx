import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ClipboardCheck, Clock, FileCheck2, UserRoundX } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderStatusOverview from '../components/WorkOrders/WorkOrderStatusOverview';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders, listWorkOrderVisitsForTenant } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';
import { ACTIVE_WORK_ORDER_STATUSES, FINISHED_WORK_ORDER_STATUSES, normalizedStatus } from '../utils/workOrderLifecycle';

export default function WorkOrderDashboard() {
  const { activeTenantId, activeInstallationId, activeInstallation } = useTenant();
  const [orders, setOrders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh({ silent = false } = {}) {
    if (!activeTenantId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const [orderData, visitData] = await Promise.all([
        listWorkOrders(activeTenantId),
        listWorkOrderVisitsForTenant(activeTenantId)
      ]);
      setOrders(orderData);
      setVisits(visitData);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    if (!activeTenantId) return undefined;
    const interval = window.setInterval(() => refresh({ silent: true }), 30000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeTenantId]);

  const scopedOrders = useMemo(
    () => activeInstallationId ? orders.filter((order) => order.instalacion_id === activeInstallationId) : orders,
    [orders, activeInstallationId]
  );

  const scopedOrderIds = useMemo(() => new Set(scopedOrders.map((order) => order.id)), [scopedOrders]);

  const scopedVisits = useMemo(
    () => activeInstallationId ? visits.filter((visit) => scopedOrderIds.has(visit.ot_id)) : visits,
    [visits, activeInstallationId, scopedOrderIds]
  );

  const metrics = useMemo(() => {
    const open = scopedOrders.filter((order) => ACTIVE_WORK_ORDER_STATUSES.includes(normalizedStatus(order.estado))).length;
    const inProgress = scopedOrders.filter((order) => normalizedStatus(order.estado) === 'EN_CURSO').length;
    const pending = scopedOrders.filter((order) => ['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'].includes(normalizedStatus(order.estado))).length;
    const finished = scopedOrders.filter((order) => FINISHED_WORK_ORDER_STATUSES.includes(order.estado) || normalizedStatus(order.estado) === 'FINALIZADA').length;
    const validated = scopedOrders.filter((order) => normalizedStatus(order.estado) === 'VALIDADA').length;
    const unassigned = scopedOrders.filter((order) => !order.assigned_to && !['VALIDADA', 'CANCELADA'].includes(normalizedStatus(order.estado))).length;
    const activeVisits = scopedVisits.filter((visit) => visit.estado === 'EN_CURSO').length;
    const overdue = scopedOrders.filter((order) => order.fecha_limite && new Date(order.fecha_limite) < new Date() && !['VALIDADA', 'CANCELADA'].includes(normalizedStatus(order.estado))).length;
    return { open, inProgress, pending, finished, validated, unassigned, activeVisits, overdue };
  }, [scopedOrders, scopedVisits]);

  const recentOrders = useMemo(() => scopedOrders.slice(0, 8), [scopedOrders]);
  const recentVisits = useMemo(() => scopedVisits.slice(0, 6), [scopedVisits]);

  if (loading) {
    return (
      <section className="card workorder-loading">
        <Clock size={22} />
        <div>
          <strong>Cargando dashboard OT...</strong>
          <p className="muted">Revisando ordenes, visitas activas y trabajos pendientes.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard OT"
        subtitle={activeInstallation
          ? `Seguimiento de órdenes e intervenciones de ${activeInstallation.nombre}.`
          : 'Seguimiento agregado de todas las instalaciones del cliente activo.'}
        action={<Link className="primary-button" to="/ots">Gestionar OT</Link>}
      />
      <div className="tabs workorder-tabs">
        <Link className="active" to="/ots-dashboard">Dashboard</Link>
        <Link to="/ots-control">Control OT</Link>
        <Link to="/ots-agenda">Agenda OT</Link>
        <Link to="/ots">Todas</Link>
        <Link to="/ots-realizadas">OT realizadas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}

      <WorkOrderStatusOverview orders={scopedOrders} />

      <div className="grid metrics ot-metrics">
        <Metric icon={<ClipboardCheck size={22} />} label="OT abiertas" value={metrics.open} />
        <Metric icon={<Activity size={22} />} label="En curso" value={metrics.inProgress} />
        <Metric icon={<AlertTriangle size={22} />} label="Pendientes" value={metrics.pending} tone="warn" />
        <Metric icon={<AlertTriangle size={22} />} label="Vencidas" value={metrics.overdue} tone="danger" />
        <Metric icon={<FileCheck2 size={22} />} label="Finalizadas" value={metrics.finished} tone="ok" />
        <Metric icon={<FileCheck2 size={22} />} label="Validadas" value={metrics.validated} tone="ok" />
        <Metric icon={<UserRoundX size={22} />} label="Sin tecnico" value={metrics.unassigned} tone="danger" />
        <Metric icon={<Clock size={22} />} label="Visitas activas" value={metrics.activeVisits} />
      </div>

      <div className="grid two ot-dashboard-panels">
        <section className="ot-dashboard-panel">
          <div className="section-title">
            <h2>Seguimiento reciente</h2>
            <Link className="secondary-button" to="/ots">Ver todas</Link>
          </div>
          <DataTable
            columns={[
              { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
              { key: 'titulo', label: 'Trabajo' },
              { key: 'assigned_to', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin asignar' },
              { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> }
            ]}
            rows={recentOrders}
            empty="Sin OT registradas en este contexto"
          />
        </section>

        <section className="ot-dashboard-panel">
          <div className="section-title">
            <h2>Intervenciones recientes</h2>
            <Link className="secondary-button" to="/ots-agenda">Ver agenda</Link>
          </div>
          <DataTable
            columns={[
              { key: 'ot', label: 'OT', render: (row) => row.orden?.codigo_ot || row.ot_id?.slice(0, 8) || '-' },
              { key: 'trabajo', label: 'Trabajo', render: (row) => row.orden?.titulo || '-' },
              { key: 'fecha_inicio', label: 'Inicio', render: (row) => row.fecha_inicio ? formatDateTime(row.fecha_inicio) : '-' },
              { key: 'fecha_fin', label: 'Fin', render: (row) => row.fecha_fin ? formatDateTime(row.fecha_fin) : '-' },
              { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.estado === 'EN_CURSO' ? 'warn' : 'ok'}`}>{row.estado}</span> },
              { key: 'ot_id', label: 'Accion', render: (row) => <Link to={`/ots/${row.ot_id}/visita`}>Ver</Link> }
            ]}
            rows={recentVisits}
            empty="Sin intervenciones registradas en este contexto"
          />
        </section>
      </div>
    </>
  );
}

function Metric({ icon, label, value, tone = '' }) {
  return (
    <section className={`metric-card ot-metric ${tone}`}>
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </section>
  );
}
