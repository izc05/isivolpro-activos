-- IsiVoltPro - Endurecimiento de roles y acceso tecnico limitado
-- Ejecutar despues de 032_fix_ot_informes_storage_columns_and_rls.sql.
-- Tras aplicarla, refrescar la cache del esquema de Supabase/PostgREST desde el dashboard
-- o ejecutando: notify pgrst, 'reload schema';

alter table public.tenant_members
  drop constraint if exists tenant_members_role_check;

alter table public.tenant_members
  add constraint tenant_members_role_check
  check (role in (
    'administrador',
    'coordinador',
    'tecnico',
    'inspector_oca',
    'cliente',
    'admin_cliente',
    'tecnico_externo',
    'cliente_lectura'
  ));

alter table public.ot_visitas
  add column if not exists tipo_visita text not null default 'intervencion',
  add column if not exists tipo_visita_detalle text,
  add column if not exists estado_inicial text,
  add column if not exists situacion_encontrada text,
  add column if not exists trabajo_realizado text,
  add column if not exists diagnostico text,
  add column if not exists causa text,
  add column if not exists pruebas_realizadas text,
  add column if not exists recomendaciones text,
  add column if not exists trabajo_pendiente text,
  add column if not exists resultado_cierre text,
  add column if not exists motivo_cierre text,
  add column if not exists proxima_accion text,
  add column if not exists proximo_tipo_visita text,
  add column if not exists estado_final_activo text not null default 'no_comprobado',
  add column if not exists dispositivo jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ot_visitas
  drop constraint if exists ot_visitas_estado_final_activo_check;

alter table public.ot_visitas
  add constraint ot_visitas_estado_final_activo_check
  check (estado_final_activo in ('operativo','operativo_limitaciones','fuera_servicio','pendiente_reparacion','no_comprobado','no_aplica'));

create or replace function public.has_tenant_role_any(tenant_uuid uuid, role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = tenant_uuid
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
      and tm.role = any(role_names)
  );
$$;

create or replace function public.can_manage_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.has_tenant_role_any(tenant_uuid, array['administrador','admin_cliente']);
$$;

create or replace function public.can_coordinate_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_tenant(tenant_uuid)
    or public.has_tenant_role_any(tenant_uuid, array['coordinador']);
$$;

