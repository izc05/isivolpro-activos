import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Mail, MapPin, Navigation, Phone, PlayCircle, PlusCircle, Save, StopCircle } from 'lucide-react';
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
  ASSET_FINAL_STATUSES,
  createVisitMaterial,
  finishWorkOrderVisit,
  getWorkOrder,
  listWorkOrderChecklist,
  listVisitMaterials,
  listWorkOrderVisits,
  MATERIAL_MOVEMENT_TYPES,
  startWorkOrderVisit,
  updateWorkOrderVisit,
  VISIT_CLOSE_RESULTS,
  VISIT_TYPES,
  WORK_ORDER_TYPE_LABELS
} from '../services/workOrderService';
import { updateWorkOrderLifecycleStatus } from '../services/workOrderLifecycleService';
import { formatDateTime } from '../utils/dateUtils';
import { buildMapsEmbedUrl, buildMapsUrl } from '../utils/mapUtils';
import { getWorkOrderChecklistProgress, normalizedStatus } from '../utils/workOrderLifecycle';

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export default function WorkOrderVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [visits, setVisits] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [observations, setObservations] = useState('');
  const [visitDraft, setVisitDraft] = useState({
    tipo_visita: 'diagnostico',
    tipo_visita_detalle: '',
    estado_inicial: '',
    situacion_encontrada: '',
    trabajo_realizado: '',
    diagnostico: '',
    causa: '',
    pruebas_realizadas: '',
    recomendaciones: '',
    trabajo_pendiente: '',
    estado_final_activo: 'no_comprobado'
  });
  const [finishDraft, setFinishDraft] = useState({
    resultado_cierre: 'trabajo_completado',
    motivo_cierre: '',
    proxima_accion: '',
    proximo_tipo_visita: '',
    estado_final_activo: 'no_comprobado'
  });
  const [finishOpen, setFinishOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialDraft, setMaterialDraft] = useState({
    descripcion_libre: '',
    referencia: '',
    cantidad: '1',
    unidad: 'ud',
    tipo_movimiento: 'utilizado',
    numero_serie: '',
    observaciones: ''
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (tenantLoading) return;
    if (!activeTenantId || !id) {
      setLoading(false);
      setError('No se ha encontrado una empresa activa para cargar la intervención.');
      return;
    }
    setLoading(true);
    try {
      const [orderData, visitData, checklistData] = await Promise.all([
        getWorkOrder(activeTenantId, id),
        listWorkOrderVisits(activeTenantId, id),
        listWorkOrderChecklist(activeTenantId, id)
      ]);
      setWorkOrder(orderData);
      setVisits(visitData);
      setChecklistItems(checklistData);
      const orderIsReadOnly = ['FINALIZADA', 'VALIDADA', 'CANCELADA'].includes(normalizedStatus(orderData.estado));
      const currentVisit = orderIsReadOnly ? null : visitData.find((visit) => visit.estado === 'EN_CURSO') || null;
      setActiveVisit(currentVisit);
      setObservations(currentVisit?.observaciones || '');
      setVisitDraft((current) => ({
        ...current,
        tipo_visita: currentVisit?.tipo_visita || orderData.tipo_ot || orderData.tipo || current.tipo_visita,
        tipo_visita_detalle: currentVisit?.tipo_visita_detalle || '',
        estado_inicial: currentVisit?.estado_inicial || '',
        situacion_encontrada: currentVisit?.situacion_encontrada || '',
        trabajo_realizado: currentVisit?.trabajo_realizado || '',
        diagnostico: currentVisit?.diagnostico || '',
        causa: currentVisit?.causa || '',
        pruebas_realizadas: currentVisit?.pruebas_realizadas || '',
        recomendaciones: currentVisit?.recomendaciones || '',
        trabajo_pendiente: currentVisit?.trabajo_pendiente || '',
        estado_final_activo: currentVisit?.estado_final_activo || 'no_comprobado'
      }));
      if (currentVisit) setMaterials(await listVisitMaterials(activeTenantId, currentVisit.id));
      else setMaterials([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, tenantLoading, id]);

  const status = normalizedStatus(workOrder?.estado);
  const isReadOnly = ['FINALIZADA', 'VALIDADA', 'CANCELADA'].includes(status);
  const needsAcceptance = status === 'ASIGNADA';
  const canAcceptWorkOrder = Boolean(workOrder && needsAcceptance && !activeVisit);
  const canStartVisit = useMemo(() => !activeVisit && workOrder && ['ACEPTADA', 'EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'].includes(status), [activeVisit, workOrder, status]);
  const hasPreviousVisits = visits.some((visit) => visit.estado === 'FINALIZADA');
  const checklistProgress = getWorkOrderChecklistProgress(workOrder, checklistItems);
  const checklistComplete = checklistProgress.complete;
  const checklistAvailable = checklistProgress.available;
  const checklistDone = checklistProgress.completed;

  async function acceptWorkOrder() {
    if (!workOrder) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const updated = await updateWorkOrderLifecycleStatus(workOrder, 'ACEPTADA');
      setWorkOrder((current) => ({ ...current, ...updated }));
      setMessage('OT aceptada. Ahora puedes iniciar la intervención cuando llegues a la instalación.');
      await refresh();
    } catch (err) {
      setError('No se ha podido aceptar la OT. Revisa la conexión e inténtalo de nuevo.');
      console.error('Error aceptando OT', err);
    } finally {
      setSaving(false);
    }
  }

  async function startVisit() {
    if (!workOrder) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const location = await getBrowserLocation();
      const visit = await startWorkOrderVisit(workOrder, location, visitDraft);
      setActiveVisit(visit);
      setObservations('');
      setMessage('Intervención iniciada correctamente.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveVisit() {
    if (!activeVisit) return;
    setError('');
    setSaving(true);
    try {
      const updated = await updateWorkOrderVisit(activeVisit, { ...visitDraft, observaciones: observations });
      setActiveVisit(updated);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function finishVisit(event) {
    event.preventDefault();
    if (!activeVisit) return;
    if (!checklistComplete) {
      setFinishOpen(false);
      setError('Debes completar todos los puntos del checklist antes de finalizar la intervención.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await finishWorkOrderVisit(activeVisit, { ...visitDraft, ...finishDraft, observaciones: observations });
      setActiveVisit(null);
      setObservations('');
      setFinishOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateVisitDraft(field, value) {
    setVisitDraft((current) => ({ ...current, [field]: value }));
  }

  function updateFinishDraft(field, value) {
    setFinishDraft((current) => ({ ...current, [field]: value }));
  }

  function updateMaterialDraft(field, value) {
    setMaterialDraft((current) => ({ ...current, [field]: value }));
  }

  async function addMaterial(event) {
    event.preventDefault();
    if (!activeVisit) return;
    setError('');
    setSaving(true);
    try {
      await createVisitMaterial(workOrder, activeVisit, materialDraft);
      setMaterialDraft({
        descripcion_libre: '',
        referencia: '',
        cantidad: '1',
        unidad: 'ud',
        tipo_movimiento: 'utilizado',
        numero_serie: '',
        observaciones: ''
      });
      setMaterials(await listVisitMaterials(activeTenantId, activeVisit.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Cargando visita...</p>;
  if (!workOrder) return <p className="error-text">No se ha encontrado la OT.</p>;

  return (
    <>
      <WorkOrderPageHeader workOrder={workOrder} titlePrefix="Intervención de campo" onBack={() => navigate(`/ots/${workOrder.id}`)} />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <div className="grid two">
        <WorkOrderSection key={`assigned-${activeVisit?.id || 'pending'}`} title="Trabajo asignado" subtitle="Contexto operativo de la intervención" icon={WrenchIcon} badge={<WorkOrderStatusBadge status={workOrder.estado} />} defaultOpen={false}>
          <WorkOrderInfoGrid columns={2}>
            <WorkOrderInfoItem label="Estado" value={<WorkOrderStatusBadge status={workOrder.estado} />} important />
            <WorkOrderInfoItem label="Prioridad" value={<WorkOrderPriorityBadge priority={workOrder.prioridad} />} important />
            <WorkOrderInfoItem label="Ubicación" value={workOrder.ubicaciones?.nombre || '-'} />
            <WorkOrderInfoItem label="Activo" value={workOrder.activos?.nombre || '-'} important />
            <WorkOrderInfoItem label="Tipo OT" value={WORK_ORDER_TYPE_LABELS[workOrder.tipo_ot || workOrder.tipo] || workOrder.tipo || '-'} />
            <WorkOrderInfoItem label="Técnico asignado" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} important />
          </WorkOrderInfoGrid>
          <p className="muted">{workOrder.descripcion || 'Sin descripcion adicional.'}</p>
          {workOrder.instrucciones_tecnico && <p><strong>Instrucciones:</strong> {workOrder.instrucciones_tecnico}</p>}
          {workOrder.riesgos_precauciones && <p className="warning-text">{workOrder.riesgos_precauciones}</p>}
        </WorkOrderSection>

        <InstallationFieldCard key={`installation-${activeVisit?.id || 'pending'}`} installation={workOrder.instalaciones} readOnly={isReadOnly} />

        <WorkOrderSection className="ot-field-intervention" key={`field-${activeVisit?.id || 'pending'}`} title="Intervención en campo" subtitle="1. Acepta la OT · 2. Inicia al llegar · 3. Registra y finaliza" icon={PlayCircle} defaultOpen={!isReadOnly && !activeVisit}>
          {!isReadOnly && <ol className="field-flow-steps" aria-label="Pasos de intervención">
            <li className={needsAcceptance ? 'active' : 'done'}>Aceptar OT</li>
            <li className={!needsAcceptance && !activeVisit ? 'active' : activeVisit ? 'done' : ''}>Iniciar intervención</li>
            <li className={activeVisit ? 'active' : ''}>Completar datos</li>
          </ol>}
          {isReadOnly && (
            <div className="workorder-alert success ot-readonly-notice">
              <CheckCircle2 size={20} />
              <p><strong>OT finalizada.</strong> Esta pantalla es únicamente de consulta y no permite realizar cambios.</p>
            </div>
          )}
          {canAcceptWorkOrder && (
            <div className="workorder-alert info">
              <CheckCircle2 size={20} />
              <p>Antes de iniciar, confirma que aceptas esta OT. El administrador verá la confirmación en movimientos recientes.</p>
              <button className="primary-button" type="button" disabled={saving} onClick={acceptWorkOrder}>
                <CheckCircle2 size={18} /> {saving ? 'Aceptando...' : 'Aceptar OT'}
              </button>
            </div>
          )}
          {!activeVisit && !isReadOnly && (
            <>
              <p className="muted">
                {needsAcceptance
                  ? 'Acepta primero la OT para confirmar que la has recibido y puedes atenderla.'
                  : hasPreviousVisits
                  ? 'Esta OT ya tiene intervenciones finalizadas. Puedes abrir una nueva visita si queda trabajo pendiente, material por revisar o seguimiento.'
                  : 'Pulsa iniciar cuando llegues a la instalacion. Si el movil lo permite, se guardara la ubicacion aproximada.'}
              </p>
              <FormField label="Tipo de visita">
                <select value={visitDraft.tipo_visita} onChange={(event) => updateVisitDraft('tipo_visita', event.target.value)}>
                  {VISIT_TYPES.map((type) => <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type] || type}</option>)}
                </select>
              </FormField>
              {visitDraft.tipo_visita === 'otro' && (
                <FormField label="Detalle de visita">
                  <input value={visitDraft.tipo_visita_detalle} onChange={(event) => updateVisitDraft('tipo_visita_detalle', event.target.value)} />
                </FormField>
              )}
              <button className="primary-button" type="button" disabled={!canStartVisit || saving} onClick={startVisit}>
                {hasPreviousVisits ? <><PlusCircle size={18} /> Nueva intervención</> : <><PlayCircle size={18} /> Iniciar intervención</>}
              </button>
              {!canStartVisit && workOrder && !needsAcceptance && (
                <p className="muted">Solo se bloquean nuevas intervenciones cuando la OT está cerrada o cancelada.</p>
              )}
            </>
          )}
          {activeVisit && (
            <div className="form-grid">
              <div className="detail-list">
                <Detail label="Inicio" value={formatDateTime(activeVisit.fecha_inicio)} />
                <Detail label="Tipo visita" value={WORK_ORDER_TYPE_LABELS[activeVisit.tipo_visita] || activeVisit.tipo_visita || '-'} />
                <Detail label="Ubicacion" value={activeVisit.latitud && activeVisit.longitud ? `${activeVisit.latitud}, ${activeVisit.longitud}` : 'No registrada'} />
              </div>
              <FormField label="Situacion encontrada">
                <textarea rows="3" value={visitDraft.situacion_encontrada} onChange={(event) => updateVisitDraft('situacion_encontrada', event.target.value)} />
              </FormField>
              <FormField label="Diagnostico">
                <textarea rows="3" value={visitDraft.diagnostico} onChange={(event) => updateVisitDraft('diagnostico', event.target.value)} />
              </FormField>
              <FormField label="Causa">
                <textarea rows="2" value={visitDraft.causa} onChange={(event) => updateVisitDraft('causa', event.target.value)} />
              </FormField>
              <FormField label="Trabajo realizado">
                <textarea rows="4" value={visitDraft.trabajo_realizado} onChange={(event) => updateVisitDraft('trabajo_realizado', event.target.value)} />
              </FormField>
              <FormField label="Pruebas / mediciones">
                <textarea rows="3" value={visitDraft.pruebas_realizadas} onChange={(event) => updateVisitDraft('pruebas_realizadas', event.target.value)} />
              </FormField>
              <FormField label="Estado final del activo">
                <select value={visitDraft.estado_final_activo} onChange={(event) => updateVisitDraft('estado_final_activo', event.target.value)}>
                  {ASSET_FINAL_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
              </FormField>
              <FormField label="Observaciones de la visita">
                <textarea rows="7" value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Anota trabajos realizados, pruebas, incidencias, material pendiente o indicaciones del cliente" />
              </FormField>
              <div className="form-actions">
                <button className="secondary-button" type="button" disabled={saving} onClick={saveVisit}><Save size={18} /> Guardar visita</button>
                {checklistAvailable && <Link className="primary-button ot-important-action" to={`/ots/${workOrder.id}/checklist`}><CheckCircle2 size={18} /> Continuar checklist</Link>}
                <button className="primary-button ot-finish-action" type="button" disabled={saving || !checklistComplete} onClick={() => setFinishOpen(true)}><StopCircle size={18} /> Finalizar intervención</button>
              </div>
              {!checklistComplete && (
                <div className="workorder-alert info ot-checklist-required" role="status">
                  <CheckCircle2 size={20} />
                  <p>Completa el checklist antes de finalizar la intervención ({checklistDone}/{checklistItems.length} puntos).</p>
                  <Link className="primary-button" to={`/ots/${workOrder.id}/checklist`}>Ir al checklist</Link>
                </div>
              )}
            </div>
          )}
        </WorkOrderSection>
      </div>

      {activeVisit && (
        <WorkOrderSection key={`materials-${activeVisit.id}`} title="Materiales de la visita" subtitle="Material usado, retirado o pendiente" icon={PlusCircle} defaultOpen={false}>
          <form className="form-grid" onSubmit={addMaterial}>
            <div className="grid two">
              <FormField label="Descripcion libre">
                <input value={materialDraft.descripcion_libre} onChange={(event) => updateMaterialDraft('descripcion_libre', event.target.value)} placeholder="Material utilizado, retirado o pendiente" />
              </FormField>
              <FormField label="Referencia">
                <input value={materialDraft.referencia} onChange={(event) => updateMaterialDraft('referencia', event.target.value)} />
              </FormField>
              <FormField label="Cantidad">
                <input type="number" min="0" step="0.01" value={materialDraft.cantidad} onChange={(event) => updateMaterialDraft('cantidad', event.target.value)} />
              </FormField>
              <FormField label="Unidad">
                <input value={materialDraft.unidad} onChange={(event) => updateMaterialDraft('unidad', event.target.value)} />
              </FormField>
              <FormField label="Movimiento">
                <select value={materialDraft.tipo_movimiento} onChange={(event) => updateMaterialDraft('tipo_movimiento', event.target.value)}>
                  {MATERIAL_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                </select>
              </FormField>
              <FormField label="Numero de serie">
                <input value={materialDraft.numero_serie} onChange={(event) => updateMaterialDraft('numero_serie', event.target.value)} />
              </FormField>
            </div>
            <FormField label="Observaciones">
              <textarea rows="2" value={materialDraft.observaciones} onChange={(event) => updateMaterialDraft('observaciones', event.target.value)} />
            </FormField>
            <div className="form-actions">
              <button className="secondary-button" type="submit" disabled={saving}>Registrar material</button>
            </div>
          </form>
          <DataTable
            columns={[
              { key: 'descripcion_libre', label: 'Material', render: (row) => row.descripcion_libre || row.material_id || '-' },
              { key: 'cantidad', label: 'Cantidad', render: (row) => `${row.cantidad} ${row.unidad}` },
              { key: 'tipo_movimiento', label: 'Tipo', render: (row) => <span className="badge">{row.tipo_movimiento}</span> },
              { key: 'referencia', label: 'Referencia', render: (row) => row.referencia || '-' }
            ]}
            rows={materials}
            empty="Sin materiales registrados"
          />
        </WorkOrderSection>
      )}

      <WorkOrderSection key={`history-${activeVisit?.id || 'pending'}`} title="Historial de intervenciones" subtitle="Visitas realizadas y estado de cada intervención" icon={Clock} defaultOpen={false}>
        <DataTable
          columns={[
            { key: 'fecha_inicio', label: 'Inicio', render: (row) => formatDateTime(row.fecha_inicio) },
            { key: 'fecha_fin', label: 'Fin', render: (row) => row.fecha_fin ? formatDateTime(row.fecha_fin) : isReadOnly && workOrder.fecha_fin ? formatDateTime(workOrder.fecha_fin) : '-' },
            { key: 'tecnico', label: 'Tecnico', render: (row) => row.tecnico?.nombre || row.tecnico?.email || '-' },
            { key: 'estado', label: 'Estado', render: (row) => <span className="badge ok">{isReadOnly && row.estado === 'EN_CURSO' ? 'FINALIZADA' : row.estado}</span> },
            { key: 'observaciones', label: 'Observaciones', render: (row) => row.observaciones || '-' }
          ]}
          rows={visits}
          empty="Sin intervenciones registradas"
        />
      </WorkOrderSection>

      {!isReadOnly && checklistAvailable && <WorkOrderSection title="Checklist de visita" subtitle="Continuación natural de la intervención" icon={Save} defaultOpen={false}>
        <p className="muted">Rellena los puntos de revision con OK, No OK o No aplica. Puedes adjuntar fotos por punto y continuar con firma/PDF cuando corresponda.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to={`/ots/${workOrder.id}`}>Ver detalle OT</Link>
          <Link className="primary-button" to={`/ots/${workOrder.id}/checklist`}>Abrir checklist</Link>
        </div>
      </WorkOrderSection>}

      <Modal title="Finalizar intervencion" open={finishOpen} onClose={() => setFinishOpen(false)}>
        <form className="form-grid" onSubmit={finishVisit}>
          <FormField label="Resultado">
            <select value={finishDraft.resultado_cierre} onChange={(event) => updateFinishDraft('resultado_cierre', event.target.value)}>
              {VISIT_CLOSE_RESULTS.map((result) => <option key={result} value={result}>{result.replaceAll('_', ' ')}</option>)}
            </select>
          </FormField>
          <FormField label="Motivo / justificacion">
            <textarea rows="3" value={finishDraft.motivo_cierre} onChange={(event) => updateFinishDraft('motivo_cierre', event.target.value)} required={finishDraft.resultado_cierre !== 'trabajo_completado'} />
          </FormField>
          <FormField label="Proxima accion">
            <textarea rows="2" value={finishDraft.proxima_accion} onChange={(event) => updateFinishDraft('proxima_accion', event.target.value)} />
          </FormField>
          {finishDraft.resultado_cierre === 'necesita_otra_visita' && (
            <FormField label="Tipo de proxima visita">
              <select value={finishDraft.proximo_tipo_visita} onChange={(event) => updateFinishDraft('proximo_tipo_visita', event.target.value)} required>
                <option value="">Seleccionar</option>
                {VISIT_TYPES.map((type) => <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type] || type}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Estado final del activo">
            <select value={finishDraft.estado_final_activo} onChange={(event) => updateFinishDraft('estado_final_activo', event.target.value)}>
              {ASSET_FINAL_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
          </FormField>
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setFinishOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={saving}>Finalizar</button>
          </div>
        </form>
      </Modal>
    </>
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

function WrenchIcon(props) {
  return <PlayCircle {...props} />;
}

function InstallationFieldCard({ installation, readOnly = false }) {
  const mapsUrl = buildMapsUrl(installation);
  const embedUrl = buildMapsEmbedUrl(installation);
  const phone = installation?.contacto_telefono;
  const email = installation?.contacto_email;

  return (
    <WorkOrderSection title="Instalación y contacto" subtitle="Datos de acceso y comunicación" icon={MapPin} defaultOpen={false}>
      <WorkOrderInfoGrid columns={2}>
        <WorkOrderInfoItem label="Instalación" value={installation?.nombre || '-'} important />
        <WorkOrderInfoItem label="Dirección" value={installation?.direccion || '-'} wide />
        <WorkOrderInfoItem label="Contacto" value={installation?.contacto_nombre || '-'} />
        <WorkOrderInfoItem label="Teléfono" value={phone || '-'} />
        <WorkOrderInfoItem label="Email" value={email || '-'} />
      </WorkOrderInfoGrid>
      {!readOnly && <div className="quick-actions">
        {mapsUrl && (
          <a className="secondary-button" href={mapsUrl} target="_blank" rel="noreferrer">
            <Navigation size={18} /> Como llegar
          </a>
        )}
        {phone && (
          <a className="primary-button" href={`tel:${phone}`}>
            <Phone size={18} /> Llamar
          </a>
        )}
        {email && (
          <a className="ghost-button" href={`mailto:${email}`}>
            <Mail size={18} /> Email
          </a>
        )}
      </div>}
      {embedUrl ? (
        <div className="ot-map-frame compact">
          <iframe title={`Mapa de ${installation?.nombre || 'instalacion'}`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      ) : (
        <p className="warning-text">Esta instalacion no tiene direccion ni coordenadas registradas.</p>
      )}
    </WorkOrderSection>
  );
}
