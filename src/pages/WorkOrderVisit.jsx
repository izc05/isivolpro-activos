import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import {
  finishWorkOrderVisit,
  getWorkOrder,
  listWorkOrderVisits,
  startWorkOrderVisit,
  updateWorkOrderVisit
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

  async function startVisit() {
    if (!workOrder) return;
    setError('');
    setSaving(true);
    try {
      const location = await getBrowserLocation();
      const visit = await startWorkOrderVisit(workOrder, location);
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
      const updated = await updateWorkOrderVisit(activeVisit, { observaciones: observations });
      setActiveVisit(updated);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function finishVisit() {
    if (!activeVisit) return;
    if (!window.confirm('Finalizar esta visita? Despues podras abrir una nueva visita si hace falta.')) return;
    setError('');
    setSaving(true);
    try {
      await finishWorkOrderVisit(activeVisit, observations);
      setActiveVisit(null);
      setObservations('');
      await refresh();
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
        title={`Visita ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}`}
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
            <Detail label="Prioridad" value={workOrder.prioridad || '-'} />
            <Detail label="Tecnico asignado" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} />
          </div>
          <p className="muted">{workOrder.descripcion || 'Sin descripcion adicional.'}</p>
        </section>

        <section className="card">
          <h2 className="section-heading">Visita en campo</h2>
          {!activeVisit && (
            <>
              <p className="muted">Pulsa iniciar cuando llegues a la instalacion. Si el movil lo permite, se guardara la ubicacion aproximada.</p>
              <button className="primary-button" type="button" disabled={!canStartVisit || saving} onClick={startVisit}>Iniciar visita</button>
            </>
          )}
          {activeVisit && (
            <div className="form-grid">
              <div className="detail-list">
                <Detail label="Inicio" value={formatDateTime(activeVisit.fecha_inicio)} />
                <Detail label="Ubicacion" value={activeVisit.latitud && activeVisit.longitud ? `${activeVisit.latitud}, ${activeVisit.longitud}` : 'No registrada'} />
              </div>
              <FormField label="Observaciones de la visita">
                <textarea rows="7" value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Anota trabajos realizados, pruebas, incidencias, material pendiente o indicaciones del cliente" />
              </FormField>
              <div className="form-actions">
                <button className="secondary-button" type="button" disabled={saving} onClick={saveVisit}>Guardar observaciones</button>
                <Link className="secondary-button" to={`/ots/${workOrder.id}/checklist`}>Abrir checklist</Link>
                <button className="primary-button" type="button" disabled={saving} onClick={finishVisit}>Finalizar visita</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Historial de visitas</h2>
        <DataTable
          columns={[
            { key: 'fecha_inicio', label: 'Inicio', render: (row) => formatDateTime(row.fecha_inicio) },
            { key: 'fecha_fin', label: 'Fin', render: (row) => row.fecha_fin ? formatDateTime(row.fecha_fin) : '-' },
            { key: 'tecnico', label: 'Tecnico', render: (row) => row.tecnico?.nombre || row.tecnico?.email || '-' },
            { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{row.estado}</span> },
            { key: 'observaciones', label: 'Observaciones', render: (row) => row.observaciones || '-' }
          ]}
          rows={visits}
          empty="Sin visitas registradas"
        />
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Checklist de visita</h2>
        <p className="muted">Rellena los puntos de revision con OK, No OK o No aplica. En el siguiente paso añadiremos fotos por punto.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to={`/ots/${workOrder.id}`}>Ver detalle OT</Link>
          <Link className="primary-button" to={`/ots/${workOrder.id}/checklist`}>Abrir checklist</Link>
        </div>
      </section>
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
