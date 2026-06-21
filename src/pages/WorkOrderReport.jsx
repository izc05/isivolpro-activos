import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, Download, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import WorkOrderPageHeader from '../components/WorkOrders/WorkOrderPageHeader';
import WorkOrderSection from '../components/WorkOrders/WorkOrderSection';
import { WorkOrderInfoGrid, WorkOrderInfoItem } from '../components/WorkOrders/WorkOrderInfoGrid';
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

  async function downloadSavedReport(report) {
    const url = reportUrls[report.id] || await signedWorkOrderReportUrl(report);
    if (!url) throw new Error('No se pudo preparar la descarga del informe guardado.');
    const link = document.createElement('a');
    link.href = url;
    link.download = report.filename || 'informe-ot.pdf';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function generateReport() {
    if (!activeTenantId || !workOrder) return;
    setError('');
    setMessage('');
    setGenerating(true);
    try {
      await generateAndUploadWorkOrderPdf(activeTenantId, workOrder.id);
      setMessage('Informe generado y guardado en la OT. Queda disponible en el historico de informes.');
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
    setMessage('');
    setGenerating(true);
    try {
      if (reports.length > 0) {
        await downloadSavedReport(reports[0]);
        setMessage('Descargando la ultima copia guardada en la OT.');
        return;
      }
      const savedReport = await generateAndUploadWorkOrderPdf(activeTenantId, workOrder.id);
      const url = await signedWorkOrderReportUrl(savedReport);
      setReports((current) => [savedReport, ...current]);
      setReportUrls((current) => ({ ...current, [savedReport.id]: url }));
      await downloadSavedReport(savedReport);
      setMessage('No habia informes guardados: se ha generado, guardado en la OT y descargado una copia local.');
    } catch (err) {
      try {
        const { blob, filename } = await generateWorkOrderPdfBlob(activeTenantId, workOrder.id);
        downloadBlob(blob, filename);
        setError(`${err.message}. Se ha descargado una copia local sin registro porque no se pudo guardar en la OT.`);
      } catch (fallbackError) {
        setError(`${err.message}. Ademas, no se pudo descargar copia local: ${fallbackError.message}`);
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="muted">Cargando informes...</p>;
  if (!workOrder) return <p className="error-text">No se ha encontrado la OT.</p>;

  return (
    <>
      <WorkOrderPageHeader workOrder={workOrder} titlePrefix="Informe" onBack={() => navigate(`/ots/${workOrder.id}`)} />
      {error && <p className="error-text"><CircleAlert size={16} /> {error}</p>}
      {message && <p className="success-text">{message}</p>}

      <WorkOrderSection title="Estado del informe" subtitle="Generación y descarga del PDF final" icon={FileText} badge={<WorkOrderStatusBadge status={workOrder.estado} />} defaultOpen>
        <WorkOrderInfoGrid columns={3}>
          <WorkOrderInfoItem label="OT" value={workOrder.codigo_ot || workOrder.id} important />
          <WorkOrderInfoItem label="Estado" value={<WorkOrderStatusBadge status={workOrder.estado} />} important />
          <WorkOrderInfoItem label="Técnico" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} important />
        </WorkOrderInfoGrid>
        <div className="quick-actions">
          <button className="primary-button" type="button" disabled={generating} onClick={generateReport}>{generating ? <Loader2 size={18} /> : <FileText size={18} />} Generar y guardar PDF</button>
          <button className="secondary-button" type="button" disabled={generating} onClick={downloadLocal}><Download size={18} /> Descargar copia local</button>
          <Link className="secondary-button" to={`/ots/${workOrder.id}/firma`}><ShieldCheck size={18} /> Firma cliente</Link>
          <Link className="ghost-button" to={`/ots/${workOrder.id}/checklist`}><RefreshCw size={18} /> Revisar checklist</Link>
        </div>
      </WorkOrderSection>

      <WorkOrderSection title="Informes guardados" subtitle="Histórico de PDFs generados para esta OT" icon={Download} defaultOpen>
        <DataTable
          columns={[
            { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) },
            { key: 'filename', label: 'Archivo' },
            { key: 'created_by', label: 'Creado por', render: (row) => row.created_by_profile?.nombre || row.created_by_profile?.email || '-' },
            { key: 'actions', label: 'Acciones', render: (row) => reportUrls[row.id] ? <div className="quick-actions"><a className="secondary-button" href={reportUrls[row.id]} target="_blank" rel="noreferrer">Abrir</a><button className="ghost-button" type="button" onClick={() => downloadSavedReport(row)}>Descargar</button></div> : '-' }
          ]}
          rows={reports}
          empty="Todavia no hay informes guardados"
        />
      </WorkOrderSection>
    </>
  );
}
