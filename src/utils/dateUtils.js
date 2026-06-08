import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(value) {
  if (!value) return 'Sin fecha';
  return format(typeof value === 'string' ? parseISO(value) : value, 'dd MMM yyyy', { locale: es });
}

export function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return format(typeof value === 'string' ? parseISO(value) : value, 'dd MMM yyyy HH:mm', { locale: es });
}
