import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, Download, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { getWorkOrder } from '../services/workOrderService';
import { generateAndUploadWorkOrderPdf, generateWorkOrderPdfBlob, listWorkOrderReports, signedWorkOrderReportUrl } from '../services/workOrderPdfService';
import { formatDateTime } from '../utils/dateUtils';

export default function WorkOrderReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportUrls, setReportUrls] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function refresh() {
    if (tenantLoading) return;
    if (!activeTenantId || !id) {
      setLoading(false);
      setError('No se ha encontrado una empresa activa para cargar el informe.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [orderData, reportData] = await Promise.all([getWorkOrder(activeTenantId, id), listWorkOrderReports(activeTenantId, id)]);
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
  }, [activeTenantId, tenantLoading, id]);

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function generateReport() {
    if (!activeTenantId || !workOrder) return;
    setError('');
    setMessage('');
    setGenerating(true);
    try {
      await generateAndUploadWorkOrderPdf(activeTenantId, workOrder.id);
      setMessage('Informe generado correctamente. La OT queda preparada como finalizada para validacion del administrador.');
      await refresh();
    } catch (err) {
      try {
        const { blob, filename } = await generateWorkOrderPdfBlob(activeTenantId, workOrder.id);
        downloadBlob(blob, filename);
        setMessage('No se pudo guardar el PDF en Supabase, pero se ha descargado una copia local.');
      } catch (fallbackError) {
        setError(`${err.message}. Ademas, no se pudo descargar copia local: ${fallbackError.message}`);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function downloadLocal() {
    if (!activeTenantId || !workOrder) return;
    setError('');
    setGenerating(true);
    try {
      const { blob, filename } = await generateWorkOrderPdfBlob(activeTenantId, workOrder.id);
      downloadBlob(blob, filename);
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
        title={`Informe ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}`}
        subtitle="Genera el PDF final de la OT con visitas, checklist, materiales, fotos y firma."
        action={<button className="ghost-button" onClick={() => navigate(`/ots/${workOrder.id}`)}>Volver a OT</button>}
      />
      {error && <p className="error-text"><CircleAlert size={16} /> {error}</p>}
      {message && <p className="success-text">{message}</p>}

      <section className="card">
        <h2 className="section-heading">Estado del informe</h2>
        <div className="detail-list">
          <div className="detail-row"><span className="muted">OT</span><strong>{workOrder.codigo_ot || workOrder.id}</strong></div>
          <div className="detail-row"><span className="muted">Estado</span><strong><WorkOrderStatusBadge status={workOrder.estado} /></strong></div>
          <div className="detail-row"><span className="muted">Tecnico</span><strong>{workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'}</strong></div>
        </div>
        <div className="quick-actions">
          <button className="primary-button" type="button" disabled={generating} onClick={generateReport}>{generating ? <Loader2 size={18} /> : <FileText size={18} />} Generar y guardar PDF</button>
          <button className="secondary-button" type="button" disabled={generating} onClick={downloadLocal}><Download size={18} /> Descargar copia local</button>
          <Link className="secondary-button" to={`/ots/${workOrder.id}/firma`}><ShieldCheck size={18} /> Firma cliente</Link>
          <Link className="ghost-button" to={`/ots/${workOrder.id}/checklist`}><RefreshCw size={18} /> Revisar checklist</Link>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-heading">Informes guardados</h2>
        <DataTable
          columns={[
            { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) },
            { key: 'filename', label: 'Archivo' },
            { key: 'created_by', label: 'Creado por', render: (row) => row.created_by_profile?.nombre || row.created_by_profile?.email || '-' },
            { key: 'actions', label: 'Acciones', render: (row) => reportUrls[row.id] ? <a className="secondary-button" href={reportUrls[row.id]} target="_blank" rel="noreferrer">Abrir</a> : '-' }
          ]}
          rows={reports}
          empty="Todavia no hay informes guardados"
        />
      </section>
    </>
  );
}
