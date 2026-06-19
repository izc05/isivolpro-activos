import { priorityLabel, priorityTone } from '../../utils/workOrderLifecycle';

export default function WorkOrderPriorityBadge({ priority }) {
  const normalized = priority || 'normal';
  return <span className={`badge ot-priority-badge ot-priority-${normalized} ${priorityTone(normalized)}`}>{priorityLabel(normalized)}</span>;
}
