-- Adds private image support to assets created before this feature.

alter table public.activos
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_file_name text,
  add column if not exists image_mime_type text;
