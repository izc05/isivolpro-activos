import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/Layout/Modal';
import DataTable from '../components/Cards/DataTable';
import MaintenancePlanForm from '../components/Maintenance/MaintenancePlanForm';
import MaintenanceSchemaNotice from '../components/Maintenance/MaintenanceSchemaNotice';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createMaintenancePlan, generateScheduledFromPlan, listMaintenancePlans, softDeleteMaintenancePlan } from '../services/maintenancePlanService';
import { isMaintenanceSchemaMissing } from '../services/maintenanceSchemaGuard';
import { formatDate } from '../utils/dateUtils';
import { maintenanceTypeLabel } from '../constants/maintenance';

export default function MaintenancePlans() {
  const { activeTenantId, activeInstallationId } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const { rows: users } = useTenantRows('tenant_members', 'id,user_id,role,profiles(nombre,email)', { order: 'created_at' });
  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);
  const [saving, setSaving] = useState(false);

  const contextInstallations = useMemo(
    () => activeInstallationId ? installations.filter((item) => item.id === activeInstallationId) : installations,
    [installations, activeInstallationId]
  );
  const contextLocations = useMemo(
    () => activeInstallationId ? locations.filter((item) => item.instalacion_id === activeInstallationId) : locations,
    [locations, activeInstallationId]
  );
  const contextAssets = useMemo(
    () => activeInstallationId ? assets.filter((item) => item.instalacion_id === activeInstallationId) : assets,
    [assets, activeInstallationId]
  );

  async function refresh() {
    if (!activeTenantId) return;
    setError('');
    setSchemaPending(false);
    try {
      setPlans(await listMaintenancePlans(activeTenantId, activeInstallationId));
    } catch (err) {
      if (isMaintenanceSchemaMissing(err)) {
        setPlans([]);
        setSchemaPending(true);
        return;
      }
      throw err;
    }
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [activeTenantId, activeInstallationId]);

  async function submit(payload) {
    setSaving(true);
    setError('');
    try {
      await createMaintenancePlan(activeTenantId, payload);
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function generate(row) {
    setError('');
    try {
      await generateScheduledFromPlan(row);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el plan "${row.nombre}"?`)) return;
    await softDeleteMaintenancePlan(row);
    await refresh();
  }

  return (
    <>
      <PageHeader title="Planes preventivos" subtitle="Planes por activo con periodicidad, checklist, responsable y próxima actuación." action={<button className="primary-button" onClick={() => setOpen(true)} disabled={schemaPending}><Plus size={18} /> Nuevo plan</button>} />
      {schemaPending && <MaintenanceSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'nombre', label: 'Plan', render: (row) => <Link className="table-link" to={`/mantenimiento/planes/${row.id}`}>{row.nombre}</Link> },
        { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
        { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
        { key: 'periodicidad', label: 'Periodicidad', render: (row) => row.periodicidad_unidad === 'manual' ? 'Manual' : `${row.periodicidad_valor || '-'} ${row.periodicidad_unidad || ''}` },
        { key: 'proxima', label: 'Próxima', render: (row) => formatDate(row.fecha_proxima_realizacion) },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.activo ? 'ok' : ''}`}>{row.activo ? 'Activo' : 'Inactivo'}</span> },
        { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions"><button className="secondary-button table-action" onClick={() => generate(row)}>Generar actuación</button><button className="danger-button" onClick={() => remove(row)}>Baja</button></div> }
      ]} rows={plans} empty="No hay planes de mantenimiento en el contexto seleccionado." />
      <Modal title="Nuevo plan de mantenimiento" open={open} onClose={() => setOpen(false)}>
        <MaintenancePlanForm installations={contextInstallations} locations={contextLocations} assets={contextAssets} users={users} onSubmit={submit} onCancel={() => setOpen(false)} saving={saving} />
      </Modal>
    </>
  );
}
