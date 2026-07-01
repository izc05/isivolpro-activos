import { OFFICIAL_WORK_ORDER_STATUSES, normalizedStatus, statusTransitionHelp, workOrderStatusLabel } from '../../utils/workOrderLifecycle';
import WorkOrderStatusBadge from './WorkOrderStatusBadge';

export default function WorkOrderStatusOverview({ orders = [], activeStatus = '', onSelectStatus }) {
  const counts = OFFICIAL_WORK_ORDER_STATUSES.map((status) => ({
    status,
    count: orders.filter((order) => normalizedStatus(order.estado) === status).length
  }));
  const total = orders.length;
  const activeCount = counts.find((item) => item.status === activeStatus)?.count || total;

  return (
    <section className="ot-status-overview">
      <div className="ot-status-overview-head">
        <div>
          <span className="section-eyebrow">Estado OT ahora</span>
          <h2>Seguimiento del ciclo de trabajo</h2>
          <p>{activeStatus ? `${workOrderStatusLabel(activeStatus)}: ${activeCount} OT en este estado.` : `${total} OT visibles en la instalacion o cliente activo.`}</p>
        </div>
        <strong>{total}</strong>
      </div>
      <div className="ot-status-lane">
        {counts.map(({ status, count }) => {
          const isActive = activeStatus === status;
          const Component = onSelectStatus ? 'button' : 'article';
          return (
            <Component
              key={status}
              type={onSelectStatus ? 'button' : undefined}
              className={`ot-status-tile ${isActive ? 'active' : ''}`}
              disabled={Boolean(onSelectStatus && count === 0)}
              title={count === 1 ? 'Abrir esta OT' : count > 1 ? `Ver las ${count} OT` : 'No hay OT en este estado'}
              onClick={onSelectStatus ? () => onSelectStatus(isActive ? 'todos' : status) : undefined}
            >
              <WorkOrderStatusBadge status={status} />
              <strong>{count}</strong>
              <span>{statusTransitionHelp(status)}</span>
              {count > 0 && <small>{count === 1 ? 'Abrir OT' : `Ver ${count} OT`}</small>}
            </Component>
          );
        })}
      </div>
    </section>
  );
}
