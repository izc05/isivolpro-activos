import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, CircleAlert, ClipboardCheck, FileImage, FileSignature, ImagePlus, ListChecks, Plus, RefreshCw, Save, Settings2, X } from 'lucide-react';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderPageHeader from '../components/WorkOrders/WorkOrderPageHeader';
import { WorkOrderSectionHeader } from '../components/WorkOrders/WorkOrderSection';
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

const CHECKLIST_PANELS = [
  { key: 'preparacion', label: 'Preparacion', subtitle: 'Visita y base', icon: Settings2 },
  { key: 'checklist', label: 'Checklist', subtitle: 'Puntos de control', icon: ListChecks },
  { key: 'evidencias', label: 'Evidencias', subtitle: 'Fotos requeridas', icon: FileImage },
  { key: 'resumen', label: 'Resumen', subtitle: 'Estado de avance', icon: ClipboardCheck },
  { key: 'cierre', label: 'Cierre', subtitle: 'Firma e informe', icon: FileSignature }
];

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
  const [activePanel, setActivePanel] = useState('preparacion');

  async function ensureAndLoadChecklist(orderData) {
    await ensureDefaultChecklist(orderData);
    return listWorkOrderChecklist(orderData.tenant_id, orderData.id);
  }

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
        ensureAndLoadChecklist(orderData),
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
    const photoRequired = items.filter((item) => item.requiere_foto).length;
    const pending = total - done;
    return { total, done, failed, ok, pending, photoRequired, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  const activeVisit = useMemo(
    () => visits.find((visit) => visit.id === selectedVisitId) || visits.find((visit) => visit.estado === 'EN_CURSO') || visits[0],
    [visits, selectedVisitId]
  );

  const evidenceItems = useMemo(() => items.filter((item) => item.requiere_foto), [items]);

  const panelStatus = {
    preparacion: selectedVisitId ? 'Visita elegida' : visits.length ? 'Elegir visita' : 'Sin visita',
    checklist: progress.total ? `${progress.done}/${progress.total}` : 'Sin base',
    evidencias: `${progress.photoRequired} foto(s)`,
    resumen: `${progress.percent}%`,
    cierre: progress.pending === 0 && progress.total > 0 ? 'Listo' : 'Pendiente'
  };

  async function generateDefaultChecklist() {
    if (!workOrder) return;
    setError('');
    try {
      const data = await ensureAndLoadChecklist(workOrder);
      setItems(data);
      setActivePanel('checklist');
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

      <section className="card ot-checklist-workspace">
        <div className="ot-checklist-toolbar">
          <div>
            <span className="eyebrow">Checklist de trabajo</span>
            <h2>{workOrder.codigo_ot || workOrder.titulo}</h2>
            <p>{workOrder.instalaciones?.nombre || 'Sin instalacion'} - {workOrder.activos?.nombre || 'Sin activo'} - {progress.done}/{progress.total} completados</p>
          </div>
          <div className="ot-checklist-toolbar-actions">
            <button className="secondary-button" type="button" onClick={generateDefaultChecklist}><RefreshCw size={18} /> Base</button>
            <button className="primary-button" type="button" onClick={() => setOpen(true)}><Plus size={18} /> Punto</button>
          </div>
        </div>

        <div className="workorder-progress compact" aria-label={`Progreso ${progress.percent}%`}>
          <span style={{ width: `${progress.percent}%` }} />
        </div>

        <div className="ot-flow-current">
          <strong>Paso actual: {CHECKLIST_PANELS.find((panel) => panel.key === activePanel)?.label}</strong>
          <span>{panelStatus[activePanel]}</span>
        </div>

        <div className="ot-subscreen-tabs" role="tablist" aria-label="Bloques del checklist">
          {CHECKLIST_PANELS.map((panel) => {
            const Icon = panel.icon;
            return (
              <button
                key={panel.key}
                type="button"
                className={activePanel === panel.key ? 'active' : ''}
                onClick={() => setActivePanel(panel.key)}
                role="tab"
                aria-selected={activePanel === panel.key}
              >
                <Icon size={18} />
                <span>
                  <strong>{panel.label}</strong>
                  <small>{panel.subtitle}</small>
                </span>
                <em>{panelStatus[panel.key]}</em>
              </button>
            );
          })}
        </div>

        {activePanel === 'preparacion' && (
          <div className="ot-subscreen-panel">
            <div className="ot-panel-heading">
              <div>
                <h3>Preparar trabajo</h3>
                <p>Antes de responder puntos, confirma la visita asociada y que la plantilla base esta cargada.</p>
              </div>
              <span className="badge">{items.length ? 'Base cargada' : 'Sin base'}</span>
            </div>
            <div className="grid two ot-summary-grid">
              <div className="ot-step-card">
                <WorkOrderSectionHeader title="Visita asociada" subtitle="Donde se guardaran respuestas y fotos" icon={RefreshCw} />
                <FormField label="Asignar respuestas y fotos a visita">
                  <select value={selectedVisitId} onChange={(event) => setSelectedVisitId(event.target.value)}>
                    <option value="">Sin visita concreta</option>
                    {visits.map((visit) => (
                      <option key={visit.id} value={visit.id}>{new Date(visit.fecha_inicio).toLocaleString()} - {visit.estado}</option>
                    ))}
                  </select>
                </FormField>
                <p className="muted">{activeVisit ? `Seleccionada: ${new Date(activeVisit.fecha_inicio).toLocaleString()} - ${activeVisit.estado}` : 'No hay visitas registradas para esta OT.'}</p>
              </div>
              <div className="ot-step-card">
                <WorkOrderSectionHeader title="Plantilla y puntos" subtitle="Base del checklist de esta OT" icon={ListChecks} />
                <WorkOrderInfoGrid columns={2}>
                  <WorkOrderInfoItem label="Puntos" value={progress.total} important />
                  <WorkOrderInfoItem label="Pendientes" value={progress.pending} important={progress.pending > 0} />
                  <WorkOrderInfoItem label="Fotos requeridas" value={progress.photoRequired} />
                  <WorkOrderInfoItem label="Estado OT" value={<WorkOrderStatusBadge status={workOrder.estado} />} />
                </WorkOrderInfoGrid>
                <div className="quick-actions">
                  <button className="secondary-button" type="button" onClick={generateDefaultChecklist}><RefreshCw size={18} /> Completar base</button>
                  <button className="primary-button" type="button" onClick={() => setActivePanel('checklist')}>Ir al checklist</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activePanel === 'checklist' && (
          <div className="ot-subscreen-panel">
            <div className="ot-panel-heading">
              <div>
                <h3>Puntos del checklist</h3>
                <p>Registra resultado, observaciones y fotos sin mezclarlo con el cierre de la OT.</p>
              </div>
              <span className="badge">{items.length} punto(s)</span>
            </div>
            {items.length === 0 && (
              <section className="empty-state ot-checklist-empty">
                <strong>Esta OT todavia no tiene checklist.</strong>
                <span>Genera una plantilla base o añade puntos manualmente para empezar la visita.</span>
                <button className="primary-button" type="button" onClick={generateDefaultChecklist}><Plus size={18} /> Generar checklist base</button>
              </section>
            )}
            <div className="checklist-stack">
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
          </div>
        )}

        {activePanel === 'evidencias' && (
          <div className="ot-subscreen-panel">
            <div className="ot-panel-heading">
              <div>
                <h3>Evidencias fotograficas</h3>
                <p>Revisa que los puntos que requieren foto tengan evidencia antes de pasar a firma e informe.</p>
              </div>
              <span className="badge">{progress.photoRequired} requerido(s)</span>
            </div>
            {evidenceItems.length === 0 ? (
              <section className="empty-state ot-checklist-empty">
                <strong>No hay fotos obligatorias en este checklist.</strong>
                <span>Si necesitas documentar una evidencia, marca un punto como "requiere foto" o sube fotos opcionales desde el punto.</span>
                <button className="secondary-button" type="button" onClick={() => setActivePanel('checklist')}>Volver a puntos</button>
              </section>
            ) : (
              <div className="ot-evidence-list">
                {evidenceItems.map((item) => (
                  <button className="ot-evidence-row" type="button" key={item.id} onClick={() => setActivePanel('checklist')}>
                    <Camera size={18} />
                    <span>
                      <strong>{item.punto}. {item.descripcion}</strong>
                      <small>{RESULT_LABELS[item.resultado] || item.resultado} - abre el punto para ver o subir fotos</small>
                    </span>
                    <span className={`badge ${RESULT_BADGES[item.resultado] || ''}`}>{RESULT_LABELS[item.resultado] || item.resultado}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activePanel === 'resumen' && (
          <div className="ot-subscreen-panel">
            <div className="grid two ot-summary-grid">
              <div>
                <WorkOrderSectionHeader title="Resumen" subtitle="Avance del checklist de la OT" icon={Save} />
                <WorkOrderInfoGrid columns={2}>
                  <WorkOrderInfoItem label="Estado OT" value={<WorkOrderStatusBadge status={workOrder.estado} />} important />
                  <WorkOrderInfoItem label="Progreso" value={`${progress.done}/${progress.total} (${progress.percent}%)`} important />
                  <WorkOrderInfoItem label="Instalacion" value={workOrder.instalaciones?.nombre || '-'} />
                  <WorkOrderInfoItem label="Activo" value={workOrder.activos?.nombre || '-'} />
                  <WorkOrderInfoItem label="OK" value={progress.ok} />
                  <WorkOrderInfoItem label="No OK" value={progress.failed} important={progress.failed > 0} />
                </WorkOrderInfoGrid>
              </div>
              <div>
                <WorkOrderSectionHeader title="Lectura rapida" subtitle="Que falta antes de cerrar" icon={ClipboardCheck} />
                <WorkOrderInfoGrid columns={2}>
                  <WorkOrderInfoItem label="Pendientes" value={progress.pending} important={progress.pending > 0} />
                  <WorkOrderInfoItem label="Fotos requeridas" value={progress.photoRequired} />
                  <WorkOrderInfoItem label="Visita" value={activeVisit ? activeVisit.estado : 'Sin visita'} />
                  <WorkOrderInfoItem label="No OK" value={progress.failed} important={progress.failed > 0} />
                </WorkOrderInfoGrid>
                <div className="quick-actions">
                  <button className="secondary-button" type="button" onClick={() => setActivePanel('preparacion')}>Preparacion</button>
                  <button className="primary-button" type="button" onClick={() => setActivePanel(progress.pending ? 'checklist' : 'cierre')}>{progress.pending ? 'Seguir checklist' : 'Ir a cierre'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activePanel === 'cierre' && (
          <div className="ot-subscreen-panel">
            <div className="ot-panel-heading">
              <div>
                <h3>Siguiente bloque</h3>
                <p>Cuando los puntos esten revisados, pasa a firma del cliente y genera el PDF final.</p>
              </div>
              <WorkOrderStatusBadge status={workOrder.estado} />
            </div>
            <div className="ot-close-actions">
              <Link className="secondary-button" to={`/ots/${workOrder.id}/visita`}>Abrir visita</Link>
              <Link className="secondary-button" to={`/ots/${workOrder.id}/firma`}>Firma cliente</Link>
              <Link className="primary-button" to={`/ots/${workOrder.id}/informe`}>Generar PDF</Link>
            </div>
          </div>
        )}
      </section>

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
