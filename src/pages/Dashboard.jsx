import { Link } from 'react-router-dom';
import { Building2, Home, Plus, QrCode, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import MetricCard from '../components/Cards/MetricCard';
import DataTable from '../components/Cards/DataTable';
import PageHeader from '../components/Layout/PageHeader';
import { useTenant } from '../hooks/useTenant';
import { dashboardMetrics } from '../services/tenantService';
import { formatDateTime } from '../utils/dateUtils';

export default function Dashboard() {
  const {
    tenants,
    activeTenant,
    activeTenantId,
    activeInstallationId,
    activeInstallation,
    installations,
    setActiveTenantId,
    setActiveInstallationId
  } = useTenant();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (activeTenantId) dashboardMetrics(activeTenantId, activeInstallationId).then(setMetrics).catch(console.error);
  }, [activeTenantId, activeInstallationId]);

  const data = metrics || { totalInstalaciones: 0, totalActivos: 0, pendientesRevision: 0, incidenciasAbiertas: 0, documentosRecientes: [] };

  function selectClient(tenantId) {
    setActiveTenantId(tenantId);
    setMetrics(null);
  }

  function selectInstallation(installationId) {
    setActiveInstallationId(installationId);
    setMetrics(null);
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Primero selecciona cliente y despues entra en una de sus instalaciones." />

      <section className="dashboard-flow-card">
        <div className="section-title compact-title">
          <div>
            <h2>1. Clientes</h2>
            <p>Un cliente puede tener varias instalaciones. El cliente activo filtra todo el inventario.</p>
          </div>
          <Link className="secondary-button" to="/clientes"><Building2 size={16} /> Gestionar clientes</Link>
        </div>
        <div className="client-card-grid">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              className={`client-select-card ${tenant.id === activeTenantId ? 'active' : ''}`}
              onClick={() => selectClient(tenant.id)}
            >
              <span className="client-select-icon"><Building2 size={20} /></span>
              <strong>{tenant.nombre}</strong>
              <small>{tenant.estado || 'activo'} · {tenant.plan || 'starter'}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-flow-card">
        <div className="section-title compact-title">
          <div>
            <h2>2. Instalaciones de {activeTenant?.nombre || 'cliente activo'}</h2>
            <p>Selecciona una instalación para trabajar sobre sus ubicaciones, activos, OT, documentos y fotos.</p>
          </div>
          <Link className="primary-button" to="/instalaciones"><Plus size={16} /> Nueva instalación</Link>
        </div>
        <div className="installation-card-grid">
          {installations.map((installation) => (
            <button
              key={installation.id}
              type="button"
              className={`installation-select-card ${installation.id === activeInstallationId ? 'active' : ''}`}
              onClick={() => selectInstallation(installation.id)}
            >
              <span className="installation-select-icon"><Home size={20} /></span>
              <strong>{installation.nombre}</strong>
              <small>{installation.direccion || installation.tipo || 'Sin dirección'}</small>
              <em>{installation.id === activeInstallationId ? 'Instalación activa' : 'Activar instalación'}</em>
            </button>
          ))}
          {installations.length === 0 && <p className="muted">Este cliente todavía no tiene instalaciones.</p>}
        </div>
      </section>

      <PageHeader title="Estado de la instalación activa" subtitle={activeInstallation ? `Estado operativo de ${activeInstallation.nombre}.` : 'Selecciona una instalación para ver sus datos.'} />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeTenant?.nombre} · {activeInstallation.nombre}</p>}
      <div className="grid metrics">
        <MetricCard label={activeInstallation ? 'Instalación activa' : 'Instalaciones'} value={data.totalInstalaciones} />
        <MetricCard label="Activos" value={data.totalActivos} />
        <MetricCard label="Pendientes revisión" value={data.pendientesRevision} tone="warn" />
        <MetricCard label="Incidencias abiertas" value={data.incidenciasAbiertas} tone="danger" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="quick-actions">
          <Link className="primary-button" to="/scanner"><QrCode size={18} /> Escanear QR</Link>
          <Link className="secondary-button" to="/instalaciones"><Home size={18} /> Ver instalaciones</Link>
          <Link className="secondary-button" to="/activos"><Wrench size={18} /> Ver activos</Link>
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
