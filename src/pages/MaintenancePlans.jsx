import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Filter, Plus, Sparkles } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/Layout/Modal';
import DataTable from '../components/Cards/DataTable';
import MaintenancePlanForm from '../components/Maintenance/MaintenancePlanForm';
import MaintenanceSchemaNotice from '../components/Maintenance/MaintenanceSchemaNotice';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createMaintenancePlan, generateScheduledFromPlan, listMaintenancePlans, softDeleteMaintenancePlan } from '../services/maintenancePlanService';
import {
  FV_PREVENTIVE_PLAN_TEMPLATES,
  buildFvMaintenancePlanPayload,
  isFvPlan,
  preventiveBucket,
  preventiveBucketLabel,
  sortPreventivePlans,
  summarizeFvPreventivePlans
} from '../services/maintenanceFvPlanningService';
import { isMaintenanceSchemaMissing } from '../services/maintenanceSchemaGuard';
import { formatDate } from '../utils/dateUtils';
import { maintenanceTypeLabel } from '../constants/maintenance';

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'fv', label: 'Solo FV' },
  { id: 'vencidos', label: 'Vencidos FV' },
  { id: 'proximos', label: 'Próximos FV' },
  { id: 'criticos', label: 'Críticos FV' }
];

export default function MaintenancePlans() {
  const { activeTenantId, activeInstallationId } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,tipo,criticidad,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const { rows: users } = useTenantRows('tenant_members', 'id,user_id,role,profiles(nombre,email)', { order: 'created_at' });
  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [templateId, setTemplateId] = useState('');
  const [draftPlan, setDraftPlan] = useState({ instalacion_id: activeInstallationId || '' });

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

  const summary = useMemo(() => summarizeFvPreventivePlans(plans), [plans]);
  const filteredPlans = useMemo(() => {
    const values = plans.filter((plan) => {
      if (filter === 'fv') return isFvPlan(plan);
      if (filter === 'vencidos') return isFvPlan(plan) && preventiveBucket(plan) === 'vencido';
      if (filter === 'proximos') return isFvPlan(plan) && preventiveBucket(plan) === 'proximo';
      if (filter === 'criticos') return isFvPlan(plan) && ['alta', 'urgente', 'critica'].includes(plan.prioridad || plan.activos?.criticidad);
      return true;
    });
    return sortPreventivePlans(values);
  }, [plans, filter]);

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

  function openCreate(selectedTemplateId = '') {
    const base = { instalacion_id: activeInstallationId || '' };
    setTemplateId(selectedTemplateId);
    setDraftPlan(selectedTemplateId ? buildFvMaintenancePlanPayload(selectedTemplateId, base) : base);
    setOpen(true);
    setMessage('');
    setError('');
  }

  function applyTemplate(selectedTemplateId) {
    setTemplateId(selectedTemplateId);
    setDraftPlan((current) => {
      const base = { ...current, instalacion_id: current.instalacion_id || activeInstallationId || '' };
      return selectedTemplateId ? buildFvMaintenancePlanPayload(selectedTemplateId, base) : base;
    });
  }

  async function submit(payload) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const plan = await createMaintenancePlan(activeTenantId, payload);
      setOpen(false);
      setMessage(`Plan ${plan.nombre} creado correctamente.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function generate(row) {
    setError('');
    setMessage('');
    try {
      const scheduled = await generateScheduledFromPlan(row);
      setMessage(`Actuación programada generada para ${row.nombre}: ${formatDate(scheduled.fecha_programada)}.`);
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
      <PageHeader
        title="Planes preventivos"
        subtitle="Planificación preventiva por activo: vencidos, próximos, OT generadas y revisiones FV."
        action={<button className="primary-button" onClick={() => openCreate()} disabled={schemaPending}><Plus size={18} /> Nuevo plan</button>}
      />
      {schemaPending && <MaintenanceSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <div className="summary-grid">
        <button className="metric-card" type="button" onClick={() => setFilter('fv')}>
          <span>Planes FV</span>
          <strong>{summary.fvTotal}</strong>
          <small>{summary.total} planes totales</small>
        </button>
        <button className="metric-card danger" type="button" onClick={() => setFilter('vencidos')}>
          <span>FV vencidos</span>
          <strong>{summary.vencidos}</strong>
          <small>requieren actuación</small>
        </button>
        <button className="metric-card warn" type="button" onClick={() => setFilter('proximos')}>
          <span>FV próximos</span>
          <strong>{summary.proximos}</strong>
          <small>dentro del preaviso</small>
        </button>
        <button className="metric-card" type="button" onClick={() => setFilter('criticos')}>
          <span>FV críticos</span>
          <strong>{summary.activosCriticos}</strong>
          <small>alta prioridad</small>
        </button>
      </div>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Plantillas rápidas FV</h2>
            <p className="muted">Crea planes preventivos de inversor, strings, cuadros AC/DC, contador, limpieza o seguridad.</p>
          </div>
          <Sparkles size={22} />
        </div>
        <div className="quick-actions">
          {FV_PREVENTIVE_PLAN_TEMPLATES.slice(0, 5).map((template) => (
            <button className="secondary-button" type="button" key={template.id} onClick={() => openCreate(template.id)}>
              {template.nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Listado preventivo</h2>
            <p className="muted">Primero aparecen los vencidos, después próximos y programados. Generar actuación no duplica OT: primero crea el mantenimiento programado.</p>
          </div>
          <Filter size={22} />
        </div>
        <div className="quick-actions user-filter-actions">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className={filter === item.id ? 'primary-button' : 'secondary-button'} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
        {summary.vencidos > 0 && (
          <p className="warning-text"><AlertTriangle size={16} /> Hay planes FV vencidos. Genera la actuación y después la OT desde la planificación para mantener el historial del activo.</p>
        )}
        <DataTable columns={[
          { key: 'nombre', label: 'Plan', render: (row) => <Link className="table-link" to={`/mantenimiento/planes/${row.id}`}>{row.nombre}</Link> },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
          { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
          { key: 'periodicidad', label: 'Periodicidad', render: (row) => row.periodicidad_unidad === 'manual' ? 'Manual' : `${row.periodicidad_valor || '-'} ${row.periodicidad_unidad || ''}` },
          { key: 'proxima', label: 'Próxima', render: (row) => formatDate(row.fecha_proxima_realizacion) },
          { key: 'ventana', label: 'Ventana', render: (row) => <span className={`badge ${preventiveBucket(row) === 'vencido' ? 'danger' : preventiveBucket(row) === 'proximo' ? 'warn' : row.activo ? 'ok' : ''}`}>{preventiveBucketLabel(row)}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.activo ? 'ok' : ''}`}>{row.activo ? 'Activo' : 'Inactivo'}</span> },
          { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions"><button className="secondary-button table-action" onClick={() => generate(row)}><CalendarClock size={16} /> Generar actuación</button><button className="danger-button" onClick={() => remove(row)}>Baja</button></div> }
        ]} rows={filteredPlans} empty="No hay planes de mantenimiento en el contexto seleccionado." />
      </section>

      <Modal title="Nuevo plan de mantenimiento" open={open} onClose={() => setOpen(false)}>
        <div className="form-grid">
          <div className="card maintenance-form-section">
            <div className="section-title">
              <div>
                <h2>Plantilla FV opcional</h2>
                <p className="muted">Selecciona una plantilla para rellenar periodicidad, instrucciones, prioridad y checklist base.</p>
              </div>
            </div>
            <select value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">Sin plantilla FV</option>
              {FV_PREVENTIVE_PLAN_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.nombre}</option>
              ))}
            </select>
          </div>
          <MaintenancePlanForm plan={draftPlan} installations={contextInstallations} locations={contextLocations} assets={contextAssets} users={users} onSubmit={submit} onCancel={() => setOpen(false)} saving={saving} />
        </div>
      </Modal>
    </>
  );
}
