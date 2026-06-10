import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createWorkOrder, listWorkOrders, WORK_ORDER_PRIORITIES, WORK_ORDER_TYPES } from '../services/workOrderService';
import { listTenantMembers } from '../services/tenantService';
import { formatDateTime } from '../utils/dateUtils';

const initialForm = {
  instalacion_id: '',
  ubicacion_id: '',
  activo_id: '',
  titulo: '',
  descripcion: '',
  tipo: 'mantenimiento',
  prioridad: 'media',
  estado: 'ASIGNADA',
  assigned_to: '',
  fecha_prevista: ''
};

export default function WorkOrders() {
  const { activeTenantId } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);

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

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await createWorkOrder(activeTenantId, form);
      setForm(initialForm);
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Ordenes de trabajo"
        subtitle="Crea, asigna y sigue las OT de mantenimiento vinculadas a instalaciones, ubicaciones, activos y QR."
        action={<button className="primary-button" onClick={() => setOpen(true)}>Nueva OT</button>}
      />
      {error && <p className="error-text">{error}</p>}
      <DataTable
        columns={[
          { key: 'codigo_ot', label: 'OT', render: (row) => <Link to={`/ots/${row.id}`}>{row.codigo_ot || row.id.slice(0, 8)}</Link> },
          { key: 'titulo', label: 'Trabajo' },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
          { key: 'assigned_to', label: 'Tecnico', render: (row) => row.assigned?.nombre || row.assigned?.email || 'Sin asignar' },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${row.prioridad === 'urgente' ? 'danger' : row.prioridad === 'alta' ? 'warn' : ''}`}>{row.prioridad}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <WorkOrderStatusBadge status={row.estado} /> },
          { key: 'fecha_prevista', label: 'Prevista', render: (row) => row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-' }
        ]}
        rows={rows}
        empty="Sin ordenes de trabajo creadas"
      />

      <Modal title="Nueva orden de trabajo" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Instalacion">
            <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Ubicacion">
            <select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}>
              <option value="">Sin ubicacion concreta</option>
              {filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Activo">
            <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)}>
              <option value="">Sin activo concreto</option>
              {filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Titulo del trabajo">
            <input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} placeholder="Ej. Revision bomba ACS" required />
          </FormField>
          <FormField label="Tipo">
            <select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)}>
              {WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </FormField>
          <FormField label="Prioridad">
            <select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>
              {WORK_ORDER_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </FormField>
          <FormField label="Tecnico asignado">
            <select value={form.assigned_to} onChange={(event) => updateField('assigned_to', event.target.value)}>
              <option value="">Sin asignar</option>
              {technicians.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.nombre || member.profiles?.email || member.user_id}</option>)}
            </select>
          </FormField>
          <FormField label="Fecha prevista">
            <input type="datetime-local" value={form.fecha_prevista} onChange={(event) => updateField('fecha_prevista', event.target.value)} />
          </FormField>
          <FormField label="Descripcion">
            <textarea rows="4" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} placeholder="Describe el trabajo, sintomas, materiales previstos o instrucciones para el tecnico" />
          </FormField>
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Crear OT</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
