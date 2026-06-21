alter table public.ot_informes
  add column if not exists path text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.ot_informes
  alter column bucket set default 'documents-private';

create index if not exists ot_informes_tenant_ot_created_idx
  on public.ot_informes (tenant_id, ot_id, created_at desc);

create or replace function public.can_access_work_order_child(
  child_tenant_uuid uuid,
  work_order_uuid uuid,
  mode_text text default 'select'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes_trabajo ot
    where ot.id = work_order_uuid
      and ot.tenant_id = child_tenant_uuid
      and public.can_access_work_order(ot.id, mode_text)
  );
$$;

alter table public.ot_informes enable row level security;

drop policy if exists ot_informes_work_order_access on public.ot_informes;
create policy ot_informes_work_order_access
on public.ot_informes
for all
to authenticated
using (public.can_access_work_order_child(tenant_id, ot_id, 'select'))
with check (public.can_access_work_order_child(tenant_id, ot_id, 'update'));

grant select, insert, update, delete on public.ot_informes to authenticated;
