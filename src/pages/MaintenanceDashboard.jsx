import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardCheck, Euro, Package, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { loadMaintenanceDashboard } from '../services/maintenanceMetricsService';
import { formatDate } from '../utils/dateUtils';
import { maintenanceStatusClass, maintenanceStatusLabel, maintenanceTypeLabel } from '../constants/maintenance';

export default function MaintenanceDashboard() {
  const { activeTenantId } = useTenant();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeTenantId) return;
    let mounted = true;
    setError('');
    loadMaintenanceDashboard(activeTenantId)
      .then((result) => { if (mounted) setData(result); })
      .catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [activeTenantId]);

  const metrics = data?.metrics || {};
  const cards = useMemo(() => [
    ['Previstos hoy', metrics.today || 0, CalendarClock],
    ['Próximos 7 días', metrics.next7 || 0, CalendarClock],
    ['Próximos 30 días', metrics.next30 || 0, ClipboardCheck],
    ['Vencidos', metrics.overdue || 0, AlertTriangle, 'danger'],
    ['Correctivos abiertos', metrics.openCorrective || 0, Wrench],
    ['Correctivos urgentes', metrics.urgentCorrective || 0, AlertTriangle, 'danger'],
    ['Activos averiados', metrics.brokenAssets || 0, AlertTriangle, 'danger'],
    ['Fuera de servicio', metrics.outOfServiceAssets || 0, AlertTriangle, 'danger'],
    ['Pendiente material', metrics.pendingMaterial || 0, Package, 'warn'],
    ['Planes activos', metrics.activePlans || 0, ClipboardCheck],
    ['Activos sin plan', metrics.assetsWithoutPlan || 0, Wrench, 'warn'],
    ['Cumplimiento mensual', `${metrics.monthlyCompliance ?? 100}%`, ClipboardCheck, (metrics.monthlyCompliance ?? 100) < 80 ? 'warn' : 'ok'],
    ['Coste mensual', `${Number(metrics.monthlyCost || 0).toFixed(2)} €`, Euro]
  ], [metrics]);

  return (
    <>
      <PageHeader
        title="Panel mantenimiento"
        subtitle="Planificación, seguimiento y resultado técnico de activos."
        action={<div className="button-row"><Link className="secondary-button" to="/mantenimiento/planes">Planes</Link><Link className="primary-button" to="/mantenimiento/correctivos">Crear correctivo</Link></div>}
      />
      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p className="muted">Cargando panel...</p>}
      <section className="grid metrics maintenance-metrics">
        {cards.map(([label, value, Icon, tone]) => (
          <article className={`metric-card ${tone || ''}`} key={label}>
            <Icon size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <div className="grid two maintenance-dashboard-grid">
        <section>
          <h2 className="section-heading">Trabajos vencidos</h2>
          <MaintenanceTable rows={data?.overdue || []} />
        </section>
        <section>
          <h2 className="section-heading">Próximos trabajos</h2>
          <MaintenanceTable rows={data?.upcoming || []} />
        </section>
      </div>
      <div className="grid two maintenance-dashboard-grid">
        <section>
          <h2 className="section-heading">Correctivos en curso</h2>
          <MaintenanceTable rows={data?.corrective || []} />
        </section>
        <section>
          <h2 className="section-heading">Últimas intervenciones</h2>
          <DataTable columns={[
            { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha) },
            { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
            { key: 'titulo', label: 'Trabajo' },
            { key: 'resultado', label: 'Resultado', render: (row) => row.resultado || row.estado_final || '-' },
            { key: 'coste', label: 'Coste', render: (row) => `${Number(row.coste_total || 0).toFixed(2)} €` }
          ]} rows={data?.latest || []} empty="Sin intervenciones registradas." />
        </section>
      </div>
    </>
  );
}

function MaintenanceTable({ rows }) {
  return (
    <DataTable columns={[
      { key: 'fecha_programada', label: 'Fecha', render: (row) => formatDate(row.fecha_programada) },
      { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
      { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
      { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${['urgente', 'critica'].includes(row.prioridad) ? 'danger' : ''}`}>{row.prioridad}</span> },
      { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${maintenanceStatusClass(row.estado_visual || row.estado_calculado || row.estado)}`}>{maintenanceStatusLabel(row.estado_visual || row.estado_calculado || row.estado)}</span> },
      { key: 'ot', label: 'OT', render: (row) => row.ot_id ? <Link className="table-link" to={`/ots/${row.ot_id}`}>{row.ordenes_trabajo?.codigo_ot || 'Abrir'}</Link> : '-' }
    ]} rows={rows} empty="Sin trabajos." />
  );
}
