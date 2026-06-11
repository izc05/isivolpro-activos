import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';

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
      <DataTable
        columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
          { key: 'actions', label: 'Acciones', render: (row) => <Link className="primary-button" to={isCreated ? `/ots/${row.id}` : `/ots/${row.id}/visita`}>{isCreated ? 'Ver OT' : 'Abrir visita'}</Link> }
        ]}
        rows={rows}
        empty={isCreated ? 'No has creado OT' : 'No tienes OT asignadas'}
      />
    </>
  );
}
