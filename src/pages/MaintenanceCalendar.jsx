import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import MaintenanceSchemaNotice from '../components/Maintenance/MaintenanceSchemaNotice';
import { useTenant } from '../hooks/useTenant';
import { generateWorkOrderForScheduledMaintenance, listScheduledMaintenances } from '../services/scheduledMaintenanceService';
import { isMaintenanceSchemaMissing } from '../services/maintenanceSchemaGuard';
import { formatDate } from '../utils/dateUtils';
import { maintenanceStatusClass, maintenanceStatusLabel, maintenanceTypeLabel } from '../constants/maintenance';

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

export default function MaintenanceCalendar() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('mes');
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  async function refresh() {
    if (!activeTenantId) return;
    setError('');
    setSchemaPending(false);
    try {
      setRows(await listScheduledMaintenances(activeTenantId));
    } catch (err) {
      if (isMaintenanceSchemaMissing(err)) {
        setRows([]);
        setSchemaPending(true);
        return;
      }
      throw err;
    }
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [activeTenantId]);

  const visibleRows = useMemo(() => {
    const today = new Date();
    const from = new Date(today);
    const to = new Date(today);
    if (view === 'semana') to.setDate(today.getDate() + 7);
    if (view === 'mes') to.setMonth(today.getMonth() + 1);
    if (view === 'lista') return rows;
    return rows.filter((row) => {
      const date = new Date(row.fecha_programada);
      return date >= from && date <= to;
    });
  }, [rows, view]);

  async function generate(row) {
    setError('');
    try {
      await generateWorkOrderForScheduledMaintenance(row);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader title="Calendario mantenimiento" subtitle="Vista de actuaciones programadas por lista, semana o mes." action={<div className="segmented maintenance-view-switch">{['lista', 'semana', 'mes'].map((item) => <button key={item} className={view === item ? 'active' : ''} type="button" onClick={() => setView(item)}>{item}</button>)}</div>} />
      {schemaPending && <MaintenanceSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      {view === 'mes' ? (
        <MaintenanceMonthCalendar
          monthDate={currentMonth}
          rows={rows}
          onNext={() => setCurrentMonth((date) => addMonths(date, 1))}
          onPrev={() => setCurrentMonth((date) => addMonths(date, -1))}
        />
      ) : (
        <div className="maintenance-calendar-list">
          <MaintenanceTable rows={visibleRows} onGenerate={generate} />
        </div>
      )}
    </>
  );
}

function MaintenanceTable({ rows, onGenerate }) {
  return (
    <DataTable columns={[
      { key: 'fecha_programada', label: 'Fecha', render: (row) => formatDate(row.fecha_programada) },
      { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
      { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre },
      { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
      { key: 'prioridad', label: 'Prioridad' },
      { key: 'tecnico', label: 'Técnico', render: (row) => row.assigned?.nombre || row.assigned?.email || '-' },
      { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${maintenanceStatusClass(row.estado_visual || row.estado)}`}>{maintenanceStatusLabel(row.estado_visual || row.estado)}</span> },
      { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions">{row.ot_id ? <Link className="secondary-button table-action" to={`/ots/${row.ot_id}`}>Abrir OT</Link> : <button className="secondary-button table-action" onClick={() => onGenerate(row)}>Generar OT</button>}</div> }
    ]} rows={rows} empty="No hay actuaciones en esta vista." />
  );
}

function MaintenanceMonthCalendar({ monthDate, rows, onPrev, onNext }) {
  const cells = buildMonthCells(monthDate);
  const todayKey = toDateKey(new Date());
  const month = monthDate.getMonth();
  const year = monthDate.getFullYear();
  const monthRows = rows.filter((row) => {
    const date = new Date(row.fecha_programada);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const rowsByDate = rows.reduce((acc, row) => {
    const key = toDateKey(row.fecha_programada);
    if (!key) return acc;
    acc[key] = [...(acc[key] || []), row];
    return acc;
  }, {});

  return (
    <section className="maintenance-month-card">
      <header className="maintenance-month-header">
        <button type="button" className="secondary-button calendar-nav-button" onClick={onPrev} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <div>
          <strong>{MONTH_FORMATTER.format(monthDate)}</strong>
          <span>{monthRows.length} actuaciones programadas</span>
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
          const dayRows = rowsByDate[key] || [];
          const isOutside = date.getMonth() !== month;
          return (
            <article key={key} className={`maintenance-day${isOutside ? ' outside' : ''}${key === todayKey ? ' today' : ''}${dayRows.length ? ' has-items' : ''}`}>
              <div className="maintenance-day-number">{date.getDate()}</div>
              <div className="maintenance-day-items">
                {dayRows.slice(0, 3).map((row) => (
                  <Link key={row.id} className={`maintenance-day-pill ${maintenanceStatusClass(row.estado_visual || row.estado)}`} to={row.ot_id ? `/ots/${row.ot_id}` : row.plan_id ? `/mantenimiento/planes/${row.plan_id}` : '/mantenimiento/pendientes'}>
                    <span>{row.activos?.nombre || row.titulo}</span>
                    <small>{maintenanceTypeLabel(row.tipo)}</small>
                  </Link>
                ))}
                {dayRows.length > 3 && <span className="maintenance-day-more">+{dayRows.length - 3} más</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
