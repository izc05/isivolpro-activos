-- IsiVoltPro - Configuracion operativa de ordenes de trabajo
-- La app usa este JSON para decidir checklist, fotos, firma, informe y revision final.
alter table public.ordenes_trabajo
  add column if not exists configuracion jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
