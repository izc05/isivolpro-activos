import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ClipboardCheck, Clock, FileCheck2, UserRoundX } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders, listWorkOrderVisitsForTenant } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';

const ACTIVE_STATUSES = ['ASIGNADA', 'ACEPTADA', 'EN_CURSO', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'];

export default function WorkOrderDashboard() {
  const { activeTenantId } = useTenant();
  const [orders, setOrders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!activeTenantId) return;
    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId]);

  const metrics = useMemo(() => {
    const open = orders.filter((order) => ACTIVE_STATUSES.includes(order.estado)).length;
    const inProgress = orders.filter((order) => order.estado === 'EN_CURSO').length;
    const pending = orders.filter((order) => ['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'].includes(order.estado)).length;
    const finished = orders.filter((order) => ['FINALIZADA', 'FIRMADA', 'INFORME_GENERADO'].includes(order.estado)).length;
    const unassigned = orders.filter((order) => !order.assigned_to && !['CERRADA', 'CANCELADA'].includes(order.estado)).length;
    const activeVisits = visits.filter((visit) => visit.estado === 'EN_CURSO').length;
    return { open, inProgress, pending, finished, unassigned, activeVisits };
  }, [orders, visits]);

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);
  const recentVisits = useMemo(() => visits.slice(0, 6), [visits]);

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
        subtitle="Seguimiento operativo de ordenes creadas, asignadas a tecnicos y visitas en campo."
        action={<Link className="primary-button" to="/ots">Gestionar OT</Link>}
      />
      {error && <p className="error-text">{error}</p>}

      <div className="grid metrics ot-metrics">
        <Metric icon={<ClipboardCheck size={22} />} label="OT abiertas" value={metrics.open} />
        <Metric icon={<Activity size={22} />} label="En curso" value={metrics.inProgress} />
        <Metric icon={<AlertTriangle size={22} />} label="Pendientes" value={metrics.pending} tone="warn" />
        <Metric icon={<FileCheck2 size={22} />} label="Finalizadas" value={metrics.finished} tone="ok" />
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
            empty="Sin OT registradas"
          />
        </section>

        <section className="ot-dashboard-panel">
          <div className="section-title">
            <h2>Actividad de campo</h2>
            <Link className="secondary-button" to="/mis-ots">OT asignadas</Link>
          </div>
          <DataTable
            columns={[
              { key: 'fecha_inicio', label: 'Inicio', render: (row) => row.fecha_inicio ? formatDateTime(row.fecha_inicio) : '-' },
              { key: 'fecha_fin', label: 'Fin', render: (row) => row.fecha_fin ? formatDateTime(row.fecha_fin) : '-' },
              { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.estado === 'EN_CURSO' ? 'warn' : 'ok'}`}>{row.estado}</span> },
              { key: 'ot_id', label: 'OT', render: (row) => <Link to={`/ots/${row.ot_id}/visita`}>Abrir</Link> }
            ]}
            rows={recentVisits}
            empty="Sin visitas registradas"
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
