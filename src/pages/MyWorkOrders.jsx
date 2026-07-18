import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Filter, ListChecks, MapPin, Navigation, Phone, QrCode, RefreshCw, Search } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderThumbnail from '../components/WorkOrders/WorkOrderThumbnail';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import { updateWorkOrderLifecycleStatus } from '../services/workOrderLifecycleService';
import { formatDateTime } from '../utils/dateUtils';
import { buildMapsUrl } from '../utils/mapUtils';
import {
  FINISHED_WORK_ORDER_STATUSES,
  OFFICIAL_WORK_ORDER_STATUSES,
  normalizedStatus,
  priorityLabel,
  priorityTone,
  workOrderStatusLabel
} from '../utils/workOrderLifecycle';
import '../styles/technicianWorkOrders.css';

const QUICK_FILTERS = [
  { key: 'asignadas', label: 'Asignadas' },
  { key: 'en_curso', label: 'En curso' },
  { key: 'correccion', label: 'Corrección' },
  { key: 'pendiente_material', label: 'Pendiente material' }
];

const STATUS_ORDER = {
  EN_CURSO: 20,
  PAUSADA: 25,
  PENDIENTE_MATERIAL: 30,
  PENDIENTE_CLIENTE: 35,
  ASIGNADA: 40,
  ACEPTADA: 42,
  FINALIZADA: 60,
  VALIDADA: 70,
  CERRADA: 80,
  CANCELADA: 90
};

const MUTABLE_CORRECTION_STATUSES = ['ACEPTADA', 'EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'];

function dayStart(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function scheduleCue(value) {
  if (!value) return { label: 'Sin fecha', tone: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: 'Sin fecha', tone: '' };

  const today = dayStart(new Date());
  const target = dayStart(date);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays < 0) return { label: 'Vencida', tone: 'danger' };
  if (diffDays === 0) return { label: 'Hoy', tone: 'warn' };
  if (diffDays === 1) return { label: 'Mañana', tone: 'ok' };
  if (diffDays <= 7) return { label: `En ${diffDays} días`, tone: '' };
  return { label: 'Próxima', tone: '' };
}

function hasCorrectionRequested(row) {
  return row?.revision_admin_estado === 'correccion_solicitada';
}

function isCorrectionActionable(row) {
  return hasCorrectionRequested(row) && MUTABLE_CORRECTION_STATUSES.includes(normalizedStatus(row.estado));
}

function matchesQuickFilter(row, quickFilter) {
  if (quickFilter === 'todas') return true;
  const status = normalizedStatus(row.estado);
  const actionableCorrection = isCorrectionActionable(row);
  if (quickFilter === 'correccion') return actionableCorrection;
  if (quickFilter === 'asignadas') return ['ASIGNADA', 'ACEPTADA'].includes(status) && !actionableCorrection;
  if (quickFilter === 'en_curso') return ['EN_CURSO', 'PAUSADA'].includes(status) && !actionableCorrection;
  if (quickFilter === 'pendiente_material') return status === 'PENDIENTE_MATERIAL' && !actionableCorrection;
  if (quickFilter === 'finalizadas') return FINISHED_WORK_ORDER_STATUSES.includes(status);
  return true;
}

function technicianSortValue(row) {
  if (isCorrectionActionable(row)) return 0;
  return STATUS_ORDER[normalizedStatus(row.estado)] ?? 50;
}

function getTechnicianPrimaryAction(row) {
  const status = normalizedStatus(row.estado);
  if (isCorrectionActionable(row)) {
    return { label: 'Corregir OT', to: `/ots/${row.id}/visita`, tone: 'danger', type: 'link' };
  }
  if (['ASIGNADA'].includes(status)) {
    return { label: 'Iniciar intervención', tone: 'primary', type: 'accept' };
  }
  if (['ACEPTADA'].includes(status)) {
    return { label: 'Iniciar intervención', to: `/ots/${row.id}/visita`, tone: 'primary', type: 'link' };
  }
  if (['EN_CURSO', 'PAUSADA'].includes(status)) {
    return { label: 'Continuar intervención', to: `/ots/${row.id}/visita`, tone: 'success', type: 'link' };
  }
  if (status === 'PENDIENTE_MATERIAL') {
    return { label: 'Ver material pendiente', to: `/ots/${row.id}/visita`, tone: 'warning', type: 'link' };
  }
  if (status === 'FINALIZADA') {
    return { label: 'Ver resumen', to: `/ots/${row.id}`, tone: 'neutral', type: 'link' };
  }
  return { label: 'Ver OT', to: `/ots/${row.id}`, tone: 'neutral', type: 'link' };
}

