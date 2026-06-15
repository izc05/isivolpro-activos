-- IsiVoltPro Activos QR
-- Fotos en incidencias internas y avisos publicos por QR

create table if not exists public.incident_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incidencia_id uuid not null references public.incidencias(id) on delete cascade,
  source text not null default 'internal' check (source in ('public_qr','internal')),
  tipo_foto text not null default 'problema' check (tipo_foto in ('problema','placa','zona','antes','despues','general','otra')),
  file_name text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null default 0 check (size_bytes >= 0 and size_bytes <= 2097152),
  data_url text not null,
  comentario text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_incident_photos_tenant_incident
  on public.incident_photos(tenant_id, incidencia_id, created_at desc);

alter table public.incident_photos enable row level security;

drop policy if exists incident_photos_tenant_select on public.incident_photos;
create policy incident_photos_tenant_select on public.incident_photos
for select to authenticated
using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = incident_photos.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
);

drop policy if exists incident_photos_tenant_insert on public.incident_photos;
create policy incident_photos_tenant_insert on public.incident_photos
for insert to authenticated
with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = incident_photos.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
  )
);

-- submit_public_incident is also extended with optional photo_* parameters in production Supabase.
-- The full function body is maintained in 019_public_incident_reports.sql.
