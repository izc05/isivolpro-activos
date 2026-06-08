import { Edit, ExternalLink, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { createSignedUrl } from '../services/fileService';
import { createPhotoWithFile, softDeleteMedia, updatePhoto } from '../services/mediaService';

export default function Photos() {
  const { rows, activeTenantId, refresh } = useTenantRows('fotos', '*, instalaciones(nombre), ubicaciones(nombre), activos(nombre)', { order: 'created_at' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const emptyForm = { entity_type: 'activo', entity_id: '', titulo: '', descripcion: '', visibilidad: 'cliente', file: null };
  const [form, setForm] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);

  const entityOptions = useMemo(() => {
    if (form.entity_type === 'instalacion') return installations.map((item) => ({ id: item.id, label: item.nombre }));
    if (form.entity_type === 'ubicacion') return locations.map((item) => ({ id: item.id, label: item.nombre }));
    return assets.map((item) => ({ id: item.id, label: item.nombre }));
  }, [form.entity_type, installations, locations, assets]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'entity_type') next.entity_id = '';
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    if (!editingRow && !navigator.onLine) {
      setError('No se pueden subir fotos sin conexion.');
      return;
    }
    try {
      if (editingRow) {
        await updatePhoto(editingRow, form);
      } else {
        await createPhotoWithFile(activeTenantId, form);
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

  function entityFromRow(row) {
    if (row.activo_id) return { entity_type: 'activo', entity_id: row.activo_id };
    if (row.ubicacion_id) return { entity_type: 'ubicacion', entity_id: row.ubicacion_id };
    return { entity_type: 'instalacion', entity_id: row.instalacion_id || '' };
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
      ...entityFromRow(row),
      titulo: row.titulo || '',
      descripcion: row.descripcion || '',
      visibilidad: row.visibilidad || 'cliente',
      file: null
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

  async function openSigned(row) {
    const url = await createSignedUrl({ tenantId: row.tenant_id, bucket: row.bucket, path: row.storage_path, entityType: 'foto', entityId: row.id });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja la foto "${row.titulo || row.file_name}"?`)) return;
    await softDeleteMedia({ table: 'fotos', row, entityType: 'foto', auditAction: 'delete_photo' });
    refresh();
  }

  function entityLabel(row) {
    return row.activos?.nombre || row.ubicaciones?.nombre || row.instalaciones?.nombre || '-';
  }

  return (
    <>
      <PageHeader title="Fotos" subtitle="Imagenes tecnicas guardadas en bucket privado." action={<button className="primary-button" onClick={startCreate}><Upload size={18} /> Subir foto</button>} />
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'titulo', label: 'Titulo' },
        { key: 'entity', label: 'Asociada a', render: entityLabel },
        { key: 'visibilidad', label: 'Visibilidad', render: (row) => <span className="badge">{row.visibilidad || 'cliente'}</span> },
        { key: 'file_name', label: 'Archivo' },
        { key: 'mime_type', label: 'Tipo' },
        { key: 'size_bytes', label: 'Tamano' },
        {
          key: 'actions',
          label: 'Acceso',
          render: (row) => (
            <div className="inline-actions">
              <button className="secondary-button" onClick={() => openSigned(row)}><ExternalLink size={16} /> Ver</button>
              <button className="secondary-button" onClick={() => startEdit(row)}><Edit size={15} /> Editar</button>
              <button className="danger-button" onClick={() => remove(row)}><Trash2 size={15} /> Baja</button>
            </div>
          )
        }
      ]} rows={rows} />
      <Modal title={editingRow ? 'Editar foto' : 'Subir foto privada'} open={open} onClose={closeModal}>
        <form className="form-grid" onSubmit={submit}>
          <div className="grid two">
            <FormField label="Tipo de entidad">
              <select value={form.entity_type} onChange={(event) => updateField('entity_type', event.target.value)}>
                <option value="activo">Activo</option>
                <option value="ubicacion">Ubicacion</option>
                <option value="instalacion">Instalacion</option>
              </select>
            </FormField>
            <FormField label="Entidad">
              <select value={form.entity_id} onChange={(event) => updateField('entity_id', event.target.value)} required>
                <option value="">Seleccionar</option>
                {entityOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Titulo"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} /></FormField>
          <FormField label="Visibilidad">
            <select value={form.visibilidad} onChange={(event) => updateField('visibilidad', event.target.value)}>
              <option value="privado">Privado</option>
              <option value="tecnico">Tecnico</option>
              <option value="cliente">Cliente</option>
            </select>
          </FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          {!editingRow && <FormField label="Foto privada"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateField('file', event.target.files?.[0] || null)} required /></FormField>}
          <p className="muted">{editingRow ? 'Edita metadatos y asociacion. Para sustituir el archivo, sube una foto nueva y da de baja la anterior.' : 'La foto se guarda en `photos-private`; no se crea enlace publico permanente.'}</p>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal}>Cancelar</button>
            <button className="primary-button" type="submit">{editingRow ? 'Guardar cambios' : 'Subir foto'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
