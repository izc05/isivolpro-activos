import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, PlayCircle, PlusCircle, RefreshCw, Save, StopCircle } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import {
  ASSET_FINAL_STATUSES,
  createVisitMaterial,
  finishWorkOrderVisit,
  getWorkOrder,
  listVisitMaterials,
  listWorkOrderVisits,
  MATERIAL_MOVEMENT_TYPES,
  startWorkOrderVisit,
  updateWorkOrderVisit,
  VISIT_CLOSE_RESULTS,
  VISIT_TYPES,
  WORK_ORDER_TYPE_LABELS
} from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';

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
  const { activeTenantId } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [visits, setVisits] = useState([]);
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!activeTenantId || !id) return;
    setLoading(true);
    try {
      const [orderData, visitData] = await Promise.all([
        getWorkOrder(activeTenantId, id),
        listWorkOrderVisits(activeTenantId, id)
      ]);
      setWorkOrder(orderData);
      setVisits(visitData);
      const currentVisit = visitData.find((visit) => visit.estado === 'EN_CURSO') || null;
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
  }, [activeTenantId, id]);

  const canStartVisit = useMemo(() => !activeVisit && workOrder && !['CERRADA', 'CANCELADA'].includes(workOrder.estado), [activeVisit, workOrder]);
  const hasPreviousVisits = visits.some((visit) => visit.estado === 'FINALIZADA');

  async function startVisit() {
    if (!workOrder) return;
    setError('');
    setSaving(true);
    try {
      const location = await getBrowserLocation();
      const visit = await startWorkOrderVisit(workOrder, location, visitDraft);
      setActiveVisit(visit);
      setObservations('');
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
    setError('');
    setSaving(true);
    try {
      await finishWorkOrderVisit(activeVisit, { ...visitDraft, ...finishDraft, observaciones });
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
      <PageHeader
        title={`Intervencion ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}`}
        subtitle={workOrder.titulo}
        action={<button className="ghost-button" onClick={() => navigate(`/ots/${workOrder.id}`)}>Volver a OT</button>}
      />
      {error && <p className="error-text">{error}</p>}

      <div className="grid two">
        <section className="card">
          <h2 className="section-heading">Trabajo asignado</h2>
          <div className="detail-list">
            <Detail label="Estado" value={<WorkOrderStatusBadge status={workOrder.estado} />} />
            <Detail label="Instalacion" value={workOrder.instalaciones?.nombre || '-'} />
            <Detail label="Ubicacion" value={workOrder.ubicaciones?.nombre || '-'} />
            <Detail label="Activo" value={workOrder.activos?.nombre || '-'} />
            <Detail label="Tipo OT" value={WORK_ORDER_TYPE_LABELS[workOrder.tipo_ot || workOrder.tipo] || workOrder.tipo || '-'} />
            <Detail label="Prioridad" value={workOrder.prioridad || '-'} />
            <Detail label="Tecnico asignado" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} />
          </div>
          <p className="muted">{workOrder.descripcion || 'Sin descripcion adicional.'}</p>
          {workOrder.instrucciones_tecnico && <p><strong>Instrucciones:</strong> {workOrder.instrucciones_tecnico}</p>}
          {workOrder.riesgos_precauciones && <p className="warning-text">{workOrder.riesgos_precauciones}</p>}
        </section>

        <section className="card">
          <h2 className="section-heading">Intervencion en campo</h2>
          {!activeVisit && (
            <>
              <p className="muted">
                {hasPreviousVisits
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
                {hasPreviousVisits ? <><PlusCircle size={18} /> Nueva intervencion</> : <><PlayCircle size={18} /> Iniciar visita</>}
              </button>
              {!canStartVisit && workOrder && (
                <p className="muted">Solo se bloquean nuevas intervenciones cuando la OT esta cerrada o cancelada.</p>
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
                <Link className="secondary-button" to={`/ots/${workOrder.id}/checklist`}>Abrir checklist</Link>
                <button className="primary-button" type="button" disabled={saving} onClick={() => setFinishOpen(true)}><StopCircle size={18} /> Finalizar intervencion</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {activeVisit && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="section-heading">Materiales de la visita</h2>
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
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading"><Clock size={18} /> Historial de intervenciones</h2>
        <DataTable
          columns={[
            { key: 'fecha_inicio', label: 'Inicio', render: (row) => formatDateTime(row.fecha_inicio) },
            { key: 'fecha_fin', label: 'Fin', render: (row) => row.fecha_fin ? formatDateTime(row.fecha_fin) : '-' },
            { key: 'tecnico', label: 'Tecnico', render: (row) => row.tecnico?.nombre || row.tecnico?.email || '-' },
            { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{row.estado}</span> },
            { key: 'observaciones', label: 'Observaciones', render: (row) => row.observaciones || '-' }
          ]}
          rows={visits}
          empty="Sin intervenciones registradas"
        />
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Checklist de visita</h2>
        <p className="muted">Rellena los puntos de revision con OK, No OK o No aplica. Puedes adjuntar fotos por punto y continuar con firma/PDF cuando corresponda.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to={`/ots/${workOrder.id}`}>Ver detalle OT</Link>
          <Link className="primary-button" to={`/ots/${workOrder.id}/checklist`}>Abrir checklist</Link>
        </div>
      </section>

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