create or replace function public.can_manage_work_orders(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_coordinate_tenant(tenant_uuid);
$$;

create or replace function public.can_access_work_order(work_order_uuid uuid, mode_text text default 'select')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes_trabajo ot
    join public.tenant_members tm on tm.tenant_id = ot.tenant_id
      and tm.user_id = auth.uid()
      and tm.estado = 'activo'
    where ot.id = work_order_uuid
      and ot.deleted_at is null
      and (
        public.can_manage_work_orders(ot.tenant_id)
        or (
          tm.role in ('tecnico','tecnico_externo')
          and ot.assigned_to = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_access_work_order_child(child_tenant_uuid uuid, work_order_uuid uuid, mode_text text default 'select')
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

create or replace function public.has_assigned_work_order_for_installation(tenant_uuid uuid, installation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes_trabajo ot
    where ot.tenant_id = tenant_uuid
      and ot.instalacion_id = installation_uuid
      and ot.deleted_at is null
      and ot.assigned_to = auth.uid()
      and public.has_tenant_role_any(tenant_uuid, array['tecnico','tecnico_externo'])
  );
$$;

create or replace function public.can_view_related_installation(tenant_uuid uuid, installation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_coordinate_tenant(tenant_uuid)
    or public.has_tenant_role_any(tenant_uuid, array['cliente','cliente_lectura'])
    or public.has_installation_permission(tenant_uuid, installation_uuid, 'view')
    or public.has_assigned_work_order_for_installation(tenant_uuid, installation_uuid);
$$;

create or replace function public.can_view_installation(installation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instalaciones i
    where i.id = installation_uuid
      and i.deleted_at is null
      and public.can_view_related_installation(i.tenant_id, i.id)
  );
$$;

create or replace function public.can_view_document(document_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documentos d
    left join public.activos a on a.id = d.activo_id
    left join public.ubicaciones u on u.id = d.ubicacion_id
    where d.id = document_uuid
      and d.deleted_at is null
      and (
        public.can_coordinate_tenant(d.tenant_id)
        or (
          public.has_tenant_role_any(d.tenant_id, array['cliente','cliente_lectura'])
          and d.visibilidad = 'cliente'
        )
        or (
          public.has_tenant_role_any(d.tenant_id, array['tecnico','tecnico_externo'])
          and d.visibilidad in ('tecnico','cliente')
          and (
            (d.instalacion_id is not null and public.can_view_related_installation(d.tenant_id, d.instalacion_id))
            or (a.instalacion_id is not null and public.can_view_related_installation(d.tenant_id, a.instalacion_id))
            or (u.instalacion_id is not null and public.can_view_related_installation(d.tenant_id, u.instalacion_id))
          )
        )
      )
  );
$$;

create or replace function public.can_view_media_row(
  media_tenant_id uuid,
  media_visibility text,
  media_installation_id uuid default null,
  media_location_id uuid default null,
  media_asset_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_coordinate_tenant(media_tenant_id)
    or (
      public.has_tenant_role_any(media_tenant_id, array['cliente','cliente_lectura'])
      and media_visibility = 'cliente'
    )
    or (
      public.has_tenant_role_any(media_tenant_id, array['tecnico','tecnico_externo'])
      and media_visibility in ('tecnico','cliente')
      and (
        (media_installation_id is not null and public.can_view_related_installation(media_tenant_id, media_installation_id))
        or exists (
          select 1
          from public.activos a
          where a.id = media_asset_id
            and public.can_view_related_installation(media_tenant_id, a.instalacion_id)
        )
        or exists (
          select 1
          from public.ubicaciones u
          where u.id = media_location_id
            and public.can_view_related_installation(media_tenant_id, u.instalacion_id)
        )
      )
    );
$$;

create or replace function public.can_access_incident(incident_uuid uuid, mode_text text default 'select')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.incidencias i
    where i.id = incident_uuid
      and i.deleted_at is null
      and (
        public.can_coordinate_tenant(i.tenant_id)
        or i.created_by = auth.uid()
        or i.assigned_to = auth.uid()
        or (
          i.ot_id is not null
          and public.can_access_work_order(i.ot_id, mode_text)
        )
      )
  );
$$;

create or replace function public.can_create_incident_for_installation(tenant_uuid uuid, installation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_coordinate_tenant(tenant_uuid)
    or (
      public.has_tenant_role_any(tenant_uuid, array['tecnico','tecnico_externo'])
      and public.can_view_related_installation(tenant_uuid, installation_uuid)
    );
$$;

drop policy if exists "ordenes_trabajo_select_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_select_tenant"
on public.ordenes_trabajo
for select
to authenticated
using (public.can_access_work_order(id, 'select'));

drop policy if exists "ordenes_trabajo_insert_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_insert_tenant"
on public.ordenes_trabajo
for insert
to authenticated
with check (public.can_manage_work_orders(tenant_id));

drop policy if exists "ordenes_trabajo_update_tenant" on public.ordenes_trabajo;
create policy "ordenes_trabajo_update_tenant"
on public.ordenes_trabajo
for update
to authenticated
using (public.can_access_work_order(id, 'update'))
with check (public.can_access_work_order(id, 'update'));

do $$
declare
  t text;
begin
  foreach t in array array['ot_visitas','ot_checklist_respuestas','ot_fotos','ot_informes','ot_visita_materiales'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_tenant_access', t);
      execute format('drop policy if exists %I on public.%I', t || '_work_order_access', t);
      execute format($policy$
        create policy %I
        on public.%I
        for all
        to authenticated
        using (public.can_access_work_order_child(tenant_id, ot_id, 'select'))
        with check (public.can_access_work_order_child(tenant_id, ot_id, 'update'))
      $policy$, t || '_work_order_access', t);
    end if;
  end loop;
end $$;

drop policy if exists instalaciones_select on public.instalaciones;
create policy instalaciones_select on public.instalaciones
for select
to authenticated
using (deleted_at is null and public.can_view_installation(id));

drop policy if exists ubicaciones_select on public.ubicaciones;
create policy ubicaciones_select on public.ubicaciones
for select
to authenticated
using (deleted_at is null and public.can_view_related_installation(tenant_id, instalacion_id));

drop policy if exists activos_select on public.activos;
create policy activos_select on public.activos
for select
to authenticated
using (deleted_at is null and public.can_view_related_installation(tenant_id, instalacion_id));

drop policy if exists documentos_select on public.documentos;
create policy documentos_select
on public.documentos
for select
to authenticated
using (public.can_view_document(id));

drop policy if exists documentos_insert on public.documentos;
create policy documentos_insert
on public.documentos
for insert
to authenticated
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists documentos_update_admin on public.documentos;
drop policy if exists documentos_update_tecnico_limited on public.documentos;
create policy documentos_update_admin
on public.documentos
for update
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id))
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists videos_select on public.videos;
create policy videos_select
on public.videos
for select
to authenticated
using (deleted_at is null and public.can_view_media_row(tenant_id, visibilidad, instalacion_id, ubicacion_id, activo_id));

drop policy if exists videos_insert on public.videos;
create policy videos_insert
on public.videos
for insert
to authenticated
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists videos_update on public.videos;
create policy videos_update
on public.videos
for update
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id))
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists fotos_select on public.fotos;
create policy fotos_select
on public.fotos
for select
to authenticated
using (deleted_at is null and public.can_view_media_row(tenant_id, visibilidad, instalacion_id, ubicacion_id, activo_id));

drop policy if exists fotos_insert on public.fotos;
create policy fotos_insert
on public.fotos
for insert
to authenticated
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists fotos_update on public.fotos;
create policy fotos_update
on public.fotos
for update
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id))
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists incidencias_select on public.incidencias;
create policy incidencias_select
on public.incidencias
for select
to authenticated
using (public.can_access_incident(id, 'select'));

