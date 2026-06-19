import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import MaintenanceSchemaNotice from '../components/Maintenance/MaintenanceSchemaNotice';
import { useTenant } from '../hooks/useTenant';
import { generateWorkOrderForScheduledMaintenance, listScheduledMaintenances } from '../services/scheduledMaintenanceService';
import { isMaintenanceSchemaMissing } from '../services/maintenanceSchemaGuard';
import { formatDate } from '../utils/dateUtils';
import { maintenanceStatusClass, maintenanceStatusLabel, maintenanceTypeLabel } from '../constants/maintenance';

export default function PendingMaintenance() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

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

  const pending = useMemo(() => rows.filter((row) => !['completado', 'cancelado', 'no_aplica'].includes(row.estado)).sort((a, b) => new Date(a.fecha_programada || 0) - new Date(b.fecha_programada || 0)), [rows]);

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
      <PageHeader title="Trabajos pendientes" subtitle="Actuaciones por plan, correctivo o registro manual pendientes de resolver." />
      {schemaPending && <MaintenanceSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'fecha_programada', label: 'Fecha', render: (row) => formatDate(row.fecha_programada) },
        { key: 'titulo', label: 'Trabajo' },
        { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
        { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
        { key: 'prioridad', label: 'Prioridad' },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${maintenanceStatusClass(row.estado_visual || row.estado)}`}>{maintenanceStatusLabel(row.estado_visual || row.estado)}</span> },
        { key: 'ot', label: 'OT', render: (row) => row.ot_id ? <Link className="table-link" to={`/ots/${row.ot_id}`}>Abrir OT</Link> : <button className="secondary-button table-action" onClick={() => generate(row)}>Generar OT</button> }
      ]} rows={pending} empty="No hay trabajos pendientes." />
    </>
  );
}
