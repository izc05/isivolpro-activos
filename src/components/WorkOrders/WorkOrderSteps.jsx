import { AlertTriangle, CheckCircle2, CircleDot, Clock3 } from 'lucide-react';
import { normalizedStatus } from '../../utils/workOrderLifecycle';

const FLOW_STEPS = [
  { key: 'created', label: 'Creada', statuses: ['BORRADOR', 'NUEVA'] },
  { key: 'assigned', label: 'Asignada', statuses: ['ASIGNADA'] },
  { key: 'field', label: 'En curso', statuses: ['EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'] },
  { key: 'finished', label: 'Finalizada', statuses: ['FINALIZADA'] },
  { key: 'validated', label: 'Validada', statuses: ['VALIDADA'] }
];

function currentStepIndex(status) {
  const normalized = normalizedStatus(status);
  if (normalized === 'CANCELADA') return -1;
  const index = FLOW_STEPS.findIndex((step) => step.statuses.includes(normalized));
  return index >= 0 ? index : 0;
}

export default function WorkOrderSteps({ status }) {
  const normalized = normalizedStatus(status);
  const activeIndex = currentStepIndex(status);
  const cancelled = normalized === 'CANCELADA';

  return (
    <nav className={`ot-flow-steps ${cancelled ? 'cancelled' : ''}`} aria-label="Pasos de la OT">
      {FLOW_STEPS.map((step, index) => {
        const done = !cancelled && index < activeIndex;
        const active = !cancelled && index === activeIndex;
        const Icon = cancelled ? AlertTriangle : done ? CheckCircle2 : active ? CircleDot : Clock3;
        return (
          <span className={`ot-flow-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={step.key}>
            <Icon size={16} />
            <b>{step.label}</b>
          </span>
        );
      })}
    </nav>
  );
}
