import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import {
  createWorkOrder,
  defaultRequirementsForType,
  ensureDefaultChecklist,
  listWorkOrders,
  REQUIREMENT_FIELDS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPE_LABELS,
  WORK_ORDER_TYPES
} from '../services/workOrderService';
import { listTenantMembers } from '../services/tenantService';
import { formatDateTime } from '../utils/dateUtils';

function buildInitialForm() {
  const tipo = 'mantenimiento_preventivo';
  return {
    instalacion_id: '',
    ubicacion_id: '',
    activo_id: '',
    activos_relacionados: [],
    titulo: '',
    descripcion: '',
    tipo,
    tipo_ot: tipo,
    tipo_ot_detalle: '',
    sintomas: '',
    trabajo_solicitado: '',
    instrucciones_tecnico: '',
    riesgos_precauciones: '',
    resultado_esperado: '',
    prioridad: 'media',
    assigned_to: '',
    fecha_prevista: '',
    fecha_limite: '',
    duracion_estimada_minutos: '',
    configuracion: defaultRequirementsForType(tipo)
  };
}

export default function WorkOrders() {
  const { activeTenantId } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(buildInitialForm);

  async function refresh() {
    if (!activeTenantId) return;
    const [workOrders, tenantMembers] = await Promise.all([
      listWorkOrders(activeTenantId),
      listTenantMembers(activeTenantId)
    ]);
    setRows(workOrders);
    setMembers(tenantMembers);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [activeTenantId]);

  const technicians = useMemo(
    () => members.filter((member) => ['admin_cliente', 'tecnico', 'tecnico_externo'].includes(member.role) && member.estado !== 'inactivo'),
    [members]
  );

  const filteredLocations = useMemo(
    () => locations.filter((location) => !form.instalacion_id || location.instalacion_id === form.instalacion_id),
    [locations, form.instalacion_id]
  );

  const filteredAssets = useMemo(
    () => assets.filter((asset) => {
      if (form.ubicacion_id) return asset.ubicacion_id === form.ubicacion_id;
      if (form.instalacion_id) return asset.instalacion_id === form.instalacion_id;
      return true;
    }),
    [assets, form.instalacion_id, form.ubicacion_id]
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateType(value) {
    setForm((current) => ({
      ...current,
      tipo: value,
      tipo_ot: value,
      configuracion: {
        ...defaultRequirementsForType(value),
        ...Object.fromEntries(Object.entries(current.configuracion || {}).filter(([, enabled]) => enabled))
      }
    }));
  }

  function updateRequirement(field, checked) {
    setForm((current) => ({
      ...current,
      configuracion: {
        ...current.configuracion,
        [field]: checked
      }
    }));
  }

  async function submit(event, status) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, estado: status };
      const created = await createWorkOrder(activeTenantId, payload);
      if (payload.configuracion?.requiere_checklist) await ensureDefaultChecklist(created);
      setForm(buildInitialForm());
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ordenes de trabajo"
        subtitle="Crea OT configurables para presupuesto, diagnostico, reparacion, instalacion, mantenimiento u otras actuaciones."
        action={<div className="quick-actions"><Link className="secondary-button" to="/ots-dashboard">Dashboard OT</Link><button className="primary-button" onClick={() => setOpen(true)}>Nueva OT</button></div>}
      />
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link className="active" to="/ots">Todas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}
      <DataTable
        columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'tipo_ot', label: 'Tipo', render: (row) => WORK_ORDER_TYPE_LABELS[row.tipo_ot || row.tipo] || row.tipo || '-' },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'assigned_to', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin asignar' },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${row.prioridad === 'urgente' ? 'danger' : row.prioridad === 'alta' ? 'warn' : ''}`}>{row.prioridad}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' }
        ]}
        rows={rows}
        empty="Sin ordenes de trabajo creadas"
      />

      <Modal title="Nueva orden de trabajo configurable" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid workorder-form" onSubmit={(event) => submit(event, 'ASIGNADA')}>
          <section className="form-section">
            <h2 className="section-heading">1. Destino</h2>
            <div className="grid two">
              <FormField label="Instalacion obligatoria">
                <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required>
                  <option value="">Seleccionar</option>
                  {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Ubicacion opcional">
                <select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}>
                  <option value="">Sin ubicacion concreta</option>
                  {filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Activo principal opcional">
                <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)}>
                  <option value="">Sin activo concreto</option>
                  {filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Activos relacionados">
                <select
                  multiple
                  value={form.activos_relacionados}
                  onChange={(event) => updateField('activos_relacionados', Array.from(event.target.selectedOptions).map((option) => option.value))}
                >
                  {filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </FormField>
            </div>
          </section>

          <section className="form-section">
            <h2 className="section-heading">2. Trabajo</h2>
            <div className="grid two">
              <FormField label="Titulo">
                <input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} placeholder="Ej. Visita para presupuesto de bomba" required />
              </FormField>
              <FormField label="Tipo de OT">
                <select value={form.tipo_ot} onChange={(event) => updateType(event.target.value)}>
                  {WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type]}</option>)}
                </select>
              </FormField>
              {form.tipo_ot === 'otro' && (
                <FormField label="Descripcion de otro tipo">
                  <input value={form.tipo_ot_detalle} onChange={(event) => updateField('tipo_ot_detalle', event.target.value)} required />
                </FormField>
              )}
              <FormField label="Prioridad">
                <select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>
                  {WORK_ORDER_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </FormField>
              <FormField label="Fecha prevista">
                <input type="datetime-local" value={form.fecha_prevista} onChange={(event) => updateField('fecha_prevista', event.target.value)} />
              </FormField>
              <FormField label="Fecha limite">
                <input type="datetime-local" value={form.fecha_limite} onChange={(event) => updateField('fecha_limite', event.target.value)} />
              </FormField>
              <FormField label="Duracion estimada (min)">
                <input type="number" min="0" value={form.duracion_estimada_minutos} onChange={(event) => updateField('duracion_estimada_minutos', event.target.value)} />
              </FormField>
            </div>
            <FormField label="Descripcion">
              <textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} />
            </FormField>
            <FormField label="Sintomas o situacion comunicada">
              <textarea rows="2" value={form.sintomas} onChange={(event) => updateField('sintomas', event.target.value)} />
            </FormField>
            <FormField label="Trabajo solicitado">
              <textarea rows="2" value={form.trabajo_solicitado} onChange={(event) => updateField('trabajo_solicitado', event.target.value)} />
            </FormField>
            <FormField label="Instrucciones para el tecnico">
              <textarea rows="2" value={form.instrucciones_tecnico} onChange={(event) => updateField('instrucciones_tecnico', event.target.value)} />
            </FormField>
            <FormField label="Riesgos o precauciones">
              <textarea rows="2" value={form.riesgos_precauciones} onChange={(event) => updateField('riesgos_precauciones', event.target.value)} />
            </FormField>
            <FormField label="Resultado esperado">
              <textarea rows="2" value={form.resultado_esperado} onChange={(event) => updateField('resultado_esperado', event.target.value)} />
            </FormField>
          </section>

          <section className="form-section">
            <h2 className="section-heading">3. Asignacion</h2>
            <FormField label="Tecnico principal">
              <select value={form.assigned_to} onChange={(event) => updateField('assigned_to', event.target.value)}>
                <option value="">Sin asignar</option>
                {technicians.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.nombre || member.profiles?.email || member.user_id}</option>)}
              </select>
            </FormField>
          </section>

          <section className="form-section">
            <h2 className="section-heading">4. Requisitos de cierre</h2>
            <div className="requirement-grid">
              {REQUIREMENT_FIELDS.map(([field, label]) => (
                <label className="checkbox-row" key={field}>
                  <input type="checkbox" checked={Boolean(form.configuracion[field])} onChange={(event) => updateRequirement(field, event.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="secondary-button" type="button" disabled={saving} onClick={(event) => submit(event, 'BORRADOR')}>Guardar borrador</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Asignar y enviar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
