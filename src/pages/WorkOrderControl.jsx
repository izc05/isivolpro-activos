import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ClipboardCheck, Clock3, Filter, RefreshCw, Search, UserRound, UserRoundX } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';
import {
  ACTIVE_WORK_ORDER_STATUSES,
  CLOSED_WORK_ORDER_STATUSES,
  FINISHED_WORK_ORDER_STATUSES,
  OFFICIAL_WORK_ORDER_STATUSES,
  normalizedStatus,
  priorityLabel,
  priorityTone,
  workOrderStatusLabel,
  workOrderTypeLabel
} from '../utils/workOrderLifecycle';

const STATUS_FILTERS = OFFICIAL_WORK_ORDER_STATUSES;
const LIVE_STATUS_COLUMNS = OFFICIAL_WORK_ORDER_STATUSES;

export default function WorkOrderControl() {
  const navigate = useNavigate();
  const { tenants, setActiveTenantId } = useTenant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'todas', technician: 'todos' });

  async function refresh({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const tenantOrders = await Promise.all((tenants || []).map(async (tenant) => {
        const rows = await listWorkOrders(tenant.id);
        return rows.map((row) => ({ ...row, tenant_nombre: tenant.nombre }));
      }));
      setOrders(tenantOrders.flat());
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setError(err.message);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    if (tenants.length > 0) refresh();
    else setLoading(false);
  }, [tenants]);

  useEffect(() => {
    if (tenants.length === 0) return undefined;
    const interval = window.setInterval(() => refresh({ silent: true }), 30000);
    return () => window.clearInterval(interval);
  }, [tenants]);

  const technicianOptions = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const id = order.assigned_to || 'sin_asignar';
      const label = order.assigned?.nombre || order.assigned?.email || 'Sin asignar';
      map.set(id, label);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return orders.filter((order) => {
      const searchable = [
        order.codigo_ot,
        order.titulo,
        order.descripcion,
        order.tenant_nombre,
        order.instalaciones?.nombre,
        order.ubicaciones?.nombre,
        order.activos?.nombre,
        order.assigned?.nombre,
        order.assigned?.email
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !text || searchable.includes(text);
      const matchesStatus = filters.status === 'todas' || normalizedStatus(order.estado) === filters.status;
      const technicianId = order.assigned_to || 'sin_asignar';
      const matchesTechnician = filters.technician === 'todos' || technicianId === filters.technician;
      return matchesSearch && matchesStatus && matchesTechnician;
    });
  }, [orders, filters]);

  const metrics = useMemo(() => {
    const open = filteredOrders.filter((order) => ACTIVE_WORK_ORDER_STATUSES.includes(normalizedStatus(order.estado))).length;
    const inProgress = filteredOrders.filter((order) => normalizedStatus(order.estado) === 'EN_CURSO').length;
    const pending = filteredOrders.filter((order) => ['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'].includes(normalizedStatus(order.estado))).length;
    const unassigned = filteredOrders.filter((order) => !order.assigned_to && !CLOSED_WORK_ORDER_STATUSES.includes(normalizedStatus(order.estado))).length;
    return { total: filteredOrders.length, open, inProgress, pending, unassigned };
  }, [filteredOrders]);

  const statusCards = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((order) => {
      const status = normalizedStatus(order.estado);
      map.set(status, (map.get(status) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders]);

  const liveStatusColumns = useMemo(() => LIVE_STATUS_COLUMNS.map((status) => ({
    status,
    orders: filteredOrders.filter((order) => normalizedStatus(order.estado) === status)
  })), [filteredOrders]);

  const technicianCards = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((order) => {
      const id = order.assigned_to || 'sin_asignar';
      const entry = map.get(id) || {
        id,
        label: order.assigned?.nombre || order.assigned?.email || 'Sin asignar',
        total: 0,
        active: 0,
        finished: 0
      };
      entry.total += 1;
      if (ACTIVE_WORK_ORDER_STATUSES.includes(normalizedStatus(order.estado))) entry.active += 1;
      if ([...FINISHED_WORK_ORDER_STATUSES, ...CLOSED_WORK_ORDER_STATUSES].includes(normalizedStatus(order.estado))) entry.finished += 1;
      map.set(id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.active - a.active || b.total - a.total);
  }, [filteredOrders]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function openOrder(row) {
    setActiveTenantId(row.tenant_id);
    navigate(`/ots/${row.id}`);
  }

  if (loading) return <p className="muted">Cargando control global de OT...</p>;

  return (
    <>
      <PageHeader
        title="Control OT"
        subtitle="Vista global de todas las ordenes accesibles, sin filtrar por cliente activo ni instalacion activa."
        action={<div className="quick-actions"><button className="secondary-button" type="button" disabled={refreshing} onClick={() => refresh({ silent: true })}>{refreshing ? <RefreshCw className="spin" size={17} /> : <RefreshCw size={17} />} Actualizar</button><Link className="primary-button" to="/ots">Nueva / gestionar OT</Link></div>}
      />
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link className="active" to="/ots-control">Control OT</Link>
        <Link to="/ots">Todas</Link>
        <Link to="/ots-realizadas">OT realizadas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}

      <section className="assigned-ot-filter-panel">
        <div className="assigned-ot-search">
          <Search size={18} />
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Buscar por OT, cliente, instalacion, tecnico o activo..." />
        </div>
        <div className="assigned-ot-filter-grid">
          <label><span><Filter size={15} /> Estado</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="todas">Todos</option>{STATUS_FILTERS.map((status) => <option key={status} value={status}>{workOrderStatusLabel(status)}</option>)}</select></label>
          <label><span>Tecnico</span><select value={filters.technician} onChange={(event) => updateFilter('technician', event.target.value)}><option value="todos">Todos</option>{technicianOptions.map((technician) => <option key={technician.id} value={technician.id}>{technician.label}</option>)}</select></label>
          <div className="assigned-ot-filter-actions">
            <button className="secondary-button" type="button" onClick={() => updateFilter('status', 'EN_CURSO')}>En curso</button>
            <button className="secondary-button" type="button" onClick={() => updateFilter('technician', 'sin_asignar')}>Sin tecnico</button>
            <button className="ghost-button" type="button" onClick={() => setFilters({ search: '', status: 'todas', technician: 'todos' })}>Limpiar</button>
          </div>
        </div>
        <p className="muted">Mostrando {filteredOrders.length} de {orders.length} OT en {tenants.length} cliente(s). Actualizacion automatica cada 30 s{lastUpdated ? ` · Ultima ${lastUpdated}` : ''}.</p>
      </section>

      <section className="grid metrics ot-metrics">
        <Metric icon={<ClipboardCheck size={22} />} label="Total filtradas" value={metrics.total} />
        <Metric icon={<Activity size={22} />} label="Abiertas" value={metrics.open} />
        <Metric icon={<Activity size={22} />} label="En curso" value={metrics.inProgress} />
        <Metric icon={<AlertTriangle size={22} />} label="Pendientes" value={metrics.pending} tone="warn" />
        <Metric icon={<UserRoundX size={22} />} label="Sin tecnico" value={metrics.unassigned} tone="danger" />
      </section>

      <section className="ot-live-board">
        <div className="section-title">
          <h2>Movimiento vivo por estado</h2>
          <span className="live-indicator"><span /> En seguimiento</span>
        </div>
        <div className="ot-live-columns">
          {liveStatusColumns.map((column) => (
            <article className={`ot-live-column status-${column.status.toLowerCase()}`} key={column.status}>
              <header>
                <WorkOrderStatusBadge status={column.status} />
                <strong>{column.orders.length}</strong>
              </header>
              <div className="ot-live-card-list">
                {column.orders.slice(0, 8).map((order) => (
                  <button className="ot-live-card" key={order.id} type="button" onClick={() => openOrder(order)}>
                    <span className="ot-live-code">{order.codigo_ot || order.id.slice(0, 8)}</span>
                    <strong>{order.titulo || 'OT sin titulo'}</strong>
                    <small>{order.tenant_nombre || '-'} · {order.instalaciones?.nombre || 'Sin instalacion'}</small>
                    <span className="ot-live-meta">
                      <em>{order.assigned?.nombre || order.assigned?.email || 'Sin tecnico'}</em>
                      <b className={`badge ${priorityTone(order.prioridad)}`}>{priorityLabel(order.prioridad || 'normal')}</b>
                    </span>
                  </button>
                ))}
                {column.orders.length > 8 && <span className="ot-live-more">+{column.orders.length - 8} OT mas</span>}
                {column.orders.length === 0 && <span className="ot-live-empty">Sin OT</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid two ot-control-panels">
        <section className="card ot-control-card">
          <div className="section-title"><h2>Estado de las OT</h2></div>
          <div className="ot-control-list compact">
            {statusCards.map(([status, count]) => (
              <button key={status} type="button" onClick={() => updateFilter('status', status)}>
                <WorkOrderStatusBadge status={status} />
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="card ot-control-card">
          <div className="section-title"><h2>Tecnicos en vivo</h2></div>
          <div className="ot-technician-grid live">
            {technicianCards.map((technician) => (
              <button key={technician.id} type="button" onClick={() => updateFilter('technician', technician.id)} className={technician.id === 'sin_asignar' ? 'danger' : ''}>
                <span>{technician.id === 'sin_asignar' ? <UserRoundX size={19} /> : <UserRound size={19} />}</span>
                <strong>{technician.label}</strong>
                <small><Clock3 size={14} /> {technician.active} activas · {technician.finished} cerradas · {technician.total} total</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <DataTable
        columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <button className="table-link table-link-button" type="button" onClick={() => openOrder(row)}>{row.codigo_ot || row.id.slice(0, 8)}</button> },
          { key: 'tenant', label: 'Cliente', render: (row) => row.tenant_nombre || '-' },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'tipo_ot', label: 'Tipo', render: (row) => workOrderTypeLabel(row.tipo_ot || row.tipo) },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
          { key: 'tecnico', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin asignar' },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad || 'normal')}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
          { key: 'actions', label: 'Acciones', render: (row) => <button className="secondary-button" type="button" onClick={() => openOrder(row)}>Abrir</button> }
        ]}
        rows={filteredOrders}
        empty="No hay OT que coincidan con los filtros."
      />
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
