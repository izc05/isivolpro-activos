import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { listWorkOrders } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';

export default function MyWorkOrders() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  async function refresh() {
    if (!activeTenantId) return;
    try {
      const data = await listWorkOrders(activeTenantId, { onlyMine: true });
      setRows(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId]);

  return (
    <>
      <PageHeader
        title="Mis OT"
        subtitle="Ordenes asignadas a tu usuario para iniciar visitas, registrar observaciones y cerrar trabajos."
        action={<Link className="secondary-button" to="/ots">Ver todas</Link>}
      />
      {error && <p className="error-text">{error}</p>}
      <DataTable
        columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
          { key: 'actions', label: 'Acciones', render: (row) => <Link className="primary-button" to={`/ots/${row.id}/visita`}>Abrir visita</Link> }
        ]}
        rows={rows}
        empty="No tienes OT asignadas"
      />
    </>
  );
}
