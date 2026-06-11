import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, Download, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { getWorkOrder } from '../services/workOrderService';
import {
  generateAndUploadWorkOrderPdf,
  generateWorkOrderPdfBlob,
  listWorkOrderReports,
  signedWorkOrderReportUrl
} from '../services/workOrderPdfService';
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
      setMessage('Informe generado correctamente. La OT queda marcada como INFORME_GENERADO.');
      await refresh();
    } catch (err) {
      try {
        const { blob, filename } = await generateWorkOrderPdfBlob(activeTenantId, workOrder.id);
        downloadBlob(blob, filename);
        setError(`No se pudo guardar el informe en Supabase: ${err.message}. Se ha descargado una copia local del PDF.`);
      } catch (fallbackError) {
        setError(`No se pudo generar el PDF: ${fallbackError.message || err.message}`);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPreview() {
    if (!activeTenantId || !workOrder) return;
    setError('');
    setGenerating(true);
    try {
      const { blob, filename } = await generateWorkOrderPdfBlob(activeTenantId, workOrder.id);
      downloadBlob(blob, filename);
      setMessage('PDF descargado en este dispositivo.');
    } catch (err) {
      setError(`No se pudo preparar la descarga: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  if (loading || tenantLoading) {
    return (
      <section className="card workorder-loading">
        <Loader2 size={22} />
        <div>
          <strong>Cargando informe...</strong>
          <p className="muted">Preparando datos de OT, checklist, fotos y firmas.</p>
        </div>
      </section>
    );
  }
  if (!workOrder) {
    return (
      <section className="card workorder-empty-error">
        <CircleAlert size={28} />
        <div>
          <h2>No se ha encontrado la OT</h2>
          <p>{error || 'La orden puede haber sido eliminada, no pertenecer a esta comunidad o el enlace no es correcto.'}</p>
          <div className="quick-actions">
            <button className="secondary-button" type="button" onClick={refresh}><RefreshCw size={18} /> Reintentar</button>
            <Link className="primary-button" to="/ots">Ver todas las OT</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title={`Informe PDF ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}`}
        subtitle={workOrder.titulo}
        action={<button className="ghost-button" onClick={() => navigate(`/ots/${workOrder.id}`)}>Volver a OT</button>}
      />
      {error && (
        <div className="workorder-alert">
          <CircleAlert size={20} />
          <p>{error}</p>
          <button className="secondary-button" type="button" onClick={refresh}><RefreshCw size={18} /> Reintentar</button>
        </div>
      )}
      {message && (
        <div className="workorder-success">
          <ShieldCheck size={20} />
          <p>{message}</p>
        </div>
      )}

      <div className="grid two">
        <section className="card report-summary-card">
          <h2 className="section-heading">Datos incluidos</h2>
          <div className="detail-list">
            <Detail label="Estado OT" value={<WorkOrderStatusBadge status={workOrder.estado} />} />
            <Detail label="Instalacion" value={workOrder.instalaciones?.nombre || '-'} />
            <Detail label="Activo" value={workOrder.activos?.nombre || '-'} />
            <Detail label="Tecnico" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} />
          </div>
          <div className="report-included-list">
            <span>Datos generales</span>
            <span>Visitas</span>
            <span>Checklist</span>
            <span>Fotos</span>
            <span>Firma</span>
          </div>
        </section>

        <section className="card report-action-card">
          <div className="report-icon"><FileText size={30} /></div>
          <h2 className="section-heading">Generar informe</h2>
          <p className="muted">Crea una version nueva del PDF. Puedes descargarlo primero o guardarlo como documento privado.</p>
          <div className="quick-actions report-actions">
            <button className="primary-button" type="button" disabled={generating} onClick={generateReport}>
              {generating ? <><Loader2 size={18} /> Generando...</> : <><FileText size={18} /> Generar y guardar</>}
            </button>
            <button className="secondary-button" type="button" disabled={generating} onClick={downloadPreview}>
              <Download size={18} /> Descargar PDF
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
