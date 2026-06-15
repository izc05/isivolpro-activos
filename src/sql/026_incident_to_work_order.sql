-- IsiVoltPro Activos QR
-- Incidencias: revisión y conversión en OT

alter table public.incidencias
  add column if not exists ot_id uuid references public.ordenes_trabajo(id) on delete set null,
  add column if not exists revisada_by uuid references public.profiles(id) on delete set null,
  add column if not exists revisada_at timestamptz,
  add column if not exists convertida_by uuid references public.profiles(id) on delete set null,
  add column if not exists convertida_at timestamptz,
  add column if not exists descartada_by uuid references public.profiles(id) on delete set null,
  add column if not exists descartada_at timestamptz,
  add column if not exists motivo_descarte text,
  add column if not exists notas_revision text;

create index if not exists idx_incidencias_ot_id on public.incidencias(ot_id);
create index if not exists idx_incidencias_estado on public.incidencias(tenant_id, estado);
