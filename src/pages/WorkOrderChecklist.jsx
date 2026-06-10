import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import {
  CHECKLIST_RESULTS,
  createChecklistItem,
  ensureDefaultChecklist,
  getWorkOrder,
  listWorkOrderChecklist,
  listWorkOrderVisits,
  updateChecklistItem
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
  const { activeTenantId } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState(newItemInitial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  async function refresh() {
    if (!activeTenantId || !id) return;
    setLoading(true);
    try {
      const [orderData, checklistData, visitData] = await Promise.all([
        getWorkOrder(activeTenantId, id),
        listWorkOrderChecklist(activeTenantId, id),
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
  }, [activeTenantId, id]);

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

  if (loading) return <p className="muted">Cargando checklist...</p>;
  if (!workOrder) return <p className="error-text">No se ha encontrado la OT.</p>;

  return (
    <>
      <PageHeader
        title={`Checklist ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}`}
        subtitle={workOrder.titulo}
        action={<button className="ghost-button" onClick={() => navigate(`/ots/${workOrder.id}`)}>Volver a OT</button>}
      />
      {error && <p className="error-text">{error}</p>}

      <section className="card">
        <div className="grid two">
          <div>
            <h2 className="section-heading">Resumen</h2>
            <div className="detail-list">
              <Detail label="Estado OT" value={<WorkOrderStatusBadge status={workOrder.estado} />} />
              <Detail label="Instalacion" value={workOrder.instalaciones?.nombre || '-'} />
              <Detail label="Activo" value={workOrder.activos?.nombre || '-'} />
              <Detail label="Progreso" value={`${progress.done}/${progress.total} (${progress.percent}%)`} />
              <Detail label="OK" value={progress.ok} />
              <Detail label="No OK" value={progress.failed} />
            </div>
          </div>
          <div>
            <h2 className="section-heading">Visita asociada</h2>
            <FormField label="Asignar respuestas a visita">
              <select value={selectedVisitId} onChange={(event) => setSelectedVisitId(event.target.value)}>
                <option value="">Sin visita concreta</option>
                {visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>{new Date(visit.fecha_inicio).toLocaleString()} - {visit.estado}</option>
                ))}
              </select>
            </FormField>
            <p className="muted">Si el tecnico ha iniciado visita, las respuestas del checklist quedaran vinculadas a esa visita.</p>
            <div className="quick-actions">
              <button className="secondary-button" type="button" onClick={generateDefaultChecklist}>Generar checklist base</button>
              <button className="primary-button" type="button" onClick={() => setOpen(true)}>Añadir punto</button>
            </div>
          </div>
        </div>
      </section>

      <div className="checklist-stack" style={{ marginTop: 16 }}>
        {items.length === 0 && (
          <section className="card">
            <p className="muted">Esta OT todavia no tiene checklist. Pulsa “Generar checklist base” o añade puntos manualmente.</p>
          </section>
        )}
        {items.map((item) => (
          <ChecklistItemCard key={item.id} item={item} saving={savingId === item.id} onUpdate={updateItem} />
        ))}
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Siguiente bloque</h2>
        <p className="muted">El siguiente paso sera añadir fotos reales por punto del checklist, usando el campo “requiere foto” como control.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to={`/ots/${workOrder.id}/visita`}>Abrir visita</Link>
          <button className="secondary-button" disabled>Fotos proximamente</button>
        </div>
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

function ChecklistItemCard({ item, saving, onUpdate }) {
  const [observation, setObservation] = useState(item.observacion || '');

  useEffect(() => {
    setObservation(item.observacion || '');
  }, [item.observacion]);

  return (
    <section className="card">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-heading">{item.punto}. {item.descripcion}</h2>
          <p className="muted">{item.requiere_foto ? 'Foto requerida en el siguiente paso' : 'Foto opcional'}</p>
        </div>
        <span className={`badge ${RESULT_BADGES[item.resultado] || ''}`}>{RESULT_LABELS[item.resultado] || item.resultado}</span>
      </div>
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
        <div className="form-actions">
          <button className="secondary-button" type="button" disabled={saving} onClick={() => onUpdate(item, { observacion: observation })}>Guardar punto</button>
        </div>
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