drop policy if exists incidencias_insert on public.incidencias;
create policy incidencias_insert
on public.incidencias
for insert
to authenticated
with check (public.can_create_incident_for_installation(tenant_id, instalacion_id));

drop policy if exists incidencias_update on public.incidencias;
create policy incidencias_update
on public.incidencias
for update
to authenticated
using (public.can_access_incident(id, 'update'))
with check (public.can_access_incident(id, 'update'));

drop policy if exists planes_mantenimiento_select on public.planes_mantenimiento;
create policy planes_mantenimiento_select
on public.planes_mantenimiento
for select
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id));

drop policy if exists planes_mantenimiento_insert on public.planes_mantenimiento;
create policy planes_mantenimiento_insert
on public.planes_mantenimiento
for insert
to authenticated
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists planes_mantenimiento_update on public.planes_mantenimiento;
create policy planes_mantenimiento_update
on public.planes_mantenimiento
for update
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id))
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists mantenimientos_programados_select on public.mantenimientos_programados;
create policy mantenimientos_programados_select
on public.mantenimientos_programados
for select
to authenticated
using (
  deleted_at is null
  and (
    public.can_coordinate_tenant(tenant_id)
    or assigned_to = auth.uid()
  )
);

drop policy if exists mantenimientos_programados_insert on public.mantenimientos_programados;
create policy mantenimientos_programados_insert
on public.mantenimientos_programados
for insert
to authenticated
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists mantenimientos_programados_update on public.mantenimientos_programados;
create policy mantenimientos_programados_update
on public.mantenimientos_programados
for update
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id))
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists historial_select on public.historial_mantenimiento;
create policy historial_select
on public.historial_mantenimiento
for select
to authenticated
using (
  deleted_at is null
  and (
    public.can_coordinate_tenant(tenant_id)
    or exists (
      select 1
      from public.ordenes_trabajo ot
      where ot.id = historial_mantenimiento.ot_id
        and ot.assigned_to = auth.uid()
        and ot.tenant_id = historial_mantenimiento.tenant_id
    )
  )
);

drop policy if exists historial_insert on public.historial_mantenimiento;
create policy historial_insert
on public.historial_mantenimiento
for insert
to authenticated
with check (public.can_coordinate_tenant(tenant_id));

drop policy if exists historial_update on public.historial_mantenimiento;
create policy historial_update
on public.historial_mantenimiento
for update
to authenticated
using (deleted_at is null and public.can_coordinate_tenant(tenant_id))
with check (public.can_coordinate_tenant(tenant_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['controles_oca','inspecciones_oca','incidencias_oca','oca_documentos'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
      execute format($policy$
        create policy %I
        on public.%I
        for select
        to authenticated
        using (deleted_at is null and (public.can_coordinate_tenant(tenant_id) or public.has_tenant_role_any(tenant_id, array['inspector_oca','cliente','cliente_lectura'])))
      $policy$, table_name || '_select', table_name);
      execute format($policy$
        create policy %I
        on public.%I
        for insert
        to authenticated
        with check (public.can_coordinate_tenant(tenant_id) or public.has_tenant_role_any(tenant_id, array['inspector_oca']))
      $policy$, table_name || '_insert', table_name);
      execute format($policy$
        create policy %I
        on public.%I
        for update
        to authenticated
        using (deleted_at is null and (public.can_coordinate_tenant(tenant_id) or public.has_tenant_role_any(tenant_id, array['inspector_oca'])))
        with check (public.can_coordinate_tenant(tenant_id) or public.has_tenant_role_any(tenant_id, array['inspector_oca']))
      $policy$, table_name || '_update', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

