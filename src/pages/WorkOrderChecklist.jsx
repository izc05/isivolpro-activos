import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, CircleAlert, ImagePlus, Plus, RefreshCw, Save, X } from 'lucide-react';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderPageHeader from '../components/WorkOrders/WorkOrderPageHeader';
import WorkOrderSection, { WorkOrderSectionHeader } from '../components/WorkOrders/WorkOrderSection';
import { WorkOrderInfoGrid, WorkOrderInfoItem } from '../components/WorkOrders/WorkOrderInfoGrid';
import { useTenant } from '../hooks/useTenant';
import {
  CHECKLIST_RESULTS,
  createChecklistItem,
  ensureDefaultChecklist,
  getWorkOrder,
  listChecklistPhotos,
  listWorkOrderChecklist,
  listWorkOrderVisits,
  PHOTO_TYPES,
  signedChecklistPhotoUrl,
  updateChecklistItem,
  uploadChecklistPhoto
} from '../services/workOrderService';

const RESULT_LABELS = {
  pendiente: 'Pendiente',
  ok: 'OK',
  no_ok: 'No OK',
  no_aplica: 'No aplica'
};

const RESULT_BADGES = {
  pendiente: '',
  ok: 'ok',
  no_ok: 'danger',
  no_aplica: 'warn'
};

const newItemInitial = { descripcion: '', requiere_foto: false };

