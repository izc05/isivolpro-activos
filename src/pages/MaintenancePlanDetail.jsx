import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import MaintenancePlanForm from '../components/Maintenance/MaintenancePlanForm';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { duplicateMaintenancePlan, generateScheduledFromPlan, getMaintenancePlan, recalculateMaintenancePlanNextDate, setMaintenancePlanActive, updateMaintenancePlan } from '../services/maintenancePlanService';
import { listScheduledMaintenances } from '../services/scheduledMaintenanceService';
import { formatDate } from '../utils/dateUtils';
import { maintenanceStatusClass, maintenanceStatusLabel } from '../constants/maintenance';

export default function MaintenancePlanDetail() {
  const { id } = useParams();
  const { activeTenantId } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const { rows: users } = useTenantRows('tenant_members', 'id,user_id,role,profiles(nombre,email)', { order: 'created_at' });
  const [plan, setPlan] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!activeTenantId || !id) return;
    const [planData, scheduledData] = await Promise.all([getMaintenancePlan(activeTenantId, id), listScheduledMaintenances(activeTenantId)]);
    setPlan(planData);
    setScheduled(scheduledData.filter((item) => item.plan_id === id));
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [activeTenantId, id]);

  async function submit(payload) {
    setSaving(true);
    setError('');
    try {
      await updateMaintenancePlan(plan, payload);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action) {
    setError('');
    try {
      if (action === 'duplicate') await duplicateMaintenancePlan(plan);
      if (action === 'toggle') await setMaintenancePlanActive(plan, !plan.activo);
      if (action === 'generate') await generateScheduledFromPlan(plan);
      if (action === 'recalculate') await recalculateMaintenancePlanNextDate(plan);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!plan) return <PageHeader title="Plan de mantenimiento" subtitle="Cargando..." />;

  return (
    <>
      <PageHeader
        title={plan.nombre}
        subtitle={`${plan.activos?.nombre || 'Activo'} · próxima realización ${formatDate(plan.fecha_proxima_realizacion)}`}
        action={<div className="button-row"><Link className="secondary-button" to="/mantenimiento/planes">Volver</Link><button className="secondary-button" onClick={() => runAction('duplicate')}>Duplicar</button><button className="secondary-button" onClick={() => runAction('toggle')}>{plan.activo ? 'Desactivar' : 'Activar'}</button><button className="primary-button" onClick={() => runAction('generate')}>Generar actuación</button></div>}
      />
      {error && <p className="error-text">{error}</p>}
      <div className="grid two">
        <section className="card">
          <h2 className="section-heading">Editar plan</h2>
          <MaintenancePlanForm plan={plan} installations={installations} locations={locations} assets={assets} users={users} onSubmit={submit} saving={saving} />
        </section>
        <section>
          <h2 className="section-heading">Actuaciones del plan</h2>
          <div className="button-row"><button className="secondary-button" onClick={() => runAction('recalculate')}>Recalcular próxima fecha</button></div>
          <DataTable columns={[
            { key: 'fecha_programada', label: 'Fecha', render: (row) => formatDate(row.fecha_programada) },
            { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${maintenanceStatusClass(row.estado_visual || row.estado)}`}>{maintenanceStatusLabel(row.estado_visual || row.estado)}</span> },
            { key: 'prioridad', label: 'Prioridad' },
            { key: 'ot', label: 'OT', render: (row) => row.ot_id ? <Link className="table-link" to={`/ots/${row.ot_id}`}>Abrir OT</Link> : '-' }
          ]} rows={scheduled} empty="Sin actuaciones generadas." />
        </section>
      </div>
    </>
  );
}
