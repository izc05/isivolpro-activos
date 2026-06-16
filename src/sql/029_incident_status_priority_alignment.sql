-- IsiVoltPro Activos QR
-- Alinea incidencias con los estados y prioridades usados por la UI.

alter table public.incidencias
  drop constraint if exists incidencias_prioridad_check;

alter table public.incidencias
  add constraint incidencias_prioridad_check
  check (prioridad in ('baja', 'media', 'alta', 'urgente', 'critica'));

alter table public.incidencias
  drop constraint if exists incidencias_estado_check;

alter table public.incidencias
  add constraint incidencias_estado_check
  check (estado in ('abierta', 'en_proceso', 'observada', 'en_revision', 'convertida_en_ot', 'descartada', 'cerrada'));

update public.incidencias
set estado = 'abierta'
where estado = 'observada';
