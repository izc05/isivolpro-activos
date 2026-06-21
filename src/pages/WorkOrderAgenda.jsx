import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Search } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import {
  ACTIVE_WORK_ORDER_STATUSES,
  CLOSED_WORK_ORDER_STATUSES,
  normalizedStatus,
  priorityTone,
  workOrderStatusLabel
} from '../utils/workOrderLifecycle';

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthCells(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(start);
    cell.setDate(start.getDate() + index);
    return cell;
  });
}

export default function WorkOrderAgenda() {
  const navigate = useNavigate();
  const { tenants, setActiveTenantId } = useTenant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'todas' });
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  async function refresh() {
    if (!tenants.length) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const tenantOrders = await Promise.all(tenants.map(async (tenant) => {
        const rows = await listWorkOrders(tenant.id);
        return rows.map((row) => ({ ...row, tenant_nombre: tenant.nombre }));
      }));
      setOrders(tenantOrders.flat());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [tenants]);

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
      const matchesText = !text || searchable.includes(text);
      const matchesStatus = filters.status === 'todas' || normalizedStatus(order.estado) === filters.status;
      return matchesText && matchesStatus;
    });
  }, [orders, filters]);

  const metrics = useMemo(() => {
    const scheduled = filteredOrders.filter((order) => Boolean(order.fecha_prevista)).length;
    const unscheduled = filteredOrders.length - scheduled;
    const active = filteredOrders.filter((order) => ACTIVE_WORK_ORDER_STATUSES.includes(normalizedStatus(order.estado))).length;
    const closed = filteredOrders.filter((order) => CLOSED_WORK_ORDER_STATUSES.includes(normalizedStatus(order.estado))).length;
    const todayKey = toDateKey(new Date());
    const today = filteredOrders.filter((order) => toDateKey(order.fecha_prevista) === todayKey).length;
    return { total: filteredOrders.length, scheduled, unscheduled, active, closed, today };
  }, [filteredOrders]);

  const monthOrders = useMemo(() => filteredOrders.filter((order) => {
    if (!order.fecha_prevista) return false;
    const date = new Date(order.fecha_prevista);
    return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth();
  }), [filteredOrders, currentMonth]);

  const unscheduledOrders = useMemo(
    () => filteredOrders.filter((order) => !order.fecha_prevista).slice(0, 8),
    [filteredOrders]
  );

  if (loading) {
    return (
      <section className="card workorder-loading">
        <Clock size={22} />
        <div>
          <strong>Cargando agenda OT...</strong>
          <p className="muted">Preparando calendario general de ordenes de trabajo.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title="Agenda OT"
        subtitle="Calendario global de ordenes de trabajo accesibles, sin depender del cliente ni de la instalacion activa."
        action={<Link className="primary-button" to="/ots">Nueva / gestionar OT</Link>}
      />
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link to="/ots-control">Control OT</Link>
        <Link className="active" to="/ots-agenda">Agenda OT</Link>
        <Link to="/ots">Todas</Link>
        <Link to="/ots-realizadas">OT realizadas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}

      <section className="ot-agenda-filter">
        <label className="ot-agenda-search">
          <Search size={18} />
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Buscar por OT, cliente, instalacion, tecnico o activo..." />
        </label>
        <label>
          <span>Estado</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="todas">Todos</option>
            {['NUEVA', 'ASIGNADA', 'EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'FINALIZADA', 'VALIDADA', 'CANCELADA'].map((status) => (
              <option key={status} value={status}>{workOrderStatusLabel(status)}</option>
            ))}
          </select>
        </label>
        <div className="ot-agenda-actions">
          <button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, status: 'EN_CURSO' }))}>En curso</button>
          <button className="ghost-button" type="button" onClick={() => setFilters({ search: '', status: 'todas' })}>Limpiar</button>
        </div>
      </section>

      <section className="grid metrics ot-metrics ot-agenda-metrics">
        <Metric label="OT visibles" value={metrics.total} />
        <Metric label="Planificadas" value={metrics.scheduled} />
        <Metric label="Hoy" value={metrics.today} />
        <Metric label="Activas" value={metrics.active} tone="warn" />
        <Metric label="Cerradas" value={metrics.closed} tone="ok" />
        <Metric label="Sin fecha" value={metrics.unscheduled} tone="danger" />
      </section>

      <section className="ot-agenda-layout">
        <AgendaMonthCalendar
          monthDate={currentMonth}
          orders={filteredOrders}
          monthOrders={monthOrders}
          onOpenOrder={(order) => openOrder(order, setActiveTenantId, navigate)}
          onNext={() => setCurrentMonth((date) => addMonths(date, 1))}
          onPrev={() => setCurrentMonth((date) => addMonths(date, -1))}
        />

        <aside className="ot-agenda-side">
          <section className="ot-agenda-side-card">
            <header>
              <CalendarClock size={18} />
              <strong>Resumen del mes</strong>
            </header>
            <div className="ot-agenda-status-list">
              {Object.entries(groupByStatus(monthOrders)).map(([status, count]) => (
                <button key={status} type="button" onClick={() => setFilters((current) => ({ ...current, status }))}>
                  <WorkOrderStatusBadge status={status} />
                  <b>{count}</b>
                </button>
              ))}
              {monthOrders.length === 0 && <p className="muted">No hay OT planificadas este mes.</p>}
            </div>
          </section>

          <section className="ot-agenda-side-card">
            <header>
              <Clock size={18} />
              <strong>Sin fecha planificada</strong>
            </header>
            <div className="ot-agenda-unscheduled">
              {unscheduledOrders.map((order) => (
                <button key={order.id} type="button" onClick={() => openOrder(order, setActiveTenantId, navigate)}>
                  <span>{order.codigo_ot || order.id.slice(0, 8)}</span>
                  <strong>{order.titulo || 'OT sin titulo'}</strong>
                  <small>{order.tenant_nombre || '-'} · {order.instalaciones?.nombre || 'Sin instalacion'} · {order.assigned?.nombre || order.assigned?.email || 'Sin tecnico'}</small>
                  <WorkOrderStatusBadge status={order.estado} />
                </button>
              ))}
              {unscheduledOrders.length === 0 && <p className="muted">Todas las OT visibles tienen fecha prevista.</p>}
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}

