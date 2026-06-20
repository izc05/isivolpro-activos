import { addMonths, addYears, differenceInCalendarDays, isValid, parseISO } from 'date-fns';

export const OCA_SPECIALTIES = [
  ['baja_tension', 'Baja tensión'],
  ['alta_tension', 'Alta tensión'],
  ['centro_transformacion', 'Centro de transformación'],
  ['rite', 'RITE'],
  ['pci', 'PCI'],
  ['ascensor', 'Ascensor'],
  ['equipos_presion', 'Equipos a presión'],
  ['frigorificas', 'Instalaciones frigoríficas'],
  ['gas', 'Gas'],
  ['otra', 'Otra']
];

export const OCA_INSPECTION_TYPES = [
  ['inicial', 'Inicial'],
  ['periodica', 'Periódica'],
  ['extraordinaria', 'Extraordinaria'],
  ['segunda_visita', 'Segunda visita'],
  ['otra', 'Otra']
];

export const OCA_RESULTS = [
  ['pendiente', 'Pendiente'],
  ['favorable', 'Favorable'],
  ['favorable_observaciones', 'Favorable con observaciones'],
  ['condicionada', 'Condicionada'],
  ['desfavorable', 'Desfavorable']
];

export const OCA_CONTROL_STATES = [
  ['sin_datos', 'Sin datos'],
  ['al_dia', 'Al día'],
  ['proxima', 'Próxima'],
  ['vencida', 'Vencida'],
  ['con_incidencias', 'Con incidencias'],
  ['desfavorable', 'Desfavorable'],
  ['no_aplica', 'No aplica']
];

export const OCA_INSPECTION_STATES = [
  ['borrador', 'Borrador'],
  ['programada', 'Programada'],
  ['realizada', 'Realizada'],
  ['acta_pendiente', 'Acta pendiente'],
  ['con_incidencias', 'Con incidencias'],
  ['pendiente_subsanacion', 'Pendiente de subsanación'],
  ['pendiente_verificacion', 'Pendiente de verificación'],
  ['cerrada', 'Cerrada'],
  ['cancelada', 'Cancelada']
];

export const OCA_INCIDENT_CLASSIFICATIONS = [
  ['observacion', 'Observación'],
  ['leve', 'Leve'],
  ['grave', 'Grave'],
  ['muy_grave', 'Muy grave']
];

export const OCA_INCIDENT_STATES = [
  ['pendiente', 'Pendiente'],
  ['ot_creada', 'OT creada'],
  ['en_reparacion', 'En reparación'],
  ['subsanada', 'Subsanada'],
  ['pendiente_verificacion', 'Pendiente de verificación'],
  ['verificada', 'Verificada'],
  ['no_procede', 'No procede']
];

export const OCA_DOCUMENT_TYPES = [
  ['acta_oca', 'Acta OCA'],
  ['acta_anterior', 'Acta anterior'],
  ['certificado_favorable', 'Certificado favorable'],
  ['certificado_subsanacion', 'Certificado de subsanación'],
  ['proyecto', 'Proyecto'],
  ['memoria', 'Memoria'],
  ['boletin', 'Boletín o certificado'],
  ['esquema_unifilar', 'Esquema unifilar'],
  ['contrato_mantenimiento', 'Contrato de mantenimiento'],
  ['fotografias', 'Fotografías'],
  ['otra_documentacion', 'Otra documentación']
];

export function ocaLabel(options, value) {
  return options.find(([key]) => key === value)?.[1] || (value ? String(value).replaceAll('_', ' ') : '-');
}

export function ocaStatusClass(value) {
  const danger = ['vencida', 'desfavorable', 'muy_grave'];
  const warn = ['proxima', 'con_incidencias', 'pendiente_subsanacion', 'pendiente_verificacion', 'condicionada', 'acta_pendiente'];
  const ok = ['al_dia', 'favorable', 'cerrada', 'verificada'];
  if (danger.includes(value)) return 'danger';
  if (warn.includes(value)) return 'warn';
  if (ok.includes(value)) return 'ok';
  return '';
}

export function calculateNextOcaDate(fechaRealizada, periodicidadValor, periodicidadUnidad = 'anos') {
  if (!fechaRealizada || !periodicidadValor || periodicidadUnidad === 'manual') return null;
  const base = typeof fechaRealizada === 'string' ? parseISO(fechaRealizada) : fechaRealizada;
  if (!isValid(base)) return null;
  const value = Number(periodicidadValor);
  if (!Number.isFinite(value) || value <= 0) return null;
  const next = periodicidadUnidad === 'meses' ? addMonths(base, value) : addYears(base, value);
  return next.toISOString().slice(0, 10);
}

export function daysUntil(date) {
  if (!date) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return null;
  return differenceInCalendarDays(parsed, new Date());
}

export function deriveOcaControlState({ fecha_proxima_inspeccion, resultado, pendingIncidents = 0, missingAct = false, active = true } = {}) {
  if (!active) return 'no_aplica';
  if (resultado === 'desfavorable') return 'desfavorable';
  if (pendingIncidents > 0) return 'con_incidencias';
  if (missingAct) return 'pendiente_acta';
  if (!fecha_proxima_inspeccion) return 'sin_datos';
  const days = daysUntil(fecha_proxima_inspeccion);
  if (days === null) return 'sin_datos';
  if (days < 0) return 'vencida';
  if (days <= 90) return 'proxima';
  return 'al_dia';
}
