alter function public.set_updated_at() set search_path = public;
alter function public.secure_token(int) set search_path = public;
alter function public.storage_tenant_id(text) set search_path = public;
alter function public.storage_bucket_is_private(text) set search_path = public;

revoke execute on all functions in schema public from public;

grant execute on all functions in schema public to authenticated;
