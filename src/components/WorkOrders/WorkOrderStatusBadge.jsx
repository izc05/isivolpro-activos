import { WORK_ORDER_STATUS_TONES, workOrderStatusLabel } from '../../utils/workOrderLifecycle';

export { workOrderStatusLabel };

export default function WorkOrderStatusBadge({ status }) {
  const tone = WORK_ORDER_STATUS_TONES[status] || '';
  return <span className={`badge ${tone}`}>{workOrderStatusLabel(status)}</span>;
}
