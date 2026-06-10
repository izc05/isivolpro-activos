import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { getWorkOrder, updateWorkOrderStatus, WORK_ORDER_STATUSES } from '../services/workOrderService';
import { formatDateTime } from '../utils/dateUtils';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!activeTenantId || !id) return;
    setLoading(true);
    try {
      const data = await getWorkOrder(activeTenantId, id);
      setRow(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, id]);

  async function changeStatus(status) {
    if (!row) return;
    setError('');
    try {
      const updated = await updateWorkOrderStatus(row, status);
      setRow((current) => ({ ...current, ...updated }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Cargando orden de trabajo...</p>;
  if (!row) return <p className="error-text">No se ha encontrado la orden de trabajo.</p>;

  return (
    <>
      <PageHeader
        title={row.codigo_ot || `OT ${row.id.slice(0, 8)}`}
        subtitle={row.titulo}
        action={<button className="ghost-button" onClick={() => navigate('/ots')}>Volver</button>}
      />
      {error && <p className="error-text">{error}</p>}

      <div className="grid two">
        <section className="card">
          <h2 className="section-heading">Estado de la OT</h2>
          <div className="detail-list">
            <Detail label="Estado" value={<WorkOrderStatusBadge status={row.estado} />} />
            <Detail label="Prioridad" value={<span className={`badge ${row.prioridad === 'urgente' ? 'danger' : row.prioridad === 'alta' ? 'warn' : ''}`}>{row.prioridad}</span>} />
            <Detail label="Tipo" value={row.tipo || '-'} />
            <Detail label="Tecnico asignado" value={row.assigned?.nombre || row.assigned?.email || 'Sin asignar'} />
            <Detail label="Creada por" value={row.creator?.nombre || row.creator?.email || '-'} />
            <Detail label="Fecha prevista" value={row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-'} />
            <Detail label="Inicio" value={row.fecha_inicio ? formatDateTime(row.fecha_inicio) : '-'} />
            <Detail label="Fin" value={row.fecha_fin ? formatDateTime(row.fecha_fin) : '-'} />
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {WORK_ORDER_STATUSES.map((status) => (
              <button
                key={status}
                className={row.estado === status ? 'primary-button' : 'secondary-button'}
                type="button"
                onClick={() => changeStatus(status)}
              >
                {status.replaceAll('_', ' ').toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-heading">Instalacion y activo</h2>
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
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Descripcion del trabajo</h2>
        <p>{row.descripcion || 'Sin descripcion adicional.'}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Trabajo en campo</h2>
        <p className="muted">Desde aqui puedes abrir la visita, rellenar el checklist y preparar el informe final.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to="/scanner">Escanear QR</Link>
          <Link className="secondary-button" to={`/ots/${row.id}/visita`}>Abrir visita</Link>
          <Link className="primary-button" to={`/ots/${row.id}/checklist`}>Checklist</Link>
          <button className="secondary-button" disabled>Fotos proximamente</button>
          <button className="secondary-button" disabled>Firma/PDF proximamente</button>
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
