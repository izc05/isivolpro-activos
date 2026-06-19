import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { generateWorkOrderForScheduledMaintenance, listScheduledMaintenances } from '../services/scheduledMaintenanceService';
import { formatDate } from '../utils/dateUtils';
import { maintenanceStatusClass, maintenanceStatusLabel, maintenanceTypeLabel } from '../constants/maintenance';

export default function MaintenanceCalendar() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('mes');
  const [error, setError] = useState('');

  async function refresh() {
    if (!activeTenantId) return;
    setRows(await listScheduledMaintenances(activeTenantId));
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
      {error && <p className="error-text">{error}</p>}
      <div className="maintenance-calendar-list">
        <DataTable columns={[
          { key: 'fecha_programada', label: 'Fecha', render: (row) => formatDate(row.fecha_programada) },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
          { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre },
          { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
          { key: 'prioridad', label: 'Prioridad' },
          { key: 'tecnico', label: 'Técnico', render: (row) => row.assigned?.nombre || row.assigned?.email || '-' },
          { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${maintenanceStatusClass(row.estado_visual || row.estado)}`}>{maintenanceStatusLabel(row.estado_visual || row.estado)}</span> },
          { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions">{row.ot_id ? <Link className="secondary-button table-action" to={`/ots/${row.ot_id}`}>Abrir OT</Link> : <button className="secondary-button table-action" onClick={() => generate(row)}>Generar OT</button>}</div> }
        ]} rows={visibleRows} empty="No hay actuaciones en esta vista." />
      </div>
    </>
  );
}
