import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderStatusOverview from '../components/WorkOrders/WorkOrderStatusOverview';
import WorkOrderThumbnail from '../components/WorkOrders/WorkOrderThumbnail';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createWorkOrder, defaultRequirementsForType, ensureDefaultChecklist, listWorkOrders, REQUIREMENT_FIELDS } from '../services/workOrderService';
import { softDeleteWorkOrder } from '../services/workOrderDeleteService';
import { listTenantMembers } from '../services/tenantService';
import { formatDateTime } from '../utils/dateUtils';
import {
  OFFICIAL_WORK_ORDER_PRIORITIES,
  OFFICIAL_WORK_ORDER_TYPES,
  priorityLabel,
  priorityTone,
  workOrderTypeLabel
} from '../utils/workOrderLifecycle';
import { ClipboardCheck, Filter, Wrench } from 'lucide-react';

const REQUIREMENT_TYPE_MAP = {
  correctiva: 'mantenimiento_correctivo',
  preventiva: 'mantenimiento_preventivo',
  conductiva: 'revision',
  inspeccion: 'inspeccion',
  revision_legal: 'inspeccion',
  mejora: 'instalacion',
  aviso_cliente: 'diagnostico',
  otro: 'otro'
};

function requirementsForType(type) {
  return defaultRequirementsForType(REQUIREMENT_TYPE_MAP[type] || type);
}

function buildInitialForm(activeInstallationId = '') {
  const tipo = 'preventiva';
  return {
    instalacion_id: activeInstallationId || '',
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
    prioridad: 'normal',
    assigned_to: '',
    fecha_prevista: '',
    fecha_limite: '',
    duracion_estimada_minutos: '',
    configuracion: requirementsForType(tipo)
  };
}

