const STATUS_TONES = {
  BORRADOR: '',
  ASIGNADA: 'warn',
  ACEPTADA: 'ok',
  EN_CURSO: 'warn',
  PENDIENTE_MATERIAL: 'danger',
  PENDIENTE_CLIENTE: 'warn',
  FINALIZADA: 'ok',
  FIRMADA: 'ok',
  INFORME_GENERADO: 'ok',
  CERRADA: 'ok',
  CANCELADA: 'danger'
};

const STATUS_LABELS = {
  BORRADOR: 'Borrador',
  ASIGNADA: 'Asignada',
  ACEPTADA: 'Aceptada',
  EN_CURSO: 'En curso',
  PENDIENTE_MATERIAL: 'Pendiente material',
  PENDIENTE_CLIENTE: 'Pendiente cliente',
  FINALIZADA: 'Finalizada',
  FIRMADA: 'Firmada',
  INFORME_GENERADO: 'Informe generado',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada'
};

export function workOrderStatusLabel(status) {
  return STATUS_LABELS[status] || status || '-';
}

export default function WorkOrderStatusBadge({ status }) {
  const tone = STATUS_TONES[status] || '';
  return <span className={`badge ${tone}`}>{workOrderStatusLabel(status)}</span>;
}
