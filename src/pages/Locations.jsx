import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { createLocation, softDeleteEntity, updateLocation } from '../services/entityService';
import EntityIdentity from '../components/Cards/EntityIdentity';
import { usePermissions } from '../hooks/usePermissions';

export default function Locations() {
  const { rows, activeTenantId, refresh } = useTenantRows('ubicaciones', '*, instalaciones(nombre)', { order: 'created_at' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const emptyForm = { instalacion_id: '', nombre: '', tipo: '', planta: '', zona: '', descripcion: '', image_file: null };
  const [form, setForm] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const permissions = usePermissions(activeTenantId);

  useEffect(() => {
    permissions.canManageTenant().then(setCanManage).catch(() => setCanManage(false));
  }, [permissions]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    try {
      if (editingRow) {
        await updateLocation(editingRow, form);
      } else {
        await createLocation(activeTenantId, form);
      }
      setForm(emptyForm);
      setEditingRow(null);
      formElement.reset();
      setOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja la ubicacion "${row.nombre}"?`)) return;
    await softDeleteEntity({ table: 'ubicaciones', tenantId: row.tenant_id, id: row.id, entityType: 'ubicacion', auditAction: 'delete_location' });
    refresh();
  }

  function startCreate() {
    setEditingRow(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm({
      instalacion_id: row.instalacion_id || '',
      nombre: row.nombre || '',
      tipo: row.tipo || '',
      planta: row.planta || '',
      zona: row.zona || '',
      descripcion: row.descripcion || '',
      image_file: null
    });
    setError('');
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingRow(null);
    setForm(emptyForm);
    setError('');
  }

  return (
    <>
      <PageHeader title="Ubicaciones" subtitle="Paso intermedio: cada ubicacion pertenece a una instalacion y agrupa sus activos." action={canManage ? <button className="primary-button" onClick={startCreate}>Nueva ubicacion</button> : null} />
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'nombre', label: 'Ubicacion', render: (row) => <Link to={`/ubicaciones/${row.id}`}><EntityIdentity row={row} entityType="ubicacion" title={row.nombre} subtitle={row.tipo || row.zona} /></Link> },
        { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre },
        { key: 'planta', label: 'Planta' },
        { key: 'zona', label: 'Zona' },
        { key: 'actions', label: 'Acciones', render: (row) => canManage ? (
          <div className="inline-actions">
            <button className="secondary-button" onClick={() => startEdit(row)}>Editar</button>
            <button className="danger-button" onClick={() => remove(row)}>Baja</button>
          </div>
        ) : <span className="muted">Solo lectura</span> }
      ]} rows={rows} />
      <Modal title={editingRow ? 'Editar ubicacion' : 'Nueva ubicacion'} open={open} onClose={closeModal}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Instalacion">
            <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Nombre"><input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required /></FormField>
          <div className="grid two">
            <FormField label="Tipo"><input value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} placeholder="Sala tecnica, cuarto, zona..." /></FormField>
            <FormField label="Planta"><input value={form.planta} onChange={(event) => updateField('planta', event.target.value)} /></FormField>
          </div>
          <FormField label="Zona"><input value={form.zona} onChange={(event) => updateField('zona', event.target.value)} /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <FormField label="Imagen de la ubicacion">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateField('image_file', event.target.files?.[0] || null)} />
          </FormField>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal}>Cancelar</button>
            <button className="primary-button" type="submit">{editingRow ? 'Guardar cambios' : 'Crear ubicacion'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
