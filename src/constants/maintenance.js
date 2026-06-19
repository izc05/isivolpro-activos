import { Activity, CalendarClock, ClipboardCheck, FileText, Gauge, History, Repeat, Settings, Sparkles, Wrench } from 'lucide-react';

export const MAINTENANCE_TYPES = [
  { value: 'preventivo', label: 'Preventivo', icon: Repeat, description: 'Trabajo periódico antes de avería.', className: 'ok' },
  { value: 'correctivo', label: 'Correctivo', icon: Wrench, description: 'Trabajo provocado por avería o incidencia.', className: 'danger' },
  { value: 'predictivo', label: 'Predictivo', icon: Gauge, description: 'Trabajo basado en mediciones o estado real.', className: 'warn' },
  { value: 'revision_tecnica', label: 'Revisión técnica', icon: ClipboardCheck, description: 'Revisión interna no reglamentaria.', className: 'ok' },
  { value: 'limpieza', label: 'Limpieza técnica', icon: Sparkles, description: 'Limpieza necesaria para conservar el activo.', className: 'ok' },
  { value: 'ajuste', label: 'Ajuste', icon: Settings, description: 'Ajustes funcionales o de configuración.', className: 'warn' },
  { value: 'lubricacion', label: 'Lubricación', icon: Activity, description: 'Engrase o lubricación técnica.', className: 'ok' },
  { value: 'sustitucion', label: 'Sustitución', icon: Repeat, description: 'Cambio de equipo o componente.', className: 'warn' },
  { value: 'mejora', label: 'Mejora', icon: Sparkles, description: 'Mejora del activo sin avería necesaria.', className: 'ok' },
  { value: 'modificacion', label: 'Modificación', icon: Settings, description: 'Cambio técnico o reubicación.', className: 'warn' },
  { value: 'calibracion', label: 'Calibración interna', icon: Gauge, description: 'Calibración interna de funcionamiento.', className: 'ok' },
  { value: 'prueba_funcional', label: 'Prueba funcional', icon: ClipboardCheck, description: 'Comprobación de funcionamiento.', className: 'ok' },
  { value: 'historico', label: 'Histórico', icon: History, description: 'Trabajo anterior o externo registrado manualmente.', className: '' },
  { value: 'otro', label: 'Otro', icon: FileText, description: 'Trabajo técnico no clasificado.', className: '' }
];

export const MAINTENANCE_TYPE_VALUES = MAINTENANCE_TYPES.map((item) => item.value);
export const MAINTENANCE_TYPE_LABELS = Object.fromEntries(MAINTENANCE_TYPES.map((item) => [item.value, item.label]));

export const MAINTENANCE_STATUSES = [
  'borrador',
  'programado',
  'proximo',
  'vencido',
  'ot_generada',
  'asignado',
  'en_curso',
  'pendiente_material',
  'pendiente_cliente',
  'pausado',
  'completado',
  'cancelado',
  'no_aplica'
];

export const MAINTENANCE_STATUS_LABELS = {
  borrador: 'Borrador',
  programado: 'Programado',
  proximo: 'Próximo',
  vencido: 'Vencido',
  ot_generada: 'OT generada',
  asignado: 'Asignado',
  en_curso: 'En curso',
  pendiente_material: 'Pendiente de material',
  pendiente_cliente: 'Pendiente de cliente',
  pausado: 'Pausado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  no_aplica: 'No aplica'
};

export const MAINTENANCE_STATUS_CLASSES = {
  borrador: '',
  programado: '',
  proximo: 'warn',
  vencido: 'danger',
  ot_generada: 'warn',
  asignado: 'warn',
  en_curso: 'warn',
  pendiente_material: 'danger',
  pendiente_cliente: 'warn',
  pausado: 'warn',
  completado: 'ok',
  cancelado: 'danger',
  no_aplica: ''
};

export const PERIOD_UNITS = [
  { value: 'dias', label: 'Días' },
  { value: 'semanas', label: 'Semanas' },
  { value: 'meses', label: 'Meses' },
  { value: 'anos', label: 'Años' },
  { value: 'horas', label: 'Horas' },
  { value: 'ciclos', label: 'Ciclos' },
  { value: 'manual', label: 'Manual' }
];

export const MAINTENANCE_PRIORITIES = ['baja', 'media', 'normal', 'alta', 'urgente', 'critica'];

export const CHECKLIST_RESPONSE_TYPES = ['ok_no_ok', 'texto', 'numero', 'medicion', 'fotografia', 'seleccion'];

export function maintenanceTypeLabel(type) {
  return MAINTENANCE_TYPE_LABELS[type] || type || '-';
}

export function maintenanceStatusLabel(status) {
  return MAINTENANCE_STATUS_LABELS[status] || status || '-';
}

export function maintenanceStatusClass(status) {
  return MAINTENANCE_STATUS_CLASSES[status] || '';
}

export function workOrderStatusToMaintenanceStatus(status) {
  const normalized = String(status || '').toUpperCase();
  const map = {
    BORRADOR: 'borrador',
    NUEVA: 'ot_generada',
    ASIGNADA: 'asignado',
    ACEPTADA: 'asignado',
    EN_CURSO: 'en_curso',
    PAUSADA: 'pausado',
    PENDIENTE_MATERIAL: 'pendiente_material',
    PENDIENTE_CLIENTE: 'pendiente_cliente',
    FINALIZADA: 'completado',
    FIRMADA: 'completado',
    INFORME_GENERADO: 'completado',
    VALIDADA: 'completado',
    CERRADA: 'completado',
    CANCELADA: 'cancelado'
  };
  return map[normalized] || null;
}

export function statusForScheduledDate(date) {
  if (!date) return 'borrador';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / 86400000);
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 7) return 'proximo';
  return 'programado';
}

export function nextDateFrom(date, value, unit) {
  if (!date || !value || unit === 'manual' || unit === 'horas' || unit === 'ciclos') return null;
  const next = new Date(date);
  const amount = Number(value);
  if (unit === 'dias') next.setDate(next.getDate() + amount);
  if (unit === 'semanas') next.setDate(next.getDate() + amount * 7);
  if (unit === 'meses') next.setMonth(next.getMonth() + amount);
  if (unit === 'anos') next.setFullYear(next.getFullYear() + amount);
  return next.toISOString().slice(0, 10);
}

export function planChecklistToOtItems(checklist = []) {
  return (Array.isArray(checklist) ? checklist : []).map((item, index) => ({
    punto: String(item.orden || index + 1),
    descripcion: item.titulo || item.descripcion || `Punto ${index + 1}`,
    requiere_foto: Boolean(item.requiere_foto)
  }));
}

export const DEFAULT_PLAN_CHECKLIST_ITEM = {
  titulo: '',
  descripcion: '',
  obligatorio: true,
  requiere_foto: false,
  tipo_respuesta: 'ok_no_ok',
  unidad: '',
  valor_minimo: '',
  valor_maximo: ''
};

export const maintenanceCalendarIcon = CalendarClock;
