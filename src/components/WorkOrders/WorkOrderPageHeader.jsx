import { ArrowLeft, Building2, CalendarClock, UserRound, Wrench } from 'lucide-react';
import WorkOrderPriorityBadge from './WorkOrderPriorityBadge';
import WorkOrderStatusBadge from './WorkOrderStatusBadge';
import WorkOrderSteps from './WorkOrderSteps';
import { formatDateTime } from '../../utils/dateUtils';

export default function WorkOrderPageHeader({ workOrder, titlePrefix = '', onBack, actions }) {
  if (!workOrder) return null;
  const code = workOrder.codigo_ot || `OT ${workOrder.id?.slice(0, 8) || ''}`;
  const title = [titlePrefix, code].filter(Boolean).join(' ');
  return (
    <section className="ot-page-header">
      <div className="ot-page-header-main">
        <button className="ghost-button ot-page-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Volver</button>
        <div className="ot-page-title-block">
          <span className="section-eyebrow">Bloque OT</span>
          <h1>{title}</h1>
          <p>{workOrder.titulo || workOrder.descripcion || 'Orden de trabajo sin descripción.'}</p>
        </div>
        <div className="ot-page-badges">
          <WorkOrderStatusBadge status={workOrder.estado} />
          <WorkOrderPriorityBadge priority={workOrder.prioridad} />
        </div>
      </div>
      <div className="ot-page-meta">
        <span><Wrench size={16} /><b>Activo</b>{workOrder.activos?.nombre || '-'}</span>
        <span><Building2 size={16} /><b>Instalación</b>{workOrder.instalaciones?.nombre || '-'}</span>
        <span><UserRound size={16} /><b>Técnico</b>{workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar'}</span>
        <span><CalendarClock size={16} /><b>Prevista</b>{workOrder.fecha_prevista ? formatDateTime(workOrder.fecha_prevista) : '-'}</span>
      </div>
      <WorkOrderSteps status={workOrder.estado} />
      {actions && <div className="ot-page-actions">{actions}</div>}
    </section>
  );
}
