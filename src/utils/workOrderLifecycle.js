export const OFFICIAL_WORK_ORDER_STATUSES = [
  'BORRADOR',
  'NUEVA',
  'ASIGNADA',
  'ACEPTADA',
  'EN_CURSO',
  'PAUSADA',
  'PENDIENTE_MATERIAL',
  'PENDIENTE_CLIENTE',
  'FINALIZADA',
  'VALIDADA',
  'CANCELADA'
];

export const LEGACY_STATUS_MAP = {
  FIRMADA: 'FINALIZADA',
  INFORME_GENERADO: 'FINALIZADA',
  CERRADA: 'VALIDADA',
  CERRADO: 'VALIDADA',
  NUEVO: 'NUEVA',
  PENDIENTE: 'NUEVA',
  SIN_TECNICO: 'NUEVA',
  SIN_TECNICO_ASIGNADO: 'NUEVA'
};

export const WORK_ORDER_STATUS_LABELS = {
  BORRADOR: 'Borrador',
  NUEVA: 'Nueva',
  ASIGNADA: 'Asignada',
  ACEPTADA: 'Aceptada',
  EN_CURSO: 'En curso',
  PAUSADA: 'Pausada',
  PENDIENTE_MATERIAL: 'Pendiente material',
  PENDIENTE_CLIENTE: 'Pendiente cliente',
  FINALIZADA: 'Finalizada',
  FIRMADA: 'Firmada',
  INFORME_GENERADO: 'Informe generado',
  VALIDADA: 'Validada',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
  REABRIR: 'Reabrir OT'
};

export const WORK_ORDER_STATUS_HELP = {
  BORRADOR: 'Creada pero aun no lanzada.',
  NUEVA: 'Creada y pendiente de asignar o planificar.',
  ASIGNADA: 'Ya tiene tecnico o responsable asignado. Pendiente de aceptacion.',
  ACEPTADA: 'El tecnico ha aceptado la OT. Siguiente paso: iniciar la intervencion.',
  EN_CURSO: 'El tecnico ha empezado el trabajo.',
  PAUSADA: 'Trabajo detenido temporalmente.',
  PENDIENTE_MATERIAL: 'Falta material o repuesto.',
  PENDIENTE_CLIENTE: 'Falta autorizacion, acceso o respuesta del cliente.',
  FINALIZADA: 'El tecnico ha terminado y queda pendiente de validacion.',
  VALIDADA: 'El administrador ha revisado y cerrado definitivamente.',
  CANCELADA: 'OT anulada o descartada.'
};

export const WORK_ORDER_STATUS_TONES = {
  BORRADOR: '',
  NUEVA: 'warn',
  ASIGNADA: 'warn',
  ACEPTADA: 'ok',
  EN_CURSO: 'warn',
  PAUSADA: 'warn',
  PENDIENTE_MATERIAL: 'danger',
  PENDIENTE_CLIENTE: 'warn',
  FINALIZADA: 'ok',
  FIRMADA: 'ok',
  INFORME_GENERADO: 'ok',
  VALIDADA: 'ok',
  CERRADA: 'ok',
  CANCELADA: 'danger'
};

export const ACTIVE_WORK_ORDER_STATUSES = ['NUEVA', 'ASIGNADA', 'ACEPTADA', 'EN_CURSO', 'PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE'];
export const FINISHED_WORK_ORDER_STATUSES = ['FINALIZADA'];
export const CLOSED_WORK_ORDER_STATUSES = ['VALIDADA', 'CANCELADA'];

export const OFFICIAL_WORK_ORDER_PRIORITIES = ['baja', 'normal', 'alta', 'urgente', 'critica'];
export const WORK_ORDER_PRIORITY_LABELS = {
  baja: 'Baja',
  media: 'Normal',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
  critica: 'Critica'
};

export const OFFICIAL_WORK_ORDER_TYPES = [
  'correctiva',
  'preventiva',
  'conductiva',
  'inspeccion',
  'revision_legal',
  'mejora',
  'aviso_cliente',
  'otro'
];

export const WORK_ORDER_TYPE_LABELS_OFFICIAL = {
  correctiva: 'Correctiva',
  preventiva: 'Preventiva',
  conductiva: 'Conductiva',
  inspeccion: 'Inspeccion',
  revision_legal: 'Revision legal',
  mejora: 'Mejora',
  aviso_cliente: 'Aviso cliente',
  otro: 'Otro',
  presupuesto: 'Presupuesto',
  visita_previa: 'Visita previa',
  toma_datos: 'Toma de datos',
  diagnostico: 'Diagnostico',
  reparacion: 'Reparacion',
  mantenimiento_preventivo: 'Mantenimiento preventivo',
  mantenimiento_correctivo: 'Mantenimiento correctivo',
  revision: 'Revision',
  instalacion: 'Instalacion',
  montaje: 'Montaje',
  puesta_marcha: 'Puesta en marcha',
  sustitucion: 'Sustitucion',
  retirada: 'Retirada',
  seguimiento: 'Seguimiento',
  verificacion_funcionamiento: 'Verificacion de funcionamiento',
  medicion: 'Medicion',
  urgencia: 'Urgencia',
  formacion: 'Formacion'
};

export function normalizedStatus(status = '') {
  const raw = String(status || '').trim();
  if (!raw) return '';
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return LEGACY_STATUS_MAP[key] || key;
}

export function workOrderStatusLabel(status = '') {
  const normalized = normalizedStatus(status);
  return WORK_ORDER_STATUS_LABELS[normalized] || WORK_ORDER_STATUS_LABELS[status] || statusLabel(status);
}

export function statusLabel(status = '') {
  return String(status || '-').replaceAll('_', ' ').toLowerCase();
}

export function priorityLabel(priority = '') {
  return WORK_ORDER_PRIORITY_LABELS[priority] || priority || '-';
}

export function priorityTone(priority = '') {
  if (priority === 'critica' || priority === 'urgente') return 'danger';
  if (priority === 'alta') return 'warn';
  return '';
}

export function workOrderTypeLabel(type = '') {
  return WORK_ORDER_TYPE_LABELS_OFFICIAL[type] || type || '-';
}

export function isWorkOrderClosed(rowOrStatus) {
  const status = typeof rowOrStatus === 'string' ? rowOrStatus : rowOrStatus?.estado;
  return CLOSED_WORK_ORDER_STATUSES.includes(normalizedStatus(status));
}

export function validNextActions(row = {}) {
  const status = normalizedStatus(row.estado);
  if (!status) return [];
  if (status === 'VALIDADA') return ['REABRIR'];
  if (status === 'CANCELADA') return [];

  const actions = {
    BORRADOR: ['NUEVA', 'ASIGNADA', 'CANCELADA'],
    NUEVA: ['ASIGNADA', 'EN_CURSO', 'CANCELADA'],
    ASIGNADA: ['ACEPTADA', 'PAUSADA', 'CANCELADA'],
    ACEPTADA: ['EN_CURSO', 'PAUSADA', 'CANCELADA'],
    EN_CURSO: ['PAUSADA', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'FINALIZADA', 'CANCELADA'],
    PAUSADA: ['EN_CURSO', 'PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'CANCELADA'],
    PENDIENTE_MATERIAL: ['EN_CURSO', 'FINALIZADA', 'CANCELADA'],
    PENDIENTE_CLIENTE: ['EN_CURSO', 'FINALIZADA', 'CANCELADA'],
    FINALIZADA: ['VALIDADA', 'EN_CURSO']
  };
  return actions[status] || [];
}

export function statusTransitionHelp(status) {
  return WORK_ORDER_STATUS_HELP[normalizedStatus(status)] || '';
}
