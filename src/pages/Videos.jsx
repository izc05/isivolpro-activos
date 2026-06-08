import { Edit, ExternalLink, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { createSignedUrl } from '../services/fileService';
import { createVideo, softDeleteMedia, updateVideo } from '../services/mediaService';
import { logAudit } from '../services/auditService';

export default function Videos() {
  const { rows, activeTenantId, refresh } = useTenantRows('videos', '*, instalaciones(nombre), ubicaciones(nombre), activos(nombre)', { order: 'created_at' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const emptyForm = {
    entity_type: 'activo',
    entity_id: '',
    titulo: '',
    descripcion: '',
    tipo: 'url',
    external_url: '',
    visibilidad: 'cliente',
    file: null
  };
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
      if (field === 'tipo') {
        next.file = null;
        next.external_url = '';
      }
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    if (!editingRow && form.tipo === 'archivo' && !navigator.onLine) {
      setError('No se pueden subir videos sin conexion.');
      return;
    }
    try {
      if (editingRow) {
        await updateVideo(editingRow, form);
      } else {
        await createVideo(activeTenantId, form);
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
      tipo: row.tipo || 'url',
      external_url: row.external_url || '',
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

  async function openVideo(row) {
    if (row.tipo === 'url') {
      await logAudit({ tenantId: row.tenant_id, action: 'view_media', entityType: 'video', entityId: row.id, metadata: { source: 'external_url' } });
      window.open(row.external_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const url = await createSignedUrl({ tenantId: row.tenant_id, bucket: row.bucket, path: row.storage_path, entityType: 'video', entityId: row.id });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el video "${row.titulo}"?`)) return;
    await softDeleteMedia({ table: 'videos', row, entityType: 'video', auditAction: 'delete_video' });
    refresh();
  }

  function entityLabel(row) {
    return row.activos?.nombre || row.ubicaciones?.nombre || row.instalaciones?.nombre || '-';
  }

  return (
    <>
      <PageHeader title="Videos" subtitle="Videos privados o enlaces externos asociados a instalaciones, ubicaciones o activos." action={<button className="primary-button" onClick={startCreate}><Upload size={18} /> Nuevo video</button>} />
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'titulo', label: 'Titulo' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'entity', label: 'Asociado a', render: entityLabel },
        { key: 'visibilidad', label: 'Visibilidad', render: (row) => <span className="badge">{row.visibilidad}</span> },
        { key: 'external_url', label: 'Origen', render: (row) => row.tipo === 'url' ? row.external_url : row.storage_path },
        {
          key: 'actions',
          label: 'Acceso',
          render: (row) => (
            <div className="inline-actions">
              <button className="secondary-button" onClick={() => openVideo(row)}><ExternalLink size={16} /> Abrir</button>
              <button className="secondary-button" onClick={() => startEdit(row)}><Edit size={15} /> Editar</button>
              <button className="danger-button" onClick={() => remove(row)}><Trash2 size={15} /> Baja</button>
            </div>
          )
        }
      ]} rows={rows} />
      <Modal title={editingRow ? 'Editar video' : 'Nuevo video'} open={open} onClose={closeModal}>
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
          <div className="grid two">
            <FormField label="Origen">
              <select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} disabled={Boolean(editingRow)}>
                <option value="url">URL externa</option>
                <option value="archivo">Archivo privado</option>
              </select>
            </FormField>
            <FormField label="Visibilidad">
              <select value={form.visibilidad} onChange={(event) => updateField('visibilidad', event.target.value)}>
                <option value="privado">Privado</option>
                <option value="tecnico">Tecnico</option>
                <option value="cliente">Cliente</option>
              </select>
            </FormField>
          </div>
          <FormField label="Titulo"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          {form.tipo === 'url' ? (
            <FormField label="URL externa"><input type="url" value={form.external_url} onChange={(event) => updateField('external_url', event.target.value)} required /></FormField>
          ) : !editingRow ? (
            <FormField label="Video privado"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => updateField('file', event.target.files?.[0] || null)} required /></FormField>
          ) : (
            <p className="muted">Este video usa archivo privado. Para sustituir el archivo, sube un video nuevo y da de baja el anterior.</p>
          )}
          <p className="muted">{editingRow ? 'Edita metadatos, visibilidad y asociacion.' : 'Los videos de archivo se guardan en `videos-private`. Las URLs externas solo guardan la referencia y siguen dependiendo de los permisos de la plataforma externa.'}</p>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal}>Cancelar</button>
            <button className="primary-button" type="submit">{editingRow ? 'Guardar cambios' : 'Guardar video'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
