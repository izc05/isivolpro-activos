import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock3, Filter, ListChecks, MapPin, Navigation, Phone, QrCode, Search } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderThumbnail from '../components/WorkOrders/WorkOrderThumbnail';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';
import { buildMapsUrl } from '../utils/mapUtils';
import { priorityLabel, priorityTone } from '../utils/workOrderLifecycle';

export default function MyWorkOrders({ mode = 'mine' }) {
  const { activeTenantId, activeTenant, activeInstallation, canManageWorkOrders } = useTenant();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'todas', priority: 'todas' });

  async function refresh() {
    if (!activeTenantId) return;
    try {
      const data = await listWorkOrders(activeTenantId, { onlyMine: mode === 'mine', createdByMe: mode === 'created' });
      setRows(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, mode]);

  const isCreated = mode === 'created';
  const isTechnicianView = !canManageWorkOrders && !isCreated;
  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [
        row.codigo_ot,
        row.titulo,
        row.descripcion,
        row.instalaciones?.nombre,
        row.instalaciones?.direccion,
        row.instalaciones?.contacto_nombre,
        row.instalaciones?.contacto_telefono,
        row.ubicaciones?.nombre,
        row.activos?.nombre
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !text || searchable.includes(text);
      const matchesStatus = filters.status === 'todas' || row.estado === filters.status;
      const matchesPriority = filters.priority === 'todas' || (row.prioridad || 'normal') === filters.priority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [rows, filters]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const openStatuses = ['NUEVA', 'ASIGNADA', 'ACEPTADA', 'EN_CURSO', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'];
    return {
      open: rows.filter((row) => openStatuses.includes(row.estado)).length,
      urgent: rows.filter((row) => ['urgente', 'critica'].includes(row.prioridad)).length,
      today: rows.filter((row) => row.fecha_prevista?.slice(0, 10) === today).length,
      done: rows.filter((row) => ['FINALIZADA', 'VALIDADA', 'CERRADA'].includes(row.estado)).length
    };
  }, [rows]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', status: 'todas', priority: 'todas' });
  }

  return (
    <>
      <PageHeader
        title={isCreated ? 'OT creadas por mi' : 'OT asignadas'}
        subtitle={isCreated ? 'Seguimiento de las ordenes que has abierto para otros tecnicos o equipos.' : 'Ordenes enviadas al tecnico para iniciar visitas, registrar observaciones y completar checklist.'}
        action={canManageWorkOrders ? <Link className="secondary-button" to="/ots">Ver todas</Link> : <Link className="primary-button" to="/scanner"><QrCode size={18} /> Escanear QR</Link>}
      />
      {canManageWorkOrders && (
        <div className="tabs workorder-tabs">
          <Link to="/ots-dashboard">Dashboard</Link>
          <Link to="/ots">Todas</Link>
          <Link className={!isCreated ? 'active' : ''} to="/mis-ots">OT asignadas</Link>
          <Link className={isCreated ? 'active' : ''} to="/ots-creadas">Creadas por mi</Link>
        </div>
      )}
      {isTechnicianView && (
        <section className="technician-workbench">
          <div className="technician-workbench-head">
            <div>
              <span>Zona técnico</span>
              <strong>{activeInstallation?.nombre || activeTenant?.nombre || 'Mis trabajos'}</strong>
            </div>
            <Link className="secondary-button" to="/incidencias"><AlertTriangle size={18} /> Aviso</Link>
          </div>
          <div className="technician-kpi-grid">
            <article><ListChecks size={18} /><span>Abiertas</span><strong>{summary.open}</strong></article>
            <article><Clock3 size={18} /><span>Hoy</span><strong>{summary.today}</strong></article>
            <article className={summary.urgent ? 'warn' : ''}><AlertTriangle size={18} /><span>Urgentes</span><strong>{summary.urgent}</strong></article>
            <article><CheckCircle2 size={18} /><span>Cerradas</span><strong>{summary.done}</strong></article>
          </div>
          <div className="technician-quick-actions">
            <Link className="primary-button" to="/scanner"><QrCode size={18} /> Escanear QR</Link>
            <button className="secondary-button" type="button" onClick={() => updateFilter('status', 'EN_CURSO')}>En curso</button>
            <button className="secondary-button" type="button" onClick={() => updateFilter('priority', 'urgente')}>Urgentes</button>
          </div>
        </section>
      )}
      {error && <p className="error-text">{error}</p>}
      <section className="assigned-ot-filter-panel">
        <div className="assigned-ot-search">
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Buscar por OT, trabajo, instalacion, activo o contacto..."
          />
        </div>
        <div className="assigned-ot-filter-grid">
          <label>
            <span><Filter size={15} /> Estado</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="todas">Todos</option>
              <option value="NUEVA">Nueva</option>
              <option value="ASIGNADA">Asignada</option>
              <option value="ACEPTADA">Aceptada</option>
              <option value="EN_CURSO">En curso</option>
              <option value="PENDIENTE_MATERIAL">Pendiente material</option>
              <option value="PENDIENTE_CLIENTE">Pendiente cliente</option>
              <option value="FINALIZADA">Finalizada</option>
              <option value="VALIDADA">Validada</option>
              <option value="CANCELADA">Cancelada</option>
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
              <option value="critica">Critica</option>
            </select>
          </label>
          <div className="assigned-ot-filter-actions">
            <button className="secondary-button" type="button" onClick={() => updateFilter('status', 'EN_CURSO')}>En curso</button>
            <button className="secondary-button" type="button" onClick={() => updateFilter('priority', 'urgente')}>Urgentes</button>
            <button className="ghost-button" type="button" onClick={resetFilters}>Limpiar</button>
          </div>
        </div>
        <p className="muted">Mostrando {filteredRows.length} de {rows.length} OT.</p>
      </section>
      {isCreated ? (
        <DataTable
          columns={[
            { key: 'foto', label: 'Foto', render: (row) => <WorkOrderThumbnail row={row} /> },
            { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
            { key: 'titulo', label: 'Trabajo' },
            { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
            { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
            { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
            { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
            { key: 'actions', label: 'Acciones', render: (row) => <Link className="primary-button" to={`/ots/${row.id}`}>Ver OT</Link> }
          ]}
          rows={filteredRows}
          empty="No has creado OT"
        />
      ) : (
        <AssignedWorkOrderCards rows={filteredRows} />
      )}
    </>
  );
}

function AssignedWorkOrderCards({ rows }) {
  if (rows.length === 0) return <p className="muted">No tienes OT asignadas</p>;

  return (
    <div className="assigned-ot-list">
      {rows.map((row) => {
        const mapsUrl = buildMapsUrl(row.instalaciones);
        const phone = row.instalaciones?.contacto_telefono;
        return (
          <article className="assigned-ot-card" key={row.id}>
            <WorkOrderThumbnail row={row} compact />
            <div className="assigned-ot-main">
              <div className="assigned-ot-heading">
                <Link className="assigned-ot-code" to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link>
                <WorkOrderStatusBadge status={row.estado} />
              </div>
              <h2>{row.titulo}</h2>
              <div className="assigned-ot-meta">
                <span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad || 'normal')}</span>
                <span>{row.fecha_prevista ? formatDateTime(row.fecha_prevista) : 'Sin fecha prevista'}</span>
              </div>
              <div className="assigned-ot-place">
                <MapPin size={18} />
                <div>
                  <strong>{row.instalaciones?.nombre || 'Instalacion sin nombre'}</strong>
                  <span>{row.instalaciones?.direccion || 'Direccion no indicada'}</span>
                  {row.ubicaciones?.nombre && <span>{row.ubicaciones.nombre}</span>}
                  {row.activos?.nombre && <span>Activo: {row.activos.nombre}</span>}
                </div>
              </div>
            </div>
            <div className="assigned-ot-contact">
              <span className="muted">Contacto instalacion</span>
              <strong>{row.instalaciones?.contacto_nombre || 'Sin contacto indicado'}</strong>
              <span>{phone || 'Sin telefono indicado'}</span>
              <div className="quick-actions">
                {mapsUrl && <a className="secondary-button" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={18} /> Ruta</a>}
                {phone && <a className="secondary-button" href={`tel:${phone}`}><Phone size={18} /> Llamar</a>}
                <Link className="primary-button" to={`/ots/${row.id}/visita`}>Abrir visita</Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
