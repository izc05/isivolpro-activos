import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Mail, Navigation, Phone } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import WorkOrderStatusBadge from '../components/WorkOrders/WorkOrderStatusBadge';
import { useTenant } from '../hooks/useTenant';
import { getWorkOrder, REQUIREMENT_FIELDS } from '../services/workOrderService';
import { updateWorkOrderLifecycleStatus } from '../services/workOrderLifecycleService';
import {
  isWorkOrderClosed,
  priorityLabel,
  priorityTone,
  statusLabel,
  statusTransitionHelp,
  validNextActions,
  workOrderTypeLabel
} from '../utils/workOrderLifecycle';
import { formatDateTime } from '../utils/dateUtils';
import { buildMapsEmbedUrl, buildMapsUrl } from '../utils/mapUtils';

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
      const reopenReason = status === 'REABRIR' ? window.prompt('Motivo de reapertura') : '';
      if (status === 'REABRIR' && !reopenReason) return;
      const updated = await updateWorkOrderLifecycleStatus(row, status, { reopenReason });
      setRow((current) => ({ ...current, ...updated }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Cargando orden de trabajo...</p>;
  if (!row) return <p className="error-text">No se ha encontrado la orden de trabajo.</p>;

  const isClosed = isWorkOrderClosed(row);
  const nextActions = validNextActions(row);
  const requirements = REQUIREMENT_FIELDS.filter(([field]) => row.configuracion?.[field]);

  return (
    <>
      <PageHeader
        title={row.codigo_ot || `OT ${row.id.slice(0, 8)}`}
        subtitle={row.titulo}
        action={<button className="ghost-button" onClick={() => navigate('/ots')}>Volver</button>}
      />
      {error && <p className="error-text">{error}</p>}

      <CollapsibleSection title="Estado y ciclo de vida" subtitle="Gestiona el avance de la OT hasta su validacion final" icon={ClipboardCheck} badge={row.estado} defaultOpen>
        <div className="detail-list">
          <Detail label="Estado" value={<WorkOrderStatusBadge status={row.estado} />} />
          <Detail label="Prioridad" value={<span className={`badge ${priorityTone(row.prioridad)}`}>{priorityLabel(row.prioridad)}</span>} />
          <Detail label="Tipo" value={workOrderTypeLabel(row.tipo_ot || row.tipo)} />
          {row.tipo_ot_detalle && <Detail label="Detalle tipo" value={row.tipo_ot_detalle} />}
          <Detail label="Tecnico asignado" value={row.assigned?.nombre || row.assigned?.email || 'Sin asignar'} />
          <Detail label="Creada por" value={row.creator?.nombre || row.creator?.email || '-'} />
          <Detail label="Fecha prevista" value={row.fecha_prevista ? formatDateTime(row.fecha_prevista) : '-'} />
          <Detail label="Fecha limite" value={row.fecha_limite ? formatDateTime(row.fecha_limite) : '-'} />
          <Detail label="Duracion estimada" value={row.duracion_estimada_minutos ? `${row.duracion_estimada_minutos} min` : '-'} />
          <Detail label="Inicio" value={row.fecha_inicio ? formatDateTime(row.fecha_inicio) : '-'} />
          <Detail label="Fin" value={row.fecha_fin ? formatDateTime(row.fecha_fin) : '-'} />
        </div>
        {statusTransitionHelp(row.estado) && <p className="muted">{statusTransitionHelp(row.estado)}</p>}
        {isClosed && <p className="warning-text">OT cerrada: solo lectura. Para modificarla debe reabrirse con motivo y permisos.</p>}
        <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {nextActions.map((status) => (
            <button
              key={status}
              className={status === 'VALIDADA' ? 'primary-button' : status === 'CANCELADA' ? 'danger-button' : 'secondary-button'}
              type="button"
              onClick={() => changeStatus(status)}
            >
              {status === 'REABRIR' ? 'reabrir OT' : statusLabel(status)}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Instalacion y activo" subtitle="Destino de la orden de trabajo" icon={Navigation} defaultOpen>
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
        <InstallationContactPanel installation={row.instalaciones} />
      </CollapsibleSection>

      <CollapsibleSection title="Descripcion del trabajo" subtitle="Sintomas, trabajo solicitado, instrucciones y resultado esperado" icon={ClipboardCheck} defaultOpen={false}>
        <p>{row.descripcion || 'Sin descripcion adicional.'}</p>
        <div className="detail-list">
          <Detail label="Sintomas / situacion" value={row.sintomas || '-'} />
          <Detail label="Trabajo solicitado" value={row.trabajo_solicitado || '-'} />
          <Detail label="Instrucciones tecnico" value={row.instrucciones_tecnico || '-'} />
          <Detail label="Riesgos / precauciones" value={row.riesgos_precauciones || '-'} />
          <Detail label="Resultado esperado" value={row.resultado_esperado || '-'} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Requisitos de cierre" subtitle="Checklist, fotos, firma, mediciones e informe" icon={CheckCircle2} badge={`${requirements.length}`} defaultOpen={false}>
        {requirements.length === 0 ? (
          <p className="muted">Esta OT no tiene bloques obligatorios configurados.</p>
        ) : (
          <div className="requirement-grid">
            {requirements.map(([field, label]) => <span className="badge ok" key={field}>{label}</span>)}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Trabajo en campo" subtitle="Visita, checklist, firma e informe" icon={ClipboardCheck} defaultOpen>
        <p className="muted">Desde aqui puedes abrir la visita, rellenar el checklist, firmar con el cliente y generar el informe final.</p>
        <div className="quick-actions">
          <Link className="secondary-button" to="/scanner">Escanear QR</Link>
          {!isClosed && <Link className="secondary-button" to={`/ots/${row.id}/visita`}>Abrir visita</Link>}
          {row.configuracion?.requiere_checklist && <Link className="secondary-button" to={`/ots/${row.id}/checklist`}>Checklist</Link>}
          {row.configuracion?.requiere_firma_cliente && <Link className="secondary-button" to={`/ots/${row.id}/firma`}>Firma cliente</Link>}
          {row.configuracion?.requiere_informe && <Link className="primary-button" to={`/ots/${row.id}/informe`}>PDF informe</Link>}
        </div>
      </CollapsibleSection>
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

function InstallationContactPanel({ installation }) {
  const mapsUrl = buildMapsUrl(installation);
  const embedUrl = buildMapsEmbedUrl(installation);
  const phone = installation?.contacto_telefono;
  const email = installation?.contacto_email;

  if (!installation) return null;

  return (
    <div className="ot-installation-panel">
      <div className="quick-actions">
        {mapsUrl && <a className="secondary-button" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={18} /> Como llegar</a>}
        {phone && <a className="secondary-button" href={`tel:${phone}`}><Phone size={18} /> Llamar</a>}
        {email && <a className="ghost-button" href={`mailto:${email}`}><Mail size={18} /> Email</a>}
      </div>
      {embedUrl && <div className="ot-map-frame"><iframe title={`Mapa de ${installation.nombre || 'instalacion'}`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>}
    </div>
  );
}
