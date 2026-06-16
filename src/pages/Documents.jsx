import { ExternalLink, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createSignedUrl } from '../services/fileService';
import { createDocumentWithFile, softDeleteDocument } from '../services/documentService';
import { logAudit } from '../services/auditService';

const DOCUMENT_TYPES = ['Proyecto', 'Boletin', 'OCA', 'Esquema unifilar', 'Manual', 'Certificado', 'Plano', 'Parte de trabajo', 'Revision', 'Garantia', 'Otro'];

export default function Documents() {
  const { activeInstallationId, activeInstallation } = useTenant();
  const { rows, activeTenantId, refresh } = useTenantRows('documentos', '*, instalaciones(nombre), ubicaciones(nombre), activos(nombre,instalacion_id), ubicacion_ref:ubicaciones!documentos_ubicacion_id_fkey(instalacion_id)', { order: 'created_at' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const emptyForm = { entity_type: activeInstallationId ? 'instalacion' : 'activo', entity_id: activeInstallationId || '', tipo: 'Manual', titulo: '', descripcion: '', visibilidad: 'privado', file: null };
  const [form, setForm] = useState(emptyForm);

  const visibleRows = useMemo(() => {
    if (!activeInstallationId) return rows;
    return rows.filter((row) => row.instalacion_id === activeInstallationId || row.activos?.instalacion_id === activeInstallationId || row.ubicacion_ref?.instalacion_id === activeInstallationId);
  }, [rows, activeInstallationId]);

  const visibleInstallations = useMemo(() => activeInstallationId ? installations.filter((item) => item.id === activeInstallationId) : installations, [installations, activeInstallationId]);
  const visibleLocations = useMemo(() => activeInstallationId ? locations.filter((item) => item.instalacion_id === activeInstallationId) : locations, [locations, activeInstallationId]);
  const visibleAssets = useMemo(() => activeInstallationId ? assets.filter((item) => item.instalacion_id === activeInstallationId) : assets, [assets, activeInstallationId]);

  const entityOptions = useMemo(() => {
    if (form.entity_type === 'instalacion') return visibleInstallations.map((item) => ({ id: item.id, label: item.nombre }));
    if (form.entity_type === 'ubicacion') return visibleLocations.map((item) => ({ id: item.id, label: item.nombre }));
    return visibleAssets.map((item) => ({ id: item.id, label: item.nombre }));
  }, [form.entity_type, visibleInstallations, visibleLocations, visibleAssets]);

  function buildEmptyForm() {
    return { ...emptyForm, entity_type: activeInstallationId ? 'instalacion' : 'activo', entity_id: activeInstallationId || '' };
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'entity_type') {
        next.entity_id = value === 'instalacion' && activeInstallationId ? activeInstallationId : '';
      }
      return next;
    });
  }

  async function openSigned(row) {
    const url = await createSignedUrl({ tenantId: row.tenant_id, bucket: row.bucket, path: row.storage_path, entityId: row.id });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function downloadSigned(row) {
    const url = await createSignedUrl({ tenantId: row.tenant_id, bucket: row.bucket, path: row.storage_path, entityId: row.id });
    await logAudit({ tenantId: row.tenant_id, action: 'download_document', entityType: 'documento', entityId: row.id });
    const link = document.createElement('a');
    link.href = url;
    link.download = row.file_name || row.titulo;
    link.rel = 'noopener noreferrer';
    link.click();
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    if (!navigator.onLine) {
      setError('No se pueden subir documentos sin conexion.');
      return;
    }
    try {
      await createDocumentWithFile(activeTenantId, form);
      setForm(buildEmptyForm());
      formElement.reset();
      setOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el documento "${row.titulo}"?`)) return;
    await softDeleteDocument(row);
    refresh();
  }

  function entityLabel(row) {
    return row.activos?.nombre || row.ubicaciones?.nombre || row.instalaciones?.nombre || '-';
  }

  function startCreate() {
    setForm(buildEmptyForm());
    setError('');
    setOpen(true);
  }

  return (
    <>
      <PageHeader title="Documentos" subtitle={activeInstallation ? `Documentación filtrada de ${activeInstallation.nombre}.` : 'Documentacion privada servida con URLs firmadas temporales.'} action={<button className="primary-button" onClick={startCreate}><Upload size={18} /> Subir documento</button>} />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeInstallation.nombre}</p>}
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'titulo', label: 'Titulo' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'entity', label: 'Asociado a', render: entityLabel },
        { key: 'visibilidad', label: 'Visibilidad', render: (row) => <span className="badge">{row.visibilidad}</span> },
        { key: 'file_name', label: 'Archivo' },
        { key: 'open', label: 'Acceso', render: (row) => <div className="inline-actions"><button className="secondary-button" onClick={() => openSigned(row)}><ExternalLink size={16} /> Ver</button><button className="ghost-button" onClick={() => downloadSigned(row)}>Descargar</button><button className="danger-button" onClick={() => remove(row)}><Trash2 size={15} /> Baja</button></div> }
      ]} rows={visibleRows} empty="Sin documentos para la instalación activa" />
      <Modal title="Subir documento privado" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <div className="grid two">
            <FormField label="Tipo de entidad"><select value={form.entity_type} onChange={(event) => updateField('entity_type', event.target.value)}><option value="activo">Activo</option><option value="ubicacion">Ubicacion</option><option value="instalacion">Instalacion</option></select></FormField>
            <FormField label="Entidad"><select value={form.entity_id} onChange={(event) => updateField('entity_id', event.target.value)} required><option value="">Seleccionar</option>{entityOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FormField>
          </div>
          <div className="grid two">
            <FormField label="Tipo documento"><select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></FormField>
            <FormField label="Visibilidad"><select value={form.visibilidad} onChange={(event) => updateField('visibilidad', event.target.value)}><option value="privado">Privado</option><option value="tecnico">Tecnico</option><option value="cliente">Cliente</option></select></FormField>
          </div>
          <FormField label="Titulo"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <FormField label="Archivo privado"><input type="file" onChange={(event) => updateField('file', event.target.files?.[0] || null)} required /></FormField>
          <p className="muted">El archivo se sube a `documents-private` con ruta iniciada por `tenant_id`. Supabase Storage y RLS validan que no se escriba fuera del cliente activo.</p>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions"><button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Subir y registrar</button></div>
        </form>
      </Modal>
    </>
  );
}
