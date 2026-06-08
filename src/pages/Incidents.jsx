import { useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDateTime } from '../utils/dateUtils';
import { createIncident } from '../services/entityService';
import { supabase } from '../services/supabaseClient';
import { logAudit } from '../services/auditService';

export default function Incidents() {
  const { rows, activeTenantId, refresh } = useTenantRows('incidencias', '*, instalaciones(nombre), activos(nombre)', { order: 'fecha_apertura' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ instalacion_id: '', ubicacion_id: '', activo_id: '', titulo: '', descripcion: '', prioridad: 'media' });

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
      await createIncident(activeTenantId, form);
      setForm({ instalacion_id: '', ubicacion_id: '', activo_id: '', titulo: '', descripcion: '', prioridad: 'media' });
      setOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeIncident(row) {
    const { error: updateError } = await supabase
      .from('incidencias')
      .update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await logAudit({ tenantId: row.tenant_id, action: 'close_incident', entityType: 'incidencia', entityId: row.id });
    refresh();
  }

  return (
    <>
      <PageHeader title="Incidencias" subtitle="Seguimiento de incidencias con prioridad, asignacion y cierre." action={<button className="primary-button" onClick={() => setOpen(true)}>Nueva incidencia</button>} />
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'titulo', label: 'Titulo' },
        { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${row.prioridad === 'urgente' ? 'danger' : 'warn'}`}>{row.prioridad}</span> },
        { key: 'estado', label: 'Estado' },
        { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
        { key: 'fecha_apertura', label: 'Apertura', render: (row) => formatDateTime(row.fecha_apertura) },
        { key: 'actions', label: 'Acciones', render: (row) => row.estado !== 'cerrada' ? <button className="secondary-button" onClick={() => closeIncident(row)}>Cerrar</button> : <span className="badge ok">Cerrada</span> }
      ]} rows={rows} />
      <Modal title="Nueva incidencia" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Instalacion">
            <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Ubicacion">
            <select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}>
              <option value="">Sin ubicacion</option>
              {filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Activo">
            <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)}>
              <option value="">Sin activo concreto</option>
              {filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Titulo"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
          <FormField label="Prioridad">
            <select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </FormField>
          <FormField label="Descripcion"><textarea rows="4" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Crear incidencia</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
