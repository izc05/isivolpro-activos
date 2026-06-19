export const MAINTENANCE_SCHEMA_PENDING_MESSAGE =
  'La estructura del Bloque Mantenimiento todavía no está aplicada en Supabase.';

export const MAINTENANCE_SCHEMA_PENDING_DETAIL =
  'Ejecuta la migración src/sql/030_bloque_mantenimiento.sql para activar planes y actuaciones programadas.';

export function isMaintenanceSchemaMissing(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || error || '').toLowerCase();

  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('could not find the table') ||
    (message.includes('schema cache') &&
      (message.includes('planes_mantenimiento') || message.includes('mantenimientos_programados')))
  );
}
