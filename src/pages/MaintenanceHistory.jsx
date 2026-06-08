import { useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDate } from '../utils/dateUtils';
import { createMaintenanceEntry, softDeleteEntity } from '../services/entityService';

const MAINTENANCE_TYPES = ['preventivo', 'correctivo', 'revision', 'sustitucion', 'incidencia', 'otro'];

export default function MaintenanceHistory() {
  const { rows, activeTenantId, refresh } = useTenantRows('historial_mantenimiento', '*, activos(nombre)', { order: 'fecha' });
  const { rows: assets } = useTenantRows('activos', 'id,nombre', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    activo_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'revision',
    titulo: '',
    descripcion: '',
    estado_final: '',
    proxima_accion: ''
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await createMaintenanceEntry(activeTenantId, form);
      setForm({ activo_id: '', fecha: new Date().toISOString().slice(0, 10), tipo: 'revision', titulo: '', descripcion: '', estado_final: '', proxima_accion: '' });
      setOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el registro "${row.titulo}"?`)) return;
    await softDeleteEntity({ table: 'historial_mantenimiento', tenantId: row.tenant_id, id: row.id, entityType: 'historial_mantenimiento', auditAction: 'delete_maintenance' });
    refresh();
  }

  return (
    <>
      <PageHeader title="Historial de mantenimiento" subtitle="Preventivos, correctivos, revisiones y sustituciones." action={<button className="primary-button" onClick={() => setOpen(true)}>Nuevo registro</button>} />
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha) },
        { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
        { key: 'tipo', label: 'Tipo' },
        { key: 'titulo', label: 'Titulo' },
        { key: 'estado_final', label: 'Estado final' },
        { key: 'actions', label: 'Acciones', render: (row) => <button className="danger-button" onClick={() => remove(row)}>Baja</button> }
      ]} rows={rows} />
      <Modal title="Nuevo registro de mantenimiento" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Activo">
            <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.nombre}</option>)}
            </select>
          </FormField>
          <div className="grid two">
            <FormField label="Fecha"><input type="date" value={form.fecha} onChange={(event) => updateField('fecha', event.target.value)} required /></FormField>
            <FormField label="Tipo">
              <select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)}>
                {MAINTENANCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Titulo"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <div className="grid two">
            <FormField label="Estado final"><input value={form.estado_final} onChange={(event) => updateField('estado_final', event.target.value)} /></FormField>
            <FormField label="Proxima accion"><input value={form.proxima_accion} onChange={(event) => updateField('proxima_accion', event.target.value)} /></FormField>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Crear registro</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
