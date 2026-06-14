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
import { softDeleteWorkOrder } from '../services/workOrderDeleteService';
import { listTenantMembers } from '../services/tenantService';
import { listTenantInvitations } from '../services/permissionService';
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
  const [invitations, setInvitations] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [form, setForm] = useState(buildInitialForm);

  async function refresh() {
    if (!activeTenantId) return;
    const [workOrders, tenantMembers, tenantInvitations] = await Promise.all([
      listWorkOrders(activeTenantId),
      listTenantMembers(activeTenantId),
      listTenantInvitations(activeTenantId)
    ]);
    setRows(workOrders);
    setMembers(tenantMembers);
    setInvitations(tenantInvitations);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [activeTenantId]);

  const technicians = useMemo(
    () => members.filter((member) => ['admin_cliente', 'tecnico', 'tecnico_externo'].includes(member.role) && member.estado !== 'inactivo'),
    [members]
  );

  const technicianOptions = useMemo(() => {
    const byUserId = new Map();
    technicians.forEach((member) => {
      byUserId.set(member.user_id, {
        id: member.user_id,
        label: member.profiles?.nombre || member.profiles?.email || member.user_id,
        source: 'member'
      });
    });
    invitations
      .filter((invitation) => ['tecnico', 'tecnico_externo'].includes(invitation.role) && invitation.estado === 'aceptada' && invitation.accepted_by)
      .forEach((invitation) => {
        if (!byUserId.has(invitation.accepted_by)) {
          byUserId.set(invitation.accepted_by, {
            id: invitation.accepted_by,
            label: invitation.nombre || invitation.email || invitation.accepted_by,
            source: 'invitation'
          });
        }
      });
    return Array.from(byUserId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [technicians, invitations]);

  const pendingTechnicianInvitations = useMemo(
    () => invitations.filter((invitation) => ['tecnico', 'tecnico_externo'].includes(invitation.role) && invitation.estado === 'pendiente'),
    [invitations]
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
    setMessage('');
    setSaving(true);
    try {
      const payload = { ...form, estado: status };
      const created = await createWorkOrder(activeTenantId, payload);
      if (payload.configuracion?.requiere_checklist) await ensureDefaultChecklist(created);
      setForm(buildInitialForm());
      setOpen(false);
      await refresh();
      setMessage('OT creada correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(row) {
    const label = row.codigo_ot || row.titulo || row.id.slice(0, 8);
    const confirmed = window.confirm(`Vas a borrar la OT ${label}. Se ocultara del listado, pero quedara registrada en auditoria. ¿Continuar?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingId(row.id);
    try {
      await softDeleteWorkOrder(row);
      await refresh();
      setMessage(`OT ${label} borrada correctamente.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
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
      {message && <p className="success-text">{message}</p>}
      <DataTable
        columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'tipo_ot', label: 'Tipo', render: (row) => WORK_ORDER_TYPE_LABELS[row.tipo_ot || row.tipo] || row.tipo || '-' },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'assigned_to', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin asignar' },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${row.prioridad === 'urgente' ? 'danger' : row.prioridad === 'alta' ? 'warn' : ''}`}>{row.prioridad}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
          {
            key: 'actions',
            label: 'Acciones',
            render: (row) => (
              <div className="quick-actions">
                <Link className="secondary-button" to={`/ots/${row.id}`}>Ver</Link>
                <button className="danger-button" type="button" disabled={deletingId === row.id} onClick={() => deleteOrder(row)}>
                  {deletingId === row.id ? 'Borrando...' : 'Borrar'}
                </button>
              </div>
            )
          }
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
                {technicianOptions.length > 0 && (
                  <optgroup label="Tecnicos activos">
                    {technicianOptions.map((technician) => <option key={technician.id} value={technician.id}>{technician.label}</option>)}
                  </optgroup>
                )}
                {pendingTechnicianInvitations.length > 0 && (
                  <optgroup label="Invitaciones pendientes">
                    {pendingTechnicianInvitations.map((invitation) => (
                      <option key={invitation.id} value="" disabled>
                        {(invitation.nombre || invitation.email)} - pendiente de aceptar
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FormField>
            {technicianOptions.length === 0 && pendingTechnicianInvitations.length === 0 && (
              <p className="warning-text">No hay tecnicos activos ni invitaciones pendientes. Crea una invitacion desde Usuarios y permisos.</p>
            )}
            {pendingTechnicianInvitations.length > 0 && (
              <p className="muted">Las invitaciones pendientes apareceran como tecnicos asignables cuando el usuario acepte el enlace y complete el alta.</p>
            )}
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