export default function WorkOrders() {
  const { activeTenantId, activeInstallationId, activeInstallation } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [form, setForm] = useState(() => buildInitialForm(activeInstallationId));
  const [filters, setFilters] = useState({ search: '', status: 'todos', priority: 'todas', type: 'todos' });

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

  useEffect(() => {
    if (!open) setForm(buildInitialForm(activeInstallationId));
  }, [activeInstallationId, open]);

  const technicians = useMemo(
    () => members.filter((member) => ['tecnico', 'tecnico_externo'].includes(member.role) && member.estado === 'activo' && member.user_id),
    [members]
  );

  const technicianOptions = useMemo(() => {
    const byUserId = new Map();
    technicians.forEach((member) => {
      byUserId.set(member.user_id, {
        id: member.user_id,
        label: member.profiles?.nombre || member.profiles?.email || member.user_id
      });
    });
    return Array.from(byUserId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [technicians]);

  const visibleInstallations = useMemo(
    () => activeInstallationId ? installations.filter((item) => item.id === activeInstallationId) : installations,
    [installations, activeInstallationId]
  );

  const visibleRows = useMemo(
    () => activeInstallationId ? rows.filter((row) => row.instalacion_id === activeInstallationId) : rows,
    [rows, activeInstallationId]
  );

  const filteredLocations = useMemo(() => {
    const installationId = form.instalacion_id || activeInstallationId;
    return locations.filter((location) => !installationId || location.instalacion_id === installationId);
  }, [locations, form.instalacion_id, activeInstallationId]);

  const filteredAssets = useMemo(
    () => assets.filter((asset) => {
      if (form.ubicacion_id) return asset.ubicacion_id === form.ubicacion_id;
      const installationId = form.instalacion_id || activeInstallationId;
      if (installationId) return asset.instalacion_id === installationId;
      return true;
    }),
    [assets, form.instalacion_id, form.ubicacion_id, activeInstallationId]
  );

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return visibleRows.filter((row) => {
      const searchable = `${row.codigo_ot || ''} ${row.titulo || ''} ${row.instalaciones?.nombre || ''} ${row.assigned?.nombre || ''} ${row.assigned?.email || ''}`.toLowerCase();
      const matchText = !text || searchable.includes(text);
      const matchStatus = filters.status === 'todos' || row.estado === filters.status;
      const matchPriority = filters.priority === 'todas' || row.prioridad === filters.priority;
      const matchType = filters.type === 'todos' || (row.tipo_ot || row.tipo) === filters.type;
      return matchText && matchStatus && matchPriority && matchType;
    });
  }, [visibleRows, filters]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'instalacion_id') {
        next.ubicacion_id = '';
        next.activo_id = '';
        next.activos_relacionados = [];
      }
      if (field === 'ubicacion_id') {
        next.activo_id = '';
        next.activos_relacionados = [];
      }
      return next;
    });
  }

  function updateType(value) {
    setForm((current) => ({
      ...current,
      tipo: value,
      tipo_ot: value,
      configuracion: {
        ...requirementsForType(value),
        ...Object.fromEntries(Object.entries(current.configuracion || {}).filter(([, enabled]) => enabled))
      }
    }));
  }

  function updateRequirement(field, checked) {
    setForm((current) => ({ ...current, configuracion: { ...current.configuracion, [field]: checked } }));
  }

  function openCreate() {
    setForm(buildInitialForm(activeInstallationId));
    setError('');
    setMessage('');
    setOpen(true);
  }

  async function submit(event, status) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const finalStatus = status || (form.assigned_to ? 'ASIGNADA' : 'NUEVA');
      const payload = { ...form, instalacion_id: form.instalacion_id || activeInstallationId, estado: finalStatus };
      const created = await createWorkOrder(activeTenantId, payload);
      if (payload.configuracion?.requiere_checklist) await ensureDefaultChecklist(created);
      setForm(buildInitialForm(activeInstallationId));
      setOpen(false);
      await refresh();
      setMessage(finalStatus === 'BORRADOR' ? 'Borrador de OT guardado.' : 'OT creada correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(row) {
    const label = row.codigo_ot || row.titulo || row.id.slice(0, 8);
    if (!window.confirm(`Vas a cancelar/borrar logicamente la OT ${label}. Quedara registrada en auditoria. ¿Continuar?`)) return;
    setError('');
    setMessage('');
    setDeletingId(row.id);
    try {
      await softDeleteWorkOrder(row);
      await refresh();
      setMessage(`OT ${label} cancelada correctamente.`);
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
        subtitle={activeInstallation ? `Mostrando OT de ${activeInstallation.nombre}.` : 'Crea OT con ciclo profesional: nueva, asignada, en curso, pendientes, finalizada y validada.'}
        action={<div className="quick-actions"><Link className="secondary-button" to="/ots-dashboard">Dashboard OT</Link><button className="primary-button" onClick={openCreate}>Nueva OT</button></div>}
      />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeInstallation.nombre}</p>}
      <div className="tabs workorder-tabs">
        <Link to="/ots-dashboard">Dashboard</Link>
        <Link className="active" to="/ots">Todas</Link>
        <Link to="/ots-realizadas">OT realizadas</Link>
        <Link to="/mis-ots">OT asignadas</Link>
        <Link to="/ots-creadas">Creadas por mi</Link>
      </div>
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <WorkOrderStatusOverview
        orders={visibleRows}
        activeStatus={filters.status === 'todos' ? '' : filters.status}
        onSelectStatus={(status) => setFilters((current) => ({ ...current, status }))}
      />

      <CollapsibleSection title="Filtros OT" subtitle="Busca por OT, trabajo, instalacion o tecnico" icon={Filter} badge={`${filteredRows.length}/${visibleRows.length}`} defaultOpen>
        <div className="user-filter-grid">
          <label><span>Buscar</span><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Codigo, titulo, instalacion o tecnico" /></label>
          <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="todos">Todos</option>{['BORRADOR', 'NUEVA', 'ASIGNADA', 'EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'FINALIZADA', 'VALIDADA', 'CANCELADA'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label><span>Prioridad</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="todas">Todas</option>{OFFICIAL_WORK_ORDER_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}</select></label>
          <label><span>Tipo</span><select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="todos">Todos</option>{OFFICIAL_WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{workOrderTypeLabel(type)}</option>)}</select></label>
        </div>
        <div className="quick-actions user-filter-actions"><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, status: 'EN_CURSO' }))}>En curso</button><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, priority: 'urgente' }))}>Urgentes</button><button className="ghost-button" type="button" onClick={() => setFilters({ search: '', status: 'todos', priority: 'todas', type: 'todos' })}>Limpiar</button></div>
      </CollapsibleSection>

      <DataTable
        columns={[
          { key: 'foto', label: 'Foto', render: (row) => <WorkOrderThumbnail row={row} /> },
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'tipo_ot', label: 'Tipo', render: (row) => workOrderTypeLabel(row.tipo_ot || row.tipo) },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'assigned_to', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin asignar' },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad)}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' },
          { key: 'actions', label: 'Acciones', render: (row) => <div className="quick-actions"><Link className="secondary-button" to={`/ots/${row.id}`}>Ver</Link><button className="danger-button" type="button" disabled={deletingId === row.id} onClick={() => deleteOrder(row)}>{deletingId === row.id ? 'Borrando...' : 'Cancelar'}</button></div> }
        ]}
        rows={filteredRows}
        empty="Sin ordenes de trabajo para la instalación activa"
      />

      <Modal title="Nueva orden de trabajo" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid workorder-form" onSubmit={(event) => submit(event)}>
          <CollapsibleSection title="1. Destino" subtitle="Instalacion, ubicacion y activo" icon={ClipboardCheck} defaultOpen>
            <div className="grid two">
              <FormField label="Instalacion obligatoria"><select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required disabled={Boolean(activeInstallationId)}><option value="">Seleccionar</option>{visibleInstallations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
              <FormField label="Ubicacion opcional"><select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}><option value="">Sin ubicacion concreta</option>{filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
              <FormField label="Activo principal opcional"><select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)}><option value="">Sin activo concreto</option>{filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
              <FormField label="Activos relacionados"><select multiple value={form.activos_relacionados} onChange={(event) => updateField('activos_relacionados', Array.from(event.target.selectedOptions).map((option) => option.value))}>{filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="2. Trabajo" subtitle="Tipo, prioridad, fechas y descripcion" icon={Wrench} defaultOpen>
            <div className="grid two">
              <FormField label="Titulo"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} placeholder="Ej. Revision preventiva de bomba" required /></FormField>
              <FormField label="Tipo de OT"><select value={form.tipo_ot} onChange={(event) => updateType(event.target.value)}>{OFFICIAL_WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{workOrderTypeLabel(type)}</option>)}</select></FormField>
              {form.tipo_ot === 'otro' && <FormField label="Descripcion de otro tipo"><input value={form.tipo_ot_detalle} onChange={(event) => updateField('tipo_ot_detalle', event.target.value)} required /></FormField>}
              <FormField label="Prioridad"><select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>{OFFICIAL_WORK_ORDER_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}</select></FormField>
              <FormField label="Fecha prevista"><input type="datetime-local" value={form.fecha_prevista} onChange={(event) => updateField('fecha_prevista', event.target.value)} /></FormField>
              <FormField label="Fecha limite"><input type="datetime-local" value={form.fecha_limite} onChange={(event) => updateField('fecha_limite', event.target.value)} /></FormField>
              <FormField label="Duracion estimada (min)"><input type="number" min="0" value={form.duracion_estimada_minutos} onChange={(event) => updateField('duracion_estimada_minutos', event.target.value)} /></FormField>
            </div>
            <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
            <FormField label="Sintomas o situacion comunicada"><textarea rows="2" value={form.sintomas} onChange={(event) => updateField('sintomas', event.target.value)} /></FormField>
            <FormField label="Trabajo solicitado"><textarea rows="2" value={form.trabajo_solicitado} onChange={(event) => updateField('trabajo_solicitado', event.target.value)} /></FormField>
            <FormField label="Instrucciones para el tecnico"><textarea rows="2" value={form.instrucciones_tecnico} onChange={(event) => updateField('instrucciones_tecnico', event.target.value)} /></FormField>
            <FormField label="Riesgos o precauciones"><textarea rows="2" value={form.riesgos_precauciones} onChange={(event) => updateField('riesgos_precauciones', event.target.value)} /></FormField>
            <FormField label="Resultado esperado"><textarea rows="2" value={form.resultado_esperado} onChange={(event) => updateField('resultado_esperado', event.target.value)} /></FormField>
          </CollapsibleSection>

          <CollapsibleSection title="3. Asignacion" subtitle="Tecnico propio o externo" icon={Wrench} defaultOpen>
            <FormField label="Tecnico principal"><select value={form.assigned_to} onChange={(event) => updateField('assigned_to', event.target.value)}><option value="">Sin asignar</option>{technicianOptions.length > 0 && <optgroup label="Tecnicos activos">{technicianOptions.map((technician) => <option key={technician.id} value={technician.id}>{technician.label}</option>)}</optgroup>}</select></FormField>
            {technicianOptions.length === 0 && <p className="warning-text">No hay tecnicos activos. Crea o activa un usuario con rol tecnico desde Usuarios y permisos.</p>}
          </CollapsibleSection>

          <CollapsibleSection title="4. Requisitos de cierre" subtitle="Obligaciones para finalizar e informar" icon={ClipboardCheck} defaultOpen={false}>
            <div className="requirement-grid">{REQUIREMENT_FIELDS.map(([field, label]) => <label className="checkbox-row" key={field}><input type="checkbox" checked={Boolean(form.configuracion[field])} onChange={(event) => updateRequirement(field, event.target.checked)} /><span>{label}</span></label>)}</div>
          </CollapsibleSection>

          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="secondary-button" type="button" disabled={saving} onClick={(event) => submit(event, 'BORRADOR')}>Guardar borrador</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : form.assigned_to ? 'Crear y asignar' : 'Crear como nueva'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
