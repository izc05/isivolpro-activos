-- Incremental migration for projects already created before image support.

alter table public.instalaciones
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_file_name text,
  add column if not exists image_mime_type text;

alter table public.ubicaciones
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_file_name text,
  add column if not exists image_mime_type text;
