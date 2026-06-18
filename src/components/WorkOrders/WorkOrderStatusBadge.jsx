import { normalizedStatus, WORK_ORDER_STATUS_TONES, workOrderStatusLabel } from '../../utils/workOrderLifecycle';

export { workOrderStatusLabel };

export default function WorkOrderStatusBadge({ status }) {
  const normalized = normalizedStatus(status);
  const tone = WORK_ORDER_STATUS_TONES[normalized] || WORK_ORDER_STATUS_TONES[status] || '';
  return <span className={`badge ot-status-badge ot-status-${normalized.toLowerCase()} ${tone}`}>{workOrderStatusLabel(normalized || status)}</span>;
}