export default function WorkOrderChecklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState(newItemInitial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Preparando checklist...');
  const [savingId, setSavingId] = useState('');

  async function refresh() {
    if (tenantLoading) return;
    if (!activeTenantId || !id) {
      setLoading(false);
      setError('No se ha encontrado una empresa activa para cargar el checklist.');
      return;
    }
    setLoading(true);
    setLoadingStep('Cargando orden de trabajo...');
    setError('');
    try {
      const orderData = await getWorkOrder(activeTenantId, id);
      setLoadingStep('Preparando checklist base...');
      const [checklistData, visitData] = await Promise.all([
        ensureDefaultChecklist(orderData),
        listWorkOrderVisits(activeTenantId, id)
      ]);
      setWorkOrder(orderData);
      setItems(checklistData);
      setVisits(visitData);
      const activeVisit = visitData.find((visit) => visit.estado === 'EN_CURSO') || visitData[0];
      setSelectedVisitId((current) => current || activeVisit?.id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, tenantLoading, id]);

  const progress = useMemo(() => {
    const total = items.length;
    const done = items.filter((item) => item.resultado !== 'pendiente').length;
    const failed = items.filter((item) => item.resultado === 'no_ok').length;
    const ok = items.filter((item) => item.resultado === 'ok').length;
    return { total, done, failed, ok, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  async function generateDefaultChecklist() {
    if (!workOrder) return;
    setError('');
    try {
      const data = await ensureDefaultChecklist(workOrder);
      setItems(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateItem(item, patch) {
    setSavingId(item.id);
    setError('');
    try {
      const updated = await updateChecklistItem(item, {
        ...item,
        ...patch,
        visita_id: selectedVisitId || item.visita_id || null
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId('');
    }
  }

  async function submitNewItem(event) {
    event.preventDefault();
    if (!workOrder) return;
    setError('');
    try {
      const created = await createChecklistItem(workOrder, { ...newItem, visita_id: selectedVisitId || null });
      setItems((current) => [...current, created]);
      setNewItem(newItemInitial);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading || tenantLoading) {
    return (
      <section className="card workorder-loading">
        <RefreshCw size={22} />
        <div>
          <strong>{loadingStep}</strong>
          <p className="muted">Si la red o Supabase tardan demasiado, aparecerá una opción para reintentar.</p>
        </div>
      </section>
    );
  }
  if (!workOrder) {
    return (
      <section className="card">
        <p className="error-text">{error || 'No se ha encontrado la OT.'}</p>
        <button className="secondary-button" type="button" onClick={refresh}><RefreshCw size={18} /> Reintentar</button>
      </section>
    );
  }

  return (
    <>
      <WorkOrderPageHeader workOrder={workOrder} titlePrefix="Checklist" onBack={() => navigate(`/ots/${workOrder.id}`)} />
      {error && (
        <div className="workorder-alert">
          <CircleAlert size={20} />
          <p>{error}</p>
          <button className="secondary-button" type="button" onClick={refresh}><RefreshCw size={18} /> Reintentar</button>
        </div>
      )}

      <section className="card workorder-command ot-command-panel">
        <div className="grid two">
          <div>
            <WorkOrderSectionHeader title="Resumen" subtitle="Avance del checklist de la OT" icon={Save} />
            <div className="workorder-progress" aria-label={`Progreso ${progress.percent}%`}>
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <WorkOrderInfoGrid columns={2}>
              <WorkOrderInfoItem label="Estado OT" value={<WorkOrderStatusBadge status={workOrder.estado} />} important />
              <WorkOrderInfoItem label="Progreso" value={`${progress.done}/${progress.total} (${progress.percent}%)`} important />
              <WorkOrderInfoItem label="Instalación" value={workOrder.instalaciones?.nombre || '-'} />
              <WorkOrderInfoItem label="Activo" value={workOrder.activos?.nombre || '-'} />
              <WorkOrderInfoItem label="OK" value={progress.ok} />
              <WorkOrderInfoItem label="No OK" value={progress.failed} important={progress.failed > 0} />
            </WorkOrderInfoGrid>
          </div>
          <div>
            <WorkOrderSectionHeader title="Visita asociada" subtitle="Respuestas y fotos vinculadas a una intervención" icon={RefreshCw} />
            <FormField label="Asignar respuestas y fotos a visita">
              <select value={selectedVisitId} onChange={(event) => setSelectedVisitId(event.target.value)}>
                <option value="">Sin visita concreta</option>
                {visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>{new Date(visit.fecha_inicio).toLocaleString()} - {visit.estado}</option>
                ))}
              </select>
            </FormField>
            <p className="muted">Se preselecciona la visita en curso para que el tecnico no tenga que elegir identificadores manualmente.</p>
            <div className="quick-actions">
              <button className="secondary-button" type="button" onClick={generateDefaultChecklist}><RefreshCw size={18} /> Completar base</button>
              <button className="primary-button" type="button" onClick={() => setOpen(true)}><Plus size={18} /> Añadir punto</button>
            </div>
          </div>
        </div>
      </section>

      <div className="checklist-stack" style={{ marginTop: 16 }}>
        {items.length === 0 && (
          <section className="card empty-state">
            <strong>Esta OT todavia no tiene checklist.</strong>
            <span>Genera una plantilla base o añade puntos manualmente para empezar la visita.</span>
            <button className="primary-button" type="button" onClick={generateDefaultChecklist}><Plus size={18} /> Generar checklist base</button>
          </section>
        )}
        {items.map((item) => (
          <ChecklistItemCard
            key={item.id}
            item={item}
            workOrder={workOrder}
            selectedVisitId={selectedVisitId}
            saving={savingId === item.id}
            onUpdate={updateItem}
          />
        ))}
      </div>

      <WorkOrderSection title="Siguiente bloque" subtitle="Firma e informe de la intervención" icon={Save} defaultOpen={false}>
        <p className="muted">Cuando todos los puntos esten revisados, pasa a firma del cliente y genera el PDF final.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to={`/ots/${workOrder.id}/visita`}>Abrir visita</Link>
          <Link className="secondary-button" to={`/ots/${workOrder.id}/firma`}>Firma cliente</Link>
          <Link className="primary-button" to={`/ots/${workOrder.id}/informe`}>Generar PDF</Link>
        </div>
      </WorkOrderSection>

      <Modal title="Añadir punto al checklist" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submitNewItem}>
          <FormField label="Descripcion del punto">
            <textarea rows="4" value={newItem.descripcion} onChange={(event) => setNewItem((current) => ({ ...current, descripcion: event.target.value }))} required />
          </FormField>
          <label className="checkbox-row">
            <input type="checkbox" checked={newItem.requiere_foto} onChange={(event) => setNewItem((current) => ({ ...current, requiere_foto: event.target.checked }))} />
            <span>Requiere foto</span>
          </label>
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Crear punto</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ChecklistItemCard({ item, workOrder, selectedVisitId, saving, onUpdate }) {
  const [observation, setObservation] = useState(item.observacion || '');
  const [photos, setPhotos] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [comment, setComment] = useState('');
  const [photoType, setPhotoType] = useState('otra');
  const [extra, setExtra] = useState({
    defecto: item.defecto || '',
    accion_realizada: item.accion_realizada || '',
    estado_despues: item.estado_despues || '',
    recomendacion: item.recomendacion || '',
    medicion_valor: item.medicion_valor || ''
  });
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setObservation(item.observacion || '');
  }, [item.observacion]);

  useEffect(() => {
    setExtra({
      defecto: item.defecto || '',
      accion_realizada: item.accion_realizada || '',
      estado_despues: item.estado_despues || '',
      recomendacion: item.recomendacion || '',
      medicion_valor: item.medicion_valor || ''
    });
  }, [item.defecto, item.accion_realizada, item.estado_despues, item.recomendacion, item.medicion_valor]);

  async function refreshPhotos() {
    try {
      const data = await listChecklistPhotos(item.tenant_id, item.id);
      setPhotos(data);
      const entries = await Promise.all(data.map(async (photo) => [photo.id, await signedChecklistPhotoUrl(photo)]));
      setPhotoUrls(Object.fromEntries(entries));
    } catch (err) {
      setPhotoError(err.message);
    }
  }

  useEffect(() => {
    refreshPhotos();
  }, [item.id]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submitPhoto(event) {
    event.preventDefault();
    setPhotoError('');
    if (!file) {
      setPhotoError('Selecciona una foto antes de subir.');
      return;
    }
    setUploading(true);
    try {
      await uploadChecklistPhoto({
        workOrder,
        checklistItem: item,
        visitId: selectedVisitId || item.visita_id || null,
        file,
        comentario: comment,
        tipoFoto: photoType
      });
      setFile(null);
      setComment('');
      setPhotoType('otra');
      event.target.reset();
      await refreshPhotos();
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function updateExtra(field, value) {
    setExtra((current) => ({ ...current, [field]: value }));
  }

  function clearSelectedFile(event) {
    event?.preventDefault();
    setFile(null);
    const input = document.getElementById(`photo-input-${item.id}`);
    if (input) input.value = '';
  }

  return (
    <section className="card ot-checklist-card">
      <WorkOrderSectionHeader
        title={`${item.punto}. ${item.descripcion}`}
        subtitle={`${item.requiere_foto ? 'Foto requerida' : 'Foto opcional'} · ${photos.length} foto(s)`}
        icon={Camera}
        badge={<span className={`badge ${RESULT_BADGES[item.resultado] || ''}`}>{RESULT_LABELS[item.resultado] || item.resultado}</span>}
      />
      <div className="form-grid">
        <FormField label="Resultado">
          <select value={item.resultado} disabled={saving} onChange={(event) => onUpdate(item, { resultado: event.target.value, observacion: observation })}>
            {CHECKLIST_RESULTS.map((result) => <option key={result} value={result}>{RESULT_LABELS[result]}</option>)}
          </select>
        </FormField>
        <label className="checkbox-row">
          <input type="checkbox" checked={item.requiere_foto} disabled={saving} onChange={(event) => onUpdate(item, { requiere_foto: event.target.checked, observacion: observation })} />
          <span>Requiere foto</span>
        </label>
        <FormField label="Observacion">
          <textarea rows="3" value={observation} onChange={(event) => setObservation(event.target.value)} onBlur={() => onUpdate(item, { observacion: observation })} placeholder="Anota pruebas, defectos, material pendiente o aclaraciones" />
        </FormField>
        {item.resultado === 'no_ok' && (
          <>
            <FormField label="Defecto detectado">
              <textarea rows="2" value={extra.defecto} onChange={(event) => updateExtra('defecto', event.target.value)} />
            </FormField>
            <FormField label="Accion realizada">
              <textarea rows="2" value={extra.accion_realizada} onChange={(event) => updateExtra('accion_realizada', event.target.value)} />
            </FormField>
            <FormField label="Estado despues de actuar">
              <input value={extra.estado_despues} onChange={(event) => updateExtra('estado_despues', event.target.value)} />
            </FormField>
            <FormField label="Recomendacion">
              <textarea rows="2" value={extra.recomendacion} onChange={(event) => updateExtra('recomendacion', event.target.value)} />
            </FormField>
          </>
        )}
        {item.requiere_medicion && (
          <FormField label={`Medicion${item.valor_referencia ? ` · ref. ${item.valor_referencia}` : ''}`}>
            <input value={extra.medicion_valor} onChange={(event) => updateExtra('medicion_valor', event.target.value)} />
          </FormField>
        )}
        <div className="form-actions">
          <button className="secondary-button" type="button" disabled={saving} onClick={() => onUpdate(item, { observacion: observation, ...extra })}><Save size={18} /> Guardar punto</button>
        </div>
      </div>

      <div className="workorder-photo-block">
        <h3 className="section-heading"><Camera size={18} /> Fotos del punto</h3>
        {photos.length > 0 && (
          <div className="ot-checklist-photo-grid" aria-label="Fotos registradas en este punto">
            {photos.map((photo) => (
              <article className="ot-checklist-photo-card" key={photo.id}>
                {photoUrls[photo.id] ? (
                  <img src={photoUrls[photo.id]} alt={photo.comentario || photo.file_name || 'Foto OT'} />
                ) : (
                  <div className="ot-checklist-photo-loading">Cargando foto...</div>
                )}
                <div>
                  <strong>{photo.comentario || 'Foto sin comentario'}</strong>
                  <small>{photo.tipo_foto?.replaceAll('_', ' ') || 'foto'} · {new Date(photo.created_at).toLocaleString()}</small>
                  {photo.created_by_profile && <small>Subida por {photo.created_by_profile.nombre || photo.created_by_profile.email}</small>}
                </div>
              </article>
            ))}
          </div>
        )}
        <form className="form-grid" onSubmit={submitPhoto}>
          <label className={`photo-uploader ${file ? 'has-file' : ''}`} htmlFor={`photo-input-${item.id}`}>
            <input
              id={`photo-input-${item.id}`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Vista previa de la foto seleccionada" />
            ) : (
              <span className="photo-uploader-icon"><ImagePlus size={28} /></span>
            )}
            <span className="photo-uploader-copy">
              <strong>{file ? file.name : 'Adjuntar imagen'}</strong>
              <small>{file ? `${Math.round(file.size / 1024)} KB listos para subir` : 'Toca para hacer foto o seleccionar desde galeria'}</small>
            </span>
          </label>
          {file && (
            <button className="ghost-button photo-clear-button" type="button" onClick={clearSelectedFile}>
              <X size={18} /> Quitar imagen
            </button>
          )}
          <FormField label="Comentario de la foto">
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ej. Estado inicial, defecto, reparacion realizada" />
          </FormField>
          <FormField label="Tipo de fotografia">
            <select value={photoType} onChange={(event) => setPhotoType(event.target.value)}>
              {PHOTO_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
            </select>
          </FormField>
          {photoError && <p className="error-text">{photoError}</p>}
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={uploading}><Camera size={18} /> {uploading ? 'Subiendo...' : 'Subir foto'}</button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-row">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
