import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Mail, Navigation, PackagePlus, Phone, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import {
  createVisitMaterial,
  getWorkOrder,
  MATERIAL_MOVEMENT_LABELS,
  MATERIAL_MOVEMENT_TYPES,
  REQUIREMENT_FIELDS
} from '../services/workOrderService';
import { updateWorkOrderLifecycleStatus } from '../services/workOrderLifecycleService';
import { buildFinalReviewItems, finalReviewCanValidate, loadWorkOrderFinalReview, validateWorkOrderAsAdmin } from '../services/workOrderReviewService';
import {
  isWorkOrderClosed,
  priorityLabel,
  priorityTone,
  statusLabel,
  statusTransitionHelp,
  validNextActions,
  workOrderTypeLabel
} from '../utils/workOrderLifecycle';
import { formatDateTime } from '../utils/dateUtils';
import { buildMapsEmbedUrl, buildMapsUrl } from '../utils/mapUtils';

const EMPTY_MATERIAL = {
  descripcion_libre: '',
  referencia: '',
  cantidad: '1',
  unidad: 'ud',
  tipo_movimiento: 'utilizado',
  numero_serie: '',
  observaciones: ''
};

const EMPTY_REVIEW_DATA = { checklist: [], visits: [], materials: [], photos: [], reports: [] };

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId, canManageWorkOrders } = useTenant();
  const [row, setRow] = useState(null);
  const [reviewData, setReviewData] = useState(EMPTY_REVIEW_DATA);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialDraft, setMaterialDraft] = useState(EMPTY_MATERIAL);
  const [reviewNotes, setReviewNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [validating, setValidating] = useState(false);

  async function refresh() {
    if (!activeTenantId || !id) return;
    setLoading(true);
    try {
      const [data, finalReview] = await Promise.all([
        getWorkOrder(activeTenantId, id),
        loadWorkOrderFinalReview(activeTenantId, id).catch((err) => {
          console.warn('No se pudo cargar la revision final OT', err);
          return EMPTY_REVIEW_DATA;
        })
      ]);
      setRow(data);
      setReviewData(finalReview);
      setReviewNotes(data.revision_admin_notas || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, id]);

  const isClosed = row ? isWorkOrderClosed(row) : false;
  const materials = reviewData.materials || [];
  const reviewItems = useMemo(() => (row ? buildFinalReviewItems(row, reviewData) : []), [row, reviewData]);
  const canValidateReview = finalReviewCanValidate(reviewItems);

  async function validateFinalReview() {
    if (!row) return;
    if (!canManageWorkOrders) {
      setError('Solo un administrador puede validar definitivamente la OT.');
      return;
    }
    setError('');
    setMessage('');
    setValidating(true);
    try {
      const updated = await validateWorkOrderAsAdmin(row, reviewItems, reviewNotes);
      setRow((current) => ({ ...current, ...updated }));
      setMessage('OT validada correctamente por administracion.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }

  async function changeStatus(status) {
    if (!row) return;
    if (status === 'VALIDADA') {
      await validateFinalReview();
      return;
    }
    setError('');
    setMessage('');
    try {
      const reopenReason = status === 'REABRIR' ? window.prompt('Motivo de reapertura') : '';
      if (status === 'REABRIR' && !reopenReason) return;
      const updated = await updateWorkOrderLifecycleStatus(row, status, { reopenReason });
      setRow((current) => ({ ...current, ...updated }));
      setMessage(`Estado actualizado a ${statusLabel(updated.estado)}.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateMaterialDraft(field, value) {
    setMaterialDraft((current) => ({ ...current, [field]: value }));
  }

  async function addMaterial(event) {
    event.preventDefault();
    if (!row) return;
    setError('');
    setMessage('');
    setSavingMaterial(true);
    try {
      await createVisitMaterial(row, null, materialDraft);
      setMaterialDraft(EMPTY_MATERIAL);
      setMaterialOpen(false);
      setMessage('Material registrado correctamente.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingMaterial(false);
    }
  }

  if (loading) return <p className="muted">Cargando orden de trabajo...</p>;
  if (!row) return <p className="error-text">No se ha encontrado la orden de trabajo.</p>;

  const nextActions = validNextActions(row).filter((status) => status !== 'VALIDADA' || canManageWorkOrders);
  const requirements = REQUIREMENT_FIELDS.filter(([field]) => row.configuracion?.[field]);
  const pendingReviewItems = reviewItems.filter((item) => item.blocking);

  return (
    <>
      <PageHeader
        title={row.codigo_ot || `OT ${row.id.slice(0, 8)}`}
        subtitle={row.titulo}
        action={<button className="ghost-button" onClick={() => navigate('/ots')}>Volver</button>}
      />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <CollapsibleSection title="Estado y ciclo de vida" subtitle="Gestiona el avance de la OT hasta su validacion final" icon={ClipboardCheck} badge={row.estado} defaultOpen>
        <div className="detail-list">
          <Detail label="Estado" value={<WorkOrderStatusBadge status={row.estado} />} />
          <Detail label="Prioridad" value={<span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad)}</span>} />
          <Detail label="Tipo" value={workOrderTypeLabel(row.tipo_ot || row.tipo)} />
          {row.tipo_ot_detalle && <Detail label="Detalle tipo" value={row.tipo_ot_detalle} />}
          <Detail label="Tecnico asignado" value={row.assigned?.nombre || row.assigned?.email || 'Sin asignar'} />
          <Detail label="Creada por" value={row.creator?.nombre || row.creator?.email || '-'} />
          <Detail label="Fecha prevista" value={row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-'} />
          <Detail label="Fecha limite" value={row.fecha_limite ? formatDateTime(row.fecha_limite) : '-'} />
          <Detail label="Duracion estimada" value={row.duracion_estimada_minutos ? `${row.duracion_estimada_minutos} min` : '-'} />
          <Detail label="Inicio" value={row.fecha_inicio ? formatDateTime(row.fecha_inicio) : '-'} />
          <Detail label="Fin" value={row.fecha_fin ? formatDateTime(row.fecha_fin) : '-'} />
          <Detail label="Revision admin" value={row.revision_admin_estado || 'no_requerida'} />
          <Detail label="Validada el" value={row.closed_at ? formatDateTime(row.closed_at) : '-'} />
        </div>
        {statusTransitionHelp(row.estado) && <p className="muted">{statusTransitionHelp(row.estado)}</p>}
        {isClosed && <p className="warning-text">OT cerrada: solo lectura. Para modificarla debe reabrirse con motivo y permisos.</p>}
        <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {nextActions.map((status) => (
            <button key={status} className={status === 'VALIDADA' ? 'primary-button' : status === 'CANCELADA' ? 'danger-button' : 'secondary-button'} type="button" onClick={() => changeStatus(status)}>
              {status === 'REABRIR' ? 'reabrir OT' : statusLabel(status)}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Revision final"
        subtitle="Comprobacion previa antes de cerrar definitivamente la OT"
        icon={ShieldCheck}
        badge={canValidateReview ? 'lista' : `${pendingReviewItems.length} pendiente(s)`}
        defaultOpen={row.estado === 'FINALIZADA' || pendingReviewItems.length > 0}
      >
        <div className="final-review-list">
          {reviewItems.map((item) => (
            <article className={`final-review-item ${item.passed ? 'ok' : item.required ? 'danger' : 'warn'}`} key={item.key}>
              <span>{item.passed ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
              <b>{item.required ? 'obligatorio' : 'opcional'}</b>
            </article>
          ))}
        </div>
        {pendingReviewItems.length > 0 && <p className="warning-text">No se puede validar todavía. Faltan requisitos obligatorios.</p>}
        {canManageWorkOrders && !isClosed && (
          <div className="form-grid" style={{ marginTop: 14 }}>
            <FormField label="Notas de revision del administrador">
              <textarea rows="3" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Ej. Revisado informe, fotos y firma. Se valida cierre." />
            </FormField>
            <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="primary-button" type="button" disabled={!canValidateReview || validating} onClick={validateFinalReview}>
                {validating ? 'Validando...' : 'Validar OT'}
              </button>
              <Link className="secondary-button" to={`/ots/${row.id}/informe`}>Revisar informe</Link>
              <Link className="ghost-button" to={`/ots/${row.id}/checklist`}>Revisar checklist</Link>
            </div>
          </div>
        )}
        {!canManageWorkOrders && <p className="muted">Solo el administrador puede validar definitivamente la OT.</p>}
      </CollapsibleSection>

      <CollapsibleSection title="Instalacion y activo" subtitle="Destino de la orden de trabajo" icon={Navigation} defaultOpen>
        <div className="detail-list">
          <Detail label="Instalacion" value={row.instalaciones?.nombre || '-'} />
          <Detail label="Direccion" value={row.instalaciones?.direccion || '-'} />
          <Detail label="Contacto" value={row.instalaciones?.contacto_nombre || '-'} />
          <Detail label="Telefono" value={row.instalaciones?.contacto_telefono || '-'} />
          <Detail label="Ubicacion" value={row.ubicaciones?.nombre || '-'} />
          <Detail label="Activo" value={row.activos?.nombre || '-'} />
          <Detail label="Marca / modelo" value={[row.activos?.marca, row.activos?.modelo].filter(Boolean).join(' / ') || '-'} />
          <Detail label="Nº serie" value={row.activos?.numero_serie || '-'} />
        </div>
        <InstallationContactPanel installation={row.instalaciones} />
      </CollapsibleSection>

      <CollapsibleSection title="Descripcion del trabajo" subtitle="Sintomas, trabajo solicitado, instrucciones y resultado esperado" icon={ClipboardCheck} defaultOpen={false}>
        <p>{row.descripcion || 'Sin descripcion adicional.'}</p>
        <div className="detail-list">
          <Detail label="Sintomas / situacion" value={row.sintomas || '-'} />
          <Detail label="Trabajo solicitado" value={row.trabajo_solicitado || '-'} />
          <Detail label="Instrucciones tecnico" value={row.instrucciones_tecnico || '-'} />
          <Detail label="Riesgos / precauciones" value={row.riesgos_precauciones || '-'} />
          <Detail label="Resultado esperado" value={row.resultado_esperado || '-'} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Materiales"
        subtitle="Material usado, retirado, devuelto o pendiente de pedir"
        icon={PackagePlus}
        badge={`${materials.length}`}
        defaultOpen={materials.length > 0 || row.configuracion?.requiere_materiales}
        actions={!isClosed && <button className="secondary-button" type="button" onClick={() => setMaterialOpen(true)}><PackagePlus size={18} /> Añadir material</button>}
      >
        <DataTable
          columns={[
            { key: 'descripcion_libre', label: 'Material', render: (item) => item.descripcion_libre || item.material_id || '-' },
            { key: 'cantidad', label: 'Cantidad', render: (item) => `${item.cantidad || 0} ${item.unidad || 'ud'}` },
            { key: 'tipo_movimiento', label: 'Tipo', render: (item) => <span className="badge">{MATERIAL_MOVEMENT_LABELS[item.tipo_movimiento] || item.tipo_movimiento}</span> },
            { key: 'referencia', label: 'Referencia', render: (item) => item.referencia || '-' },
            { key: 'numero_serie', label: 'Nº serie', render: (item) => item.numero_serie || '-' },
            { key: 'visita', label: 'Visita', render: (item) => item.visita?.fecha_inicio ? formatDateTime(item.visita.fecha_inicio) : 'OT general' },
            { key: 'observaciones', label: 'Observaciones', render: (item) => item.observaciones || '-' }
          ]}
          rows={materials}
          empty="Sin materiales registrados en esta OT."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Requisitos de cierre" subtitle="Checklist, fotos, firma, mediciones e informe" icon={CheckCircle2} badge={`${requirements.length}`} defaultOpen={false}>
        {requirements.length === 0 ? <p className="muted">Esta OT no tiene bloques obligatorios configurados.</p> : <div className="requirement-grid">{requirements.map(([field, label]) => <span className="badge ok" key={field}>{label}</span>)}</div>}
      </CollapsibleSection>

      <CollapsibleSection title="Trabajo en campo" subtitle="Visita, checklist, firma e informe" icon={ClipboardCheck} defaultOpen>
        <p className="muted">Desde aqui puedes abrir la visita, rellenar el checklist, firmar con el cliente y generar el informe final.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to="/scanner">Escanear QR</Link>
          {!isClosed && <Link className="secondary-button" to={`/ots/${row.id}/visita`}>Abrir visita</Link>}
          {row.configuracion?.requiere_checklist && <Link className="secondary-button" to={`/ots/${row.id}/checklist`}>Checklist</Link>}
          {row.configuracion?.requiere_firma_cliente && <Link className="secondary-button" to={`/ots/${row.id}/firma`}>Firma cliente</Link>}
          {row.configuracion?.requiere_informe && <Link className="primary-button" to={`/ots/${row.id}/informe`}>PDF informe</Link>}
        </div>
      </CollapsibleSection>

      <Modal title="Añadir material a la OT" open={materialOpen} onClose={() => setMaterialOpen(false)}>
        <form className="form-grid" onSubmit={addMaterial}>
          <div className="grid two">
            <FormField label="Descripcion libre">
              <input value={materialDraft.descripcion_libre} onChange={(event) => updateMaterialDraft('descripcion_libre', event.target.value)} placeholder="Ej. Valvula, junta, fusible, filtro..." required />
            </FormField>
            <FormField label="Referencia"><input value={materialDraft.referencia} onChange={(event) => updateMaterialDraft('referencia', event.target.value)} /></FormField>
            <FormField label="Cantidad"><input type="number" min="0" step="0.01" value={materialDraft.cantidad} onChange={(event) => updateMaterialDraft('cantidad', event.target.value)} /></FormField>
            <FormField label="Unidad"><input value={materialDraft.unidad} onChange={(event) => updateMaterialDraft('unidad', event.target.value)} placeholder="ud, m, l, kg..." /></FormField>
            <FormField label="Movimiento"><select value={materialDraft.tipo_movimiento} onChange={(event) => updateMaterialDraft('tipo_movimiento', event.target.value)}>{MATERIAL_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{MATERIAL_MOVEMENT_LABELS[type] || type.replaceAll('_', ' ')}</option>)}</select></FormField>
            <FormField label="Numero de serie"><input value={materialDraft.numero_serie} onChange={(event) => updateMaterialDraft('numero_serie', event.target.value)} /></FormField>
          </div>
          <FormField label="Observaciones"><textarea rows="3" value={materialDraft.observaciones} onChange={(event) => updateMaterialDraft('observaciones', event.target.value)} /></FormField>
          <p className="muted">Este registro queda asociado a la OT general. Si lo añades desde una visita, quedara vinculado tambien a esa intervencion.</p>
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setMaterialOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={savingMaterial}>{savingMaterial ? 'Guardando...' : 'Registrar material'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Detail({ label, value }) {
  return <div className="detail-row"><span className="muted">{label}</span><strong>{value}</strong></div>;
}

function InstallationContactPanel({ installation }) {
  const mapsUrl = buildMapsUrl(installation);
  const embedUrl = buildMapsEmbedUrl(installation);
  const phone = installation?.contacto_telefono;
  const email = installation?.contacto_email;
  if (!installation) return null;
  return (
    <div className="ot-installation-panel">
      <div className="quick-actions">
        {mapsUrl && <a className="secondary-button" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={18} /> Como llegar</a>}
        {phone && <a className="secondary-button" href={`tel:${phone}`}><Phone size={18} /> Llamar</a>}
        {email && <a className="ghost-button" href={`mailto:${email}`}><Mail size={18} /> Email</a>}
      </div>
      {embedUrl && <div className="ot-map-frame"><iframe title={`Mapa de ${installation.nombre || 'instalacion'}`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>}
    </div>
  );
}
