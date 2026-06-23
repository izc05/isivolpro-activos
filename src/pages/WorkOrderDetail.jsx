import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Mail, Navigation, PackagePlus, Phone, ShieldCheck } from 'lucide-react';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderPageHeader from '../components/WorkOrders/WorkOrderPageHeader';
import WorkOrderPriorityBadge from '../components/WorkOrders/WorkOrderPriorityBadge';
import WorkOrderSection from '../components/WorkOrders/WorkOrderSection';
import { WorkOrderInfoGrid, WorkOrderInfoItem } from '../components/WorkOrders/WorkOrderInfoGrid';
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
  const location = useLocation();
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

  useEffect(() => {
    if (location.state?.message) setMessage(location.state.message);
  }, [location.state]);

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
      <WorkOrderPageHeader
        workOrder={row}
        onBack={() => navigate('/ots')}
        actions={nextActions.length > 0 && (
          <div className="quick-actions">
            {nextActions.slice(0, 3).map((status) => (
              <button key={status} className={status === 'VALIDADA' ? 'primary-button' : status === 'CANCELADA' ? 'danger-button' : 'secondary-button'} type="button" onClick={() => changeStatus(status)}>
                {status === 'REABRIR' ? 'Reabrir OT' : statusLabel(status)}
              </button>
            ))}
          </div>
        )}
      />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <WorkOrderSection title="Estado y ciclo de vida" subtitle="Gestiona el avance de la OT hasta su validación final" icon={ClipboardCheck} badge={<WorkOrderStatusBadge status={row.estado} />} defaultOpen>
        <WorkOrderInfoGrid columns={4}>
          <WorkOrderInfoItem label="Estado" value={<WorkOrderStatusBadge status={row.estado} />} important />
          <WorkOrderInfoItem label="Prioridad" value={<WorkOrderPriorityBadge priority={row.prioridad} />} important />
          <WorkOrderInfoItem label="Tipo" value={workOrderTypeLabel(row.tipo_ot || row.tipo)} important />
          <WorkOrderInfoItem label="Técnico asignado" value={row.assigned?.nombre || row.assigned?.email || 'Sin asignar'} important />
          {row.tipo_ot_detalle && <WorkOrderInfoItem label="Detalle tipo" value={row.tipo_ot_detalle} />}
          <WorkOrderInfoItem label="Creada por" value={row.creator?.nombre || row.creator?.email || '-'} />
          <WorkOrderInfoItem label="Duración estimada" value={row.duracion_estimada_minutos ? `${row.duracion_estimada_minutos} min` : '-'} />
        </WorkOrderInfoGrid>
        <div className="ot-info-group">
          <h3>Planificación temporal</h3>
          <WorkOrderInfoGrid columns={4}>
            <WorkOrderInfoItem label="Fecha prevista" value={row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-'} important />
            <WorkOrderInfoItem label="Fecha límite" value={row.fecha_limite ? formatDateTime(row.fecha_limite) : '-'} important />
            <WorkOrderInfoItem label="Inicio" value={row.fecha_inicio ? formatDateTime(row.fecha_inicio) : '-'} />
            <WorkOrderInfoItem label="Fin" value={row.fecha_fin ? formatDateTime(row.fecha_fin) : '-'} />
          </WorkOrderInfoGrid>
        </div>
        <div className="ot-info-group">
          <h3>Revisión administrativa</h3>
          <WorkOrderInfoGrid columns={3}>
            <WorkOrderInfoItem label="Revisión admin" value={row.revision_admin_estado || 'no_requerida'} important />
            <WorkOrderInfoItem label="Validada el" value={row.closed_at ? formatDateTime(row.closed_at) : '-'} />
            <WorkOrderInfoItem label="Notas" value={row.revision_admin_notas || '-'} wide />
          </WorkOrderInfoGrid>
        </div>
        {statusTransitionHelp(row.estado) && <p className="ot-context-note">{statusTransitionHelp(row.estado)}</p>}
        {isClosed && <p className="warning-text">OT cerrada: solo lectura. Para modificarla debe reabrirse con motivo y permisos.</p>}
      </WorkOrderSection>

      <WorkOrderSection
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
      </WorkOrderSection>

      <WorkOrderSection title="Instalación y activo" subtitle="Destino de la orden de trabajo" icon={Navigation} defaultOpen={false}>
        <WorkOrderInfoGrid columns={4}>
          <WorkOrderInfoItem label="Instalación" value={row.instalaciones?.nombre || '-'} important />
          <WorkOrderInfoItem label="Dirección" value={row.instalaciones?.direccion || '-'} wide />
          <WorkOrderInfoItem label="Contacto" value={row.instalaciones?.contacto_nombre || '-'} />
          <WorkOrderInfoItem label="Teléfono" value={row.instalaciones?.contacto_telefono || '-'} />
          <WorkOrderInfoItem label="Ubicación" value={row.ubicaciones?.nombre || '-'} />
          <WorkOrderInfoItem label="Activo" value={row.activos?.nombre || '-'} important />
          <WorkOrderInfoItem label="Marca / modelo" value={[row.activos?.marca, row.activos?.modelo].filter(Boolean).join(' / ') || '-'} />
          <WorkOrderInfoItem label="Nº serie" value={row.activos?.numero_serie || '-'} />
        </WorkOrderInfoGrid>
        <InstallationContactPanel installation={row.instalaciones} />
      </WorkOrderSection>

      <WorkOrderSection title="Descripción del trabajo" subtitle="Síntomas, trabajo solicitado, instrucciones y resultado esperado" icon={ClipboardCheck} defaultOpen={false}>
        <p>{row.descripcion || 'Sin descripcion adicional.'}</p>
        <WorkOrderInfoGrid columns={2}>
          <WorkOrderInfoItem label="Síntomas / situación" value={row.sintomas || '-'} wide />
          <WorkOrderInfoItem label="Trabajo solicitado" value={row.trabajo_solicitado || '-'} wide />
          <WorkOrderInfoItem label="Instrucciones técnico" value={row.instrucciones_tecnico || '-'} wide />
          <WorkOrderInfoItem label="Riesgos / precauciones" value={row.riesgos_precauciones || '-'} wide />
          <WorkOrderInfoItem label="Resultado esperado" value={row.resultado_esperado || '-'} wide />
        </WorkOrderInfoGrid>
      </WorkOrderSection>

      <WorkOrderSection
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
      </WorkOrderSection>

      <WorkOrderSection title="Requisitos de cierre" subtitle="Checklist, fotos, firma, mediciones e informe" icon={CheckCircle2} badge={`${requirements.length}`} defaultOpen={false}>
        {requirements.length === 0 ? <p className="muted">Esta OT no tiene bloques obligatorios configurados.</p> : <div className="requirement-grid">{requirements.map(([field, label]) => <span className="badge ok" key={field}>{label}</span>)}</div>}
      </WorkOrderSection>

      <WorkOrderSection title="Trabajo en campo" subtitle="Ejecución de la intervención, checklist, firma e informe" icon={ClipboardCheck} defaultOpen>
        <p className="ot-field-work-note">
          La intervención es el parte de campo del técnico: abrir o continuar visita, registrar tiempos, observaciones, materiales, fotos y resultado. El checklist queda como bloque de comprobaciones.
        </p>
        <div className="ot-next-actions">
          <Link className="secondary-button" to="/scanner">Escanear QR</Link>
          {!isClosed && <Link className="primary-button" to={`/ots/${row.id}/visita`}>Registrar intervención</Link>}
          {row.configuracion?.requiere_checklist && <Link className="secondary-button" to={`/ots/${row.id}/checklist`}>Checklist</Link>}
          {row.configuracion?.requiere_firma_cliente && <Link className="secondary-button" to={`/ots/${row.id}/firma`}>Firma cliente</Link>}
          {row.configuracion?.requiere_informe && <Link className="secondary-button" to={`/ots/${row.id}/informe`}>Informe PDF</Link>}
        </div>
      </WorkOrderSection>

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
