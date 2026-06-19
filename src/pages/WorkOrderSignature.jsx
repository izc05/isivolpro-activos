import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FormField from '../components/Forms/FormField';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import SignaturePad from '../components/WorkOrders/SignaturePad';
import WorkOrderPageHeader from '../components/WorkOrders/WorkOrderPageHeader';
import WorkOrderSection from '../components/WorkOrders/WorkOrderSection';
import { WorkOrderInfoGrid, WorkOrderInfoItem } from '../components/WorkOrders/WorkOrderInfoGrid';
import { ClipboardCheck, PenLine } from 'lucide-react';
import { useTenant } from '../hooks/useTenant';
import { getWorkOrder, listWorkOrderVisits } from '../services/workOrderService';
import { signedVisitSignatureUrl, uploadVisitSignature } from '../services/workOrderSignatureService';
import { formatDateTime } from '../utils/dateUtils';

export default function WorkOrderSignature() {
  const { id } = useParams();
  const navigate = useNavigate();
  const signatureRef = useRef(null);
  const { activeTenantId } = useTenant();
  const [workOrder, setWorkOrder] = useState(null);
  const [visits, setVisits] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [nombreFirmante, setNombreFirmante] = useState('');
  const [dniFirmante, setDniFirmante] = useState('');
  const [signatureUrls, setSignatureUrls] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
      const preferredVisit = visitData.find((visit) => visit.estado === 'FINALIZADA' && !visit.firma_path) || visitData.find((visit) => visit.estado === 'EN_CURSO') || visitData[0];
      setSelectedVisitId((current) => current || preferredVisit?.id || '');

      const urls = await Promise.all(
        visitData
          .filter((visit) => visit.firma_path)
          .map(async (visit) => [visit.id, await signedVisitSignatureUrl(visit)])
      );
      setSignatureUrls(Object.fromEntries(urls));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, id]);

  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!workOrder || !selectedVisit) {
      setError('Selecciona una visita para firmar.');
      return;
    }

    setSaving(true);
    try {
      const fileName = `firma-${workOrder.codigo_ot || workOrder.id}-${Date.now()}.png`;
      const signatureFile = await signatureRef.current.toFile(fileName);
      await uploadVisitSignature({
        workOrder,
        visit: selectedVisit,
        file: signatureFile,
        nombreFirmante,
        dniFirmante
      });
      setMessage('Firma guardada correctamente. La OT queda marcada como FIRMADA.');
      signatureRef.current.clear();
      setNombreFirmante('');
      setDniFirmante('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Cargando firma...</p>;
  if (!workOrder) return <p className="error-text">No se ha encontrado la OT.</p>;

  return (
    <>
      <WorkOrderPageHeader workOrder={workOrder} titlePrefix="Firma cliente" onBack={() => navigate(`/ots/${workOrder.id}`)} />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <div className="grid two">
        <WorkOrderSection title="Datos de la OT" subtitle="Contexto de la firma" icon={ClipboardCheck} badge={<WorkOrderStatusBadge status={workOrder.estado} />} defaultOpen>
          <WorkOrderInfoGrid columns={2}>
            <WorkOrderInfoItem label="Estado" value={<WorkOrderStatusBadge status={workOrder.estado} />} important />
            <WorkOrderInfoItem label="Instalación" value={workOrder.instalaciones?.nombre || '-'} important />
            <WorkOrderInfoItem label="Dirección" value={workOrder.instalaciones?.direccion || '-'} wide />
            <WorkOrderInfoItem label="Activo" value={workOrder.activos?.nombre || '-'} />
            <WorkOrderInfoItem label="Técnico" value={workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'} important />
          </WorkOrderInfoGrid>
          <p className="muted">La firma se guarda como imagen privada y queda asociada a la visita seleccionada.</p>
        </WorkOrderSection>

        <WorkOrderSection title="Firmar visita" subtitle="Captura de firma del cliente o responsable" icon={PenLine} defaultOpen>
          <form className="form-grid" onSubmit={submit}>
            <FormField label="Visita a firmar">
              <select value={selectedVisitId} onChange={(event) => setSelectedVisitId(event.target.value)} required>
                <option value="">Selecciona visita</option>
                {visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {formatDateTime(visit.fecha_inicio)} - {visit.estado}{visit.firma_path ? ' - firmada' : ''}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Nombre del firmante">
              <input value={nombreFirmante} onChange={(event) => setNombreFirmante(event.target.value)} placeholder="Nombre del cliente o responsable" required />
            </FormField>
            <FormField label="DNI / Identificacion opcional">
              <input value={dniFirmante} onChange={(event) => setDniFirmante(event.target.value)} placeholder="Opcional" />
            </FormField>
            <SignaturePad ref={signatureRef} />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => signatureRef.current.clear()}>Limpiar firma</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar firma'}</button>
            </div>
          </form>
        </WorkOrderSection>
      </div>

      <WorkOrderSection title="Firmas guardadas" subtitle="Firmas asociadas a visitas de esta OT" icon={PenLine} defaultOpen={visits.filter((visit) => visit.firma_path).length > 0}>
        {visits.filter((visit) => visit.firma_path).length === 0 && <p className="muted">Todavia no hay firmas guardadas.</p>}
        <div className="grid">
          {visits.filter((visit) => visit.firma_path).map((visit) => (
            <div className="card" key={visit.id}>
              <p><strong>{visit.nombre_firmante || 'Firmante sin nombre'}</strong></p>
              <p className="muted">Visita: {formatDateTime(visit.fecha_inicio)}</p>
              {visit.dni_firmante && <p className="muted">Identificacion: {visit.dni_firmante}</p>}
              {signatureUrls[visit.id] ? (
                <img src={signatureUrls[visit.id]} alt="Firma cliente" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', background: '#fff', borderRadius: 12 }} />
              ) : (
                <p className="muted">Cargando firma...</p>
              )}
            </div>
          ))}
        </div>
      </WorkOrderSection>

      <WorkOrderSection title="Siguiente bloque" subtitle="Generación de informe final" icon={ClipboardCheck} defaultOpen={false}>
        <p className="muted">El siguiente paso sera generar el PDF con datos de OT, visita, checklist, fotos y firma.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to={`/ots/${workOrder.id}/checklist`}>Checklist</Link>
          <button className="secondary-button" disabled>PDF proximamente</button>
        </div>
      </WorkOrderSection>
    </>
  );
}