function AgendaMonthCalendar({ monthDate, orders, monthOrders, onOpenOrder, onPrev, onNext }) {
  const cells = buildMonthCells(monthDate);
  const todayKey = toDateKey(new Date());
  const month = monthDate.getMonth();
  const ordersByDate = orders.reduce((acc, order) => {
    const key = toDateKey(order.fecha_prevista);
    if (!key) return acc;
    acc[key] = [...(acc[key] || []), order];
    return acc;
  }, {});

  return (
    <section className="maintenance-month-card ot-agenda-calendar">
      <header className="maintenance-month-header">
        <button type="button" className="secondary-button calendar-nav-button" onClick={onPrev} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <div>
          <strong>{MONTH_FORMATTER.format(monthDate)}</strong>
          <span>{monthOrders.length} OT planificadas</span>
        </div>
        <button type="button" className="secondary-button calendar-nav-button" onClick={onNext} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </button>
      </header>
      <div className="maintenance-weekdays" aria-hidden="true">
        {WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="maintenance-month-grid">
        {cells.map((date) => {
          const key = toDateKey(date);
          const dayOrders = ordersByDate[key] || [];
          const isOutside = date.getMonth() !== month;
          return (
            <article key={key} className={`maintenance-day ot-agenda-day${isOutside ? ' outside' : ''}${key === todayKey ? ' today' : ''}${dayOrders.length ? ' has-items' : ''}`}>
              <div className="maintenance-day-number">{date.getDate()}</div>
              <div className="maintenance-day-items">
                {dayOrders.slice(0, 3).map((order) => (
                  <button key={order.id} className={`ot-agenda-pill ${priorityTone(order.prioridad || 'normal')}`} type="button" onClick={() => onOpenOrder(order)}>
                    <span>{order.codigo_ot || order.id.slice(0, 8)}</span>
                    <strong>{order.titulo || 'OT sin titulo'}</strong>
                    <small>{order.tenant_nombre || '-'} · {order.assigned?.nombre || order.assigned?.email || 'Sin tecnico'}</small>
                  </button>
                ))}
                {dayOrders.length > 3 && <span className="maintenance-day-more">+{dayOrders.length - 3} mas</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function openOrder(order, setActiveTenantId, navigate) {
  if (order.tenant_id) setActiveTenantId(order.tenant_id);
  navigate(`/ots/${order.id}`);
}

function groupByStatus(rows) {
  return rows.reduce((acc, row) => {
    const status = normalizedStatus(row.estado);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function Metric({ label, value, tone = '' }) {
  return (
    <section className={`metric-card ot-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
