import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDate } from '../utils/dateUtils';
import { createAsset, softDeleteEntity, updateAsset } from '../services/entityService';
import { usePermissions } from '../hooks/usePermissions';
import EntityIdentity from '../components/Cards/EntityIdentity';

export default function Assets() {
  const { rows, activeTenantId, refresh } = useTenantRows('activos', '*, instalaciones(nombre), ubicaciones(nombre)', { order: 'created_at' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const emptyForm = {
    instalacion_id: '',
    ubicacion_id: '',
    nombre: '',
    tipo: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    referencia: '',
    estado: 'correcto',
    criticidad: 'media',
    fecha_instalacion: '',
    fecha_ultima_revision: '',
    fecha_proxima_revision: '',
    observaciones: '',
    image_file: null
  };
  const [form, setForm] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const permissions = usePermissions(activeTenantId);

  useEffect(() => {
    permissions.canManageTenant().then(setCanManage).catch(() => setCanManage(false));
  }, [permissions]);

  const filteredLocations = useMemo(
    () => locations.filter((location) => !form.instalacion_id || location.instalacion_id === form.instalacion_id),
    [locations, form.instalacion_id]
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (editingRow) {
        await updateAsset(editingRow, form);
      } else {
        await createAsset(activeTenantId, form);
      }
      setForm(emptyForm);
      setEditingRow(null);
      formElement.reset();
      setOpen(false);
      refresh();
      setSuccess(editingRow ? 'Activo actualizado correctamente.' : 'Activo creado correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el activo "${row.nombre}"?`)) return;
    await softDeleteEntity({ table: 'activos', tenantId: row.tenant_id, id: row.id, entityType: 'activo', auditAction: 'delete_asset' });
    refresh();
  }

  function startCreate() {
    setEditingRow(null);
    setForm(emptyForm);
    setError('');
    setSuccess('');
    setOpen(true);
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm({
      instalacion_id: row.instalacion_id || '',
      ubicacion_id: row.ubicacion_id || '',
      nombre: row.nombre || '',
      tipo: row.tipo || '',
      marca: row.marca || '',
      modelo: row.modelo || '',
      numero_serie: row.numero_serie || '',
      referencia: row.referencia || '',
      estado: row.estado || 'correcto',
      criticidad: row.criticidad || 'media',
      fecha_instalacion: row.fecha_instalacion || '',
      fecha_ultima_revision: row.fecha_ultima_revision || '',
      fecha_proxima_revision: row.fecha_proxima_revision || '',
      observaciones: row.observaciones || '',
      image_file: null
    });
    setError('');
    setSuccess('');
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setEditingRow(null);
    setForm(emptyForm);
    setError('');
  }

  return (
    <>
      <PageHeader title="Activos/equipos" subtitle="Ficha tecnica, estado, revisiones, documentos y QR por activo." action={canManage ? <button className="primary-button" onClick={startCreate}>Nuevo activo</button> : null} />
      {success && <p className="success-text">{success}</p>}
      <DataTable columns={[
        { key: 'nombre', label: 'Activo', render: (row) => <Link to={`/activos/${row.id}`}><EntityIdentity row={row} entityType="activo" title={row.nombre} subtitle={row.tipo || row.modelo} /></Link> },
        { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
        { key: 'ubicacion', label: 'Ubicacion', render: (row) => row.ubicaciones?.nombre || '-' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.estado === 'correcto' ? 'ok' : 'warn'}`}>{row.estado}</span> },
        { key: 'criticidad', label: 'Criticidad' },
        { key: 'fecha_proxima_revision', label: 'Proxima revision', render: (row) => formatDate(row.fecha_proxima_revision) },
        { key: 'actions', label: 'Acciones', render: (row) => canManage ? (
          <div className="inline-actions">
            <button className="secondary-button" onClick={() => startEdit(row)}>Editar</button>
            <button className="danger-button" onClick={() => remove(row)}>Baja</button>
          </div>
        ) : <span className="muted">Solo lectura</span> }
      ]} rows={rows} />
      <Modal title={editingRow ? 'Editar activo' : 'Nuevo activo'} open={open} onClose={closeModal}>
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
          <FormField label="Nombre"><input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required /></FormField>
          <div className="grid two">
            <FormField label="Tipo"><input value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} /></FormField>
            <FormField label="Criticidad">
              <select value={form.criticidad} onChange={(event) => updateField('criticidad', event.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Critica</option>
              </select>
            </FormField>
          </div>
          <div className="grid two">
            <FormField label="Marca"><input value={form.marca} onChange={(event) => updateField('marca', event.target.value)} /></FormField>
            <FormField label="Modelo"><input value={form.modelo} onChange={(event) => updateField('modelo', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Numero de serie"><input value={form.numero_serie} onChange={(event) => updateField('numero_serie', event.target.value)} /></FormField>
            <FormField label="Referencia"><input value={form.referencia} onChange={(event) => updateField('referencia', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Estado">
              <select value={form.estado} onChange={(event) => updateField('estado', event.target.value)}>
                <option value="correcto">Correcto</option>
                <option value="pendiente">Pendiente</option>
                <option value="averiado">Averiado</option>
                <option value="fuera_servicio">Fuera de servicio</option>
              </select>
            </FormField>
            <FormField label="Proxima revision"><input type="date" value={form.fecha_proxima_revision} onChange={(event) => updateField('fecha_proxima_revision', event.target.value)} /></FormField>
          </div>
          <FormField label="Observaciones"><textarea rows="3" value={form.observaciones} onChange={(event) => updateField('observaciones', event.target.value)} /></FormField>
          <FormField label="Foto del activo">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateField('image_file', event.target.files?.[0] || null)} disabled={saving} />
          </FormField>
          {saving && <p className="muted">Guardando activo y subiendo imagen. No cierres esta ventana.</p>}
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingRow ? 'Guardar cambios' : 'Crear activo'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