function actionClassName(action) {
  if (action.tone === 'danger') return 'danger-button technician-action-button';
  if (action.tone === 'warning') return 'secondary-button technician-action-button technician-action-button--warning';
  if (action.tone === 'success') return 'primary-button technician-action-button technician-action-button--success';
  return `${action.tone === 'neutral' ? 'secondary-button' : 'primary-button'} technician-action-button`;
}

function statusCopy(row) {
  const status = normalizedStatus(row.estado);
  if (isCorrectionActionable(row)) return 'Corrección solicitada por administración';
  if (hasCorrectionRequested(row) && status === 'FINALIZADA') return 'Finalizada tras corrección, pendiente de revisión';
  if (['ASIGNADA', 'ACEPTADA'].includes(status)) return 'Pendiente de iniciar';
  if (['EN_CURSO', 'PAUSADA'].includes(status)) return 'Intervención en curso';
  if (status === 'PENDIENTE_MATERIAL') return 'Pendiente de material';
  if (status === 'FINALIZADA') return 'Finalizada pendiente de revisión';
  return workOrderStatusLabel(status);
}

export default function MyWorkOrders({ mode = 'mine' }) {
  const navigate = useNavigate();
  const { activeTenantId, activeTenant, activeInstallation, canManageWorkOrders } = useTenant();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'todas', priority: 'todas', quick: 'todas' });

  async function refresh() {
    if (!activeTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await listWorkOrders(activeTenantId, { onlyMine: mode === 'mine', createdByMe: mode === 'created' });
      setRows(data);
    } catch (err) {
      setError(err.message || 'No se han podido cargar tus órdenes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, mode]);

  const isCreated = mode === 'created';
  const isAssignedView = !isCreated;
  const isTechnicianView = !canManageWorkOrders && !isCreated;

  const summary = useMemo(() => ({
    asignadas: rows.filter((row) => matchesQuickFilter(row, 'asignadas')).length,
    en_curso: rows.filter((row) => matchesQuickFilter(row, 'en_curso')).length,
    correccion: rows.filter((row) => matchesQuickFilter(row, 'correccion')).length,
    pendiente_material: rows.filter((row) => matchesQuickFilter(row, 'pendiente_material')).length,
    finalizadas: rows.filter((row) => FINISHED_WORK_ORDER_STATUSES.includes(normalizedStatus(row.estado))).length
  }), [rows]);

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const searchable = [
          row.codigo_ot,
          row.titulo,
          row.descripcion,
          row.instalaciones?.nombre,
          row.instalaciones?.direccion,
          row.instalaciones?.contacto_nombre,
          row.instalaciones?.contacto_telefono,
          row.ubicaciones?.nombre,
          row.activos?.nombre,
          row.revision_admin_notas
        ].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = !text || searchable.includes(text);
        const matchesStatus = filters.status === 'todas' || normalizedStatus(row.estado) === filters.status;
        const matchesPriority = filters.priority === 'todas' || (row.prioridad || 'normal') === filters.priority;
        const matchesQuick = matchesQuickFilter(row, filters.quick);
        return matchesSearch && matchesStatus && matchesPriority && matchesQuick;
      })
      .sort((a, b) => {
        const byStatus = technicianSortValue(a) - technicianSortValue(b);
        if (byStatus !== 0) return byStatus;
        const aDate = a.fecha_prevista ? new Date(a.fecha_prevista).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.fecha_prevista ? new Date(b.fecha_prevista).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
  }, [rows, filters]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function setQuickFilter(value) {
    setFilters((current) => ({ ...current, quick: value, status: 'todas' }));
  }

  function resetFilters() {
    setFilters({ search: '', status: 'todas', priority: 'todas', quick: 'todas' });
  }

  async function acceptWorkOrder(row) {
    setSavingId(row.id);
    setError('');
    setMessage('');
    try {
      const updated = await updateWorkOrderLifecycleStatus(row, 'ACEPTADA');
      setRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, ...updated } : entry));
      setMessage(`OT ${row.codigo_ot || row.id.slice(0, 8)} aceptada. Abriendo intervención.`);
      navigate(`/ots/${row.id}/visita`);
    } catch (err) {
      setError('No se ha podido iniciar la OT. Revisa la conexión e inténtalo de nuevo.');
      console.error('Error iniciando OT', err);
    } finally {
      setSavingId('');
    }
  }

  const pageAction = (
    <div className="quick-actions technician-page-actions">
      <Link className="primary-button" to="/scanner"><QrCode size={18} /> Escanear QR</Link>
      <button className="secondary-button" type="button" onClick={refresh} disabled={loading}><RefreshCw size={18} /> Actualizar</button>
      {canManageWorkOrders && <Link className="secondary-button" to="/ots">Ver todas</Link>}
    </div>
  );

  return (
    <>
      <PageHeader
        title={isCreated ? 'OT creadas por mí' : 'Vista técnico'}
        subtitle={isCreated ? 'Seguimiento de las órdenes que has abierto para otros técnicos o equipos.' : 'Gestiona tus órdenes asignadas, inicia intervenciones y completa los trabajos pendientes.'}
        action={pageAction}
      />
      {canManageWorkOrders && (
        <div className="tabs workorder-tabs">
          <Link to="/ots-dashboard">Dashboard</Link>
          <Link to="/ots-control">Control OT</Link>
          <Link to="/ots-agenda">Agenda OT</Link>
          <Link to="/ots">Todas</Link>
          <Link className={!isCreated ? 'active' : ''} to="/mis-ots">OT asignadas</Link>
          <Link className={isCreated ? 'active' : ''} to="/ots-creadas">Creadas por mí</Link>
        </div>
      )}

      {isAssignedView && (
        <section className="technician-workbench technician-workbench--visible">
          <div className="technician-workbench-head">
            <div>
              <span>{isTechnicianView ? 'Zona técnico' : 'Vista de trabajos asignados'}</span>
              <strong>{activeInstallation?.nombre || activeTenant?.nombre || 'Mis órdenes de trabajo'}</strong>
            </div>
            <Link className="secondary-button" to="/incidencias"><AlertTriangle size={18} /> Aviso</Link>
          </div>
          <div className="technician-kpi-grid technician-kpi-grid--filters" role="list" aria-label="Filtros rápidos de órdenes asignadas">
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={filters.quick === item.key ? 'active' : ''}
                onClick={() => setQuickFilter(filters.quick === item.key ? 'todas' : item.key)}
              >
                <ListChecks size={18} />
                <span>{item.label}</span>
                <strong>{summary[item.key] || 0}</strong>
              </button>
            ))}
          </div>
          <div className="technician-quick-actions">
            <button className="secondary-button" type="button" onClick={() => setQuickFilter('todas')}>Todas</button>
            <button className="secondary-button" type="button" onClick={() => setQuickFilter('finalizadas')}><CheckCircle2 size={18} /> Finalizadas</button>
            <span className="muted">Orden de prioridad: corrección activa, en curso, material, asignadas y finalizadas.</span>
          </div>
        </section>
      )}

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <section className="assigned-ot-filter-panel">
        <div className="assigned-ot-search">
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Buscar por OT, trabajo, instalación, activo o contacto..."
          />
        </div>
        <div className="assigned-ot-filter-grid">
          <label>
            <span><Filter size={15} /> Estado</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="todas">Todos</option>
              {OFFICIAL_WORK_ORDER_STATUSES.map((status) => <option key={status} value={status}>{workOrderStatusLabel(status)}</option>)}
            </select>
          </label>
          <label>
            <span>Prioridad</span>
            <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
              <option value="todas">Todas</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
              <option value="critica">Crítica</option>
            </select>
          </label>
          <div className="assigned-ot-filter-actions">
            <button className="secondary-button" type="button" onClick={() => setQuickFilter('en_curso')}>En curso</button>
            <button className="secondary-button" type="button" onClick={() => setQuickFilter('correccion')}>Corrección</button>
            <button className="ghost-button" type="button" onClick={resetFilters}>Limpiar</button>
          </div>
        </div>
        <p className="muted">Mostrando {filteredRows.length} de {rows.length} OT.</p>
      </section>

      {loading ? (
        <section className="card workorder-loading">
          <RefreshCw size={22} />
          <div>
            <strong>Cargando órdenes...</strong>
            <p className="muted">Estamos preparando las OT asignadas para la vista móvil.</p>
          </div>
        </section>
      ) : isCreated ? (
        <DataTable
          columns={[
            { key: 'foto', label: 'Foto', render: (row) => <WorkOrderThumbnail row={row} /> },
            { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
            { key: 'titulo', label: 'Trabajo' },
            { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
            { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
            { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
            { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
            { key: 'actions', label: 'Acciones', render: (row) => <Link className="primary-button" to={`/ots/${row.id}`}>Ver OT</Link> }
          ]}
          rows={filteredRows}
          empty="No has creado OT"
        />
      ) : (
        <AssignedWorkOrderCards rows={filteredRows} savingId={savingId} onAccept={acceptWorkOrder} />
      )}
    </>
  );
}

function AssignedWorkOrderCards({ rows, savingId = '', onAccept }) {
  if (rows.length === 0) {
    return (
      <section className="empty-state assigned-ot-empty">
        <strong>No tienes órdenes asignadas en este momento.</strong>
        <span>Cuando se te asigne una OT aparecerá aquí con su botón de inicio, continuación o corrección.</span>
      </section>
    );
  }

  return (
    <div className="assigned-ot-list">
      {rows.map((row) => {
        const mapsUrl = buildMapsUrl(row.instalaciones);
        const phone = row.instalaciones?.contacto_telefono;
        const cue = scheduleCue(row.fecha_prevista);
        const status = normalizedStatus(row.estado);
        const action = getTechnicianPrimaryAction(row);
        const readOnly = ['VALIDADA', 'CERRADA', 'CANCELADA'].includes(status);
        const actionableCorrection = isCorrectionActionable(row);
        const cardTone = actionableCorrection ? 'correction' : status.toLowerCase();
        return (
          <article className={`assigned-ot-card technician-ot-card technician-ot-card--${cardTone}`} key={row.id}>
            <WorkOrderThumbnail row={row} compact />
            <div className="assigned-ot-main">
              <div className="assigned-ot-heading">
                <Link className="assigned-ot-code" to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link>
                <WorkOrderStatusBadge status={row.estado} />
              </div>
              <h2>{row.titulo}</h2>
              <div className="technician-status-line">
                <span>{statusCopy(row)}</span>
              </div>
              {hasCorrectionRequested(row) && (
                <div className="technician-correction-box">
                  <strong>{actionableCorrection ? 'Corrección solicitada por administración' : 'Corrección reenviada a revisión'}</strong>
                  <span>{row.revision_admin_notas || (actionableCorrection ? 'Revisa la OT y completa los requisitos pendientes antes de volver a finalizar.' : 'La OT ya está finalizada. Espera la revisión administrativa.')}</span>
                </div>
              )}
              <div className="assigned-ot-meta">
                <span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad || 'normal')}</span>
                <span className={`assigned-ot-time-cue ${cue.tone}`}>{cue.label}</span>
                <span>{row.fecha_prevista ? formatDateTime(row.fecha_prevista) : 'Sin fecha prevista'}</span>
              </div>
              <div className="assigned-ot-place">
                <MapPin size={18} />
                <div>
                  <strong>{row.instalaciones?.nombre || 'Instalación sin nombre'}</strong>
                  <span>{row.instalaciones?.direccion || 'Dirección no indicada'}</span>
                  {row.ubicaciones?.nombre && <span>Ubicación: {row.ubicaciones.nombre}</span>}
                  {row.activos?.nombre && <span>Activo: {row.activos.nombre}</span>}
                </div>
              </div>
            </div>
            <div className="assigned-ot-contact">
              <span className="muted">Contacto instalación</span>
              <strong>{row.instalaciones?.contacto_nombre || 'Sin contacto indicado'}</strong>
              <span>{phone || 'Sin teléfono indicado'}</span>
              <div className="quick-actions technician-card-actions">
                {mapsUrl && !readOnly && <a className="secondary-button" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={18} /> Ruta</a>}
                {phone && !readOnly && <a className="secondary-button" href={`tel:${phone}`}><Phone size={18} /> Llamar</a>}
                {action.type === 'accept' ? (
                  <button className={actionClassName(action)} type="button" disabled={savingId === row.id} onClick={() => onAccept?.(row)}>
                    {savingId === row.id ? 'Iniciando...' : action.label}
                  </button>
                ) : (
                  <Link className={actionClassName(action)} to={action.to}>{action.label}</Link>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
