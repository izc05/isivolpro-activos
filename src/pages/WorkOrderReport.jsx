import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { getWorkOrder } from '../services/workOrderService';
import {
  generateAndUploadWorkOrderPdf,
  listWorkOrderReports,
  signedWorkOrderReportUrl
} from '../services/workOrderPdfService';
import { formatDateTime } from '../utils/dateUtils';

export default function WorkOrderReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportUrls, setReportUrls] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function refresh() {
    if (!activeTenantId || !id) return;
    setLoading(true);
    try {
      const [orderData, reportData] = await Promise.all([
        getWorkOrder(activeTenantId, id),
        listWorkOrderReports(activeTenantId, id)
      ]);
      setWorkOrder(orderData);
      setReports(reportData);
      const urls = await Promise.all(reportData.map(async (report) => [report.id, await signedWorkOrderReportUrl(report)]));
      setReportUrls(Object.fromEntries(urls));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, id]);

  async function generateReport() {
    if (!activeTenantId || !workOrder) return;
    setError('');
    setMessage('');
    setGenerating(true);
    try {
      await generateAndUploadWorkOrderPdf(activeTenantId, workOrder.id);
      setMessage('Informe generado correctamente. La OT queda marcada como INFORME_GENERADO.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="muted">Cargando informes...</p>;
  if (!workOrder) return <p className="error-text">No se ha encontrado la OT.</p>;

  return (
    <>
      <PageHeader
        title={`Informe PDF ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}`}
        subtitle={workOrder.titulo}
        action={<button className="ghost-button" onClick={() => navigate(`/ots/${workOrder.id}`)}>Volver a OT</button>}
      />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <div className="grid two">
        <section className="card">
          <h2 className="section-heading">Datos incluidos</h2>
          <div className="detail-list">
            <Detail label="Estado OT" value={<WorkOrderStatusBadge status={workOrder.estado} />} />
            <Detail label="Instalacion" value={workOrder.instalaciones?.nombre || '-'} />
            <Detail label="Activo" value={workOrder.activos?.nombre || '-'} />
            <Detail label="Tecnico" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} />
          </div>
          <p className="muted">El PDF incluye datos generales, visitas, checklist, fotos de puntos y firma si existe.</p>
        </section>

        <section className="card">
          <h2 className="section-heading">Generar informe</h2>
          <p className="muted">Genera una version nueva del PDF y la guarda en Supabase como documento privado.</p>
          <div className="quick-actions">
            <button className="primary-button" type="button" disabled={generating} onClick={generateReport}>
              {generating ? 'Generando PDF...' : 'Generar PDF'}
            </button>
            <Link className="secondary-button" to={`/ots/${workOrder.id}/checklist`}>Revisar checklist</Link>
            <Link className="secondary-button" to={`/ots/${workOrder.id}/firma`}>Revisar firma</Link>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Informes generados</h2>
        <DataTable
          columns={[
            { key: 'filename', label: 'Archivo', render: (row) => row.filename || 'Informe OT' },
            { key: 'created_at', label: 'Fecha', render: (row) => row.created_at ? formatDateTime(row.created_at) : '-' },
            { key: 'created_by', label: 'Usuario', render: (row) => row.created_by_profile?.nombre || row.created_by_profile?.email || '-' },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row) => reportUrls[row.id]
                ? <a className="primary-button" href={reportUrls[row.id]} target="_blank" rel="noreferrer">Abrir / descargar</a>
                : <span className="muted">Preparando enlace...</span>
            }
          ]}
          rows={reports}
          empty="Todavia no hay informes generados"
        />
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
