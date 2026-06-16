import { Link } from 'react-router-dom';
import { Plus, QrCode, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import MetricCard from '../components/Cards/MetricCard';
import DataTable from '../components/Cards/DataTable';
import PageHeader from '../components/Layout/PageHeader';
import { useTenant } from '../hooks/useTenant';
import { dashboardMetrics } from '../services/tenantService';
import { formatDateTime } from '../utils/dateUtils';

export default function Dashboard() {
  const { activeTenantId, activeInstallationId, activeInstallation } = useTenant();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (activeTenantId) dashboardMetrics(activeTenantId, activeInstallationId).then(setMetrics).catch(console.error);
  }, [activeTenantId, activeInstallationId]);

  const data = metrics || { totalInstalaciones: 0, totalActivos: 0, pendientesRevision: 0, incidenciasAbiertas: 0, documentosRecientes: [] };

  return (
    <>
      <PageHeader title="Dashboard" subtitle={activeInstallation ? `Estado operativo de ${activeInstallation.nombre}.` : 'Estado operativo de instalaciones, activos e incidencias.'} />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeInstallation.nombre}</p>}
      <div className="grid metrics">
        <MetricCard label={activeInstallation ? 'Instalación activa' : 'Instalaciones'} value={data.totalInstalaciones} />
        <MetricCard label="Activos" value={data.totalActivos} />
        <MetricCard label="Pendientes revision" value={data.pendientesRevision} tone="warn" />
        <MetricCard label="Incidencias abiertas" value={data.incidenciasAbiertas} tone="danger" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="quick-actions">
          <Link className="primary-button" to="/scanner"><QrCode size={18} /> Escanear QR</Link>
          <Link className="secondary-button" to="/instalaciones"><Plus size={18} /> Nueva instalacion</Link>
          <Link className="secondary-button" to="/activos"><Wrench size={18} /> Nuevo activo</Link>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <DataTable
          columns={[
            { key: 'titulo', label: 'Documentos recientes' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'visibilidad', label: 'Visibilidad', render: (row) => <span className="badge">{row.visibilidad}</span> },
            { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) }
          ]}
          rows={data.documentosRecientes}
          empty="Sin documentos recientes para la instalación activa"
        />
      </div>
    </>
  );
}
