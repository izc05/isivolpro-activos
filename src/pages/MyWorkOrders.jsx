import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, Phone } from 'lucide-react';
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
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

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

  return (
    <>
      <PageHeader
        title={isCreated ? 'OT creadas por mi' : 'OT asignadas'}
        subtitle={isCreated ? 'Seguimiento de las ordenes que has abierto para otros tecnicos o equipos.' : 'Ordenes enviadas al tecnico para iniciar visitas, registrar observaciones y completar checklist.'}
        action={<Link className="secondary-button" to="/ots">Ver todas</Link>}
      />
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link to="/ots">Todas</Link>
        <Link className={!isCreated ? 'active' : ''} to="/mis-ots">OT asignadas</Link>
        <Link className={isCreated ? 'active' : ''} to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}
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
          rows={rows}
          empty="No has creado OT"
        />
      ) : (
        <AssignedWorkOrderCards rows={rows} />
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
