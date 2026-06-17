import { Link } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createInstallation, softDeleteEntity, updateInstallation } from '../services/entityService';
import EntityImageViewer from '../components/Media/EntityImageViewer';
import { buildMapsUrl } from '../utils/mapUtils';

export default function Installations() {
  const { tenants, activeTenantId, setActiveTenantId } = useTenant();
  const { rows, refresh } = useTenantRows('instalaciones', '*, tenants(nombre)', { order: 'created_at' });
  const [open, setOpen] = useState(false);
  const emptyForm = { tenant_id: activeTenantId || '', nombre: '', codigo: '', tipo: '', direccion: '', latitud: '', longitud: '', maps_url: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', descripcion: '', image_file: null };
  const [form, setForm] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    try {
      if (editingRow) {
        await updateInstallation(editingRow, form);
      } else {
        await createInstallation(form.tenant_id || activeTenantId, form);
        if (form.tenant_id && form.tenant_id !== activeTenantId) {
          setActiveTenantId(form.tenant_id);
        }
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
    if (!window.confirm(`Dar de baja la instalacion "${row.nombre}"?`)) return;
    await softDeleteEntity({ table: 'instalaciones', tenantId: row.tenant_id, id: row.id, entityType: 'instalacion', auditAction: 'delete_installation' });
    refresh();
  }

  function startCreate() {
    setEditingRow(null);
    setForm({ ...emptyForm, tenant_id: activeTenantId || tenants[0]?.id || '' });
    setError('');
    setOpen(true);
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm({
      nombre: row.nombre || '',
      tenant_id: row.tenant_id || activeTenantId || '',
      codigo: row.codigo || '',
      tipo: row.tipo || '',
      direccion: row.direccion || '',
      latitud: row.latitud || '',
      longitud: row.longitud || '',
      maps_url: row.maps_url || '',
      contacto_nombre: row.contacto_nombre || '',
      contacto_telefono: row.contacto_telefono || '',
      contacto_email: row.contacto_email || '',
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

  function installationName(row) {
    return (
      <div className="installation-text-cell">
        <Link to={`/instalaciones/${row.id}`}><strong>{row.nombre}</strong></Link>
        <span>{row.direccion || row.tipo || 'Sin direccion'}</span>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Instalaciones" subtitle="Cada instalacion queda vinculada obligatoriamente a un cliente." action={<button className="primary-button" onClick={startCreate}>Nueva instalacion</button>} />
      <DataTable columns={[
        { key: 'foto', label: 'Foto', render: (row) => <EntityImageViewer row={row} entityType="instalacion" title={row.nombre} className="installation-main-photo" /> },
        { key: 'nombre', label: 'Nombre', render: installationName },
        { key: 'cliente', label: 'Cliente', render: (row) => row.tenants?.nombre || tenants.find((tenant) => tenant.id === row.tenant_id)?.nombre || row.tenant_id },
        { key: 'codigo', label: 'Codigo' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'mapa', label: 'Mapa', render: (row) => buildMapsUrl(row) ? <a className="secondary-button" href={buildMapsUrl(row)} target="_blank" rel="noreferrer">Abrir mapa</a> : <span className="muted">Sin mapa</span> },
        { key: 'estado', label: 'Estado', render: (row) => <span className="badge ok">{row.estado}</span> },
        {
          key: 'actions',
          label: 'Acciones',
          render: (row) => (
            <div className="inline-actions">
              <button className="secondary-button" onClick={() => startEdit(row)}>Editar</button>
              <button className="danger-button" onClick={() => remove(row)}>Baja</button>
            </div>
          )
        }
      ]} rows={rows} />
      <Modal title={editingRow ? 'Editar instalacion' : 'Nueva instalacion'} open={open} onClose={closeModal}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Cliente">
            <select value={form.tenant_id} onChange={(event) => updateField('tenant_id', event.target.value)} required disabled={Boolean(editingRow)}>
              <option value="">Selecciona cliente</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nombre}</option>)}
            </select>
          </FormField>
          {editingRow && <p className="muted">Para mover una instalacion a otro cliente conviene hacerlo como accion administrativa separada para no mezclar ubicaciones, activos, documentos y auditoria.</p>}
          <FormField label="Nombre"><input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required /></FormField>
          <FormField label="Codigo"><input value={form.codigo} onChange={(event) => updateField('codigo', event.target.value)} /></FormField>
          <FormField label="Tipo"><input value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} placeholder="Garaje, sala tecnica, fotovoltaica..." /></FormField>
          <FormField label="Direccion"><input value={form.direccion} onChange={(event) => updateField('direccion', event.target.value)} /></FormField>
          <div className="grid two">
            <FormField label="Latitud"><input type="number" step="any" value={form.latitud} onChange={(event) => updateField('latitud', event.target.value)} placeholder="40.416775" /></FormField>
            <FormField label="Longitud"><input type="number" step="any" value={form.longitud} onChange={(event) => updateField('longitud', event.target.value)} placeholder="-3.703790" /></FormField>
          </div>
          <FormField label="Enlace Google Maps opcional"><input value={form.maps_url} onChange={(event) => updateField('maps_url', event.target.value)} placeholder="https://maps.google.com/..." /></FormField>
          <div className="grid two">
            <FormField label="Contacto"><input value={form.contacto_nombre} onChange={(event) => updateField('contacto_nombre', event.target.value)} /></FormField>
            <FormField label="Telefono"><input value={form.contacto_telefono} onChange={(event) => updateField('contacto_telefono', event.target.value)} /></FormField>
          </div>
          <FormField label="Email contacto"><input type="email" value={form.contacto_email} onChange={(event) => updateField('contacto_email', event.target.value)} /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <FormField label="Logo o imagen de la instalacion">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateField('image_file', event.target.files?.[0] || null)} />
          </FormField>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal}>Cancelar</button>
            <button className="primary-button" type="submit">{editingRow ? 'Guardar cambios' : 'Crear instalacion'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
