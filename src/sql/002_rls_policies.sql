create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and global_role = 'super_admin'
  );
$$;

create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.tenant_members
  where user_id = auth.uid()
    and estado = 'activo';
$$;

create or replace function public.has_tenant_access(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = tenant_uuid
        and user_id = auth.uid()
        and role in ('admin_cliente', 'tecnico', 'cliente_lectura')
        and estado = 'activo'
    );
$$;

create or replace function public.has_tenant_role(tenant_uuid uuid, role_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = tenant_uuid
        and user_id = auth.uid()
        and role = role_text
        and estado = 'activo'
    );
$$;

create or replace function public.can_manage_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.has_tenant_role(tenant_uuid, 'admin_cliente');
$$;

create or replace function public.can_view_document(document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documentos d
    where d.id = document_id
      and d.deleted_at is null
      and (
        public.can_manage_tenant(d.tenant_id)
        or (
          public.has_tenant_role(d.tenant_id, 'tecnico')
          and d.visibilidad in ('privado', 'tecnico', 'cliente')
        )
        or (
          public.has_tenant_role(d.tenant_id, 'cliente_lectura')
          and d.visibilidad = 'cliente'
        )
      )
  );
$$;

create or replace function public.can_view_media(media_tenant_id uuid, media_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_tenant(media_tenant_id)
    or (public.has_tenant_role(media_tenant_id, 'tecnico') and media_visibility in ('privado', 'tecnico', 'cliente'))
    or (public.has_tenant_role(media_tenant_id, 'cliente_lectura') and media_visibility = 'cliente');
$$;

create or replace function public.log_audit(
  tenant_uuid uuid,
  action_text text,
  entity_type_text text default null,
  entity_uuid uuid default null,
  metadata_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  log_id uuid;
begin
  if tenant_uuid is not null and not public.has_tenant_access(tenant_uuid) then
    raise exception 'permission denied for tenant %', tenant_uuid;
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (tenant_uuid, auth.uid(), action_text, entity_type_text, entity_uuid, coalesce(metadata_json, '{}'::jsonb))
  returning id into log_id;

  return log_id;
end;
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.instalaciones enable row level security;
alter table public.ubicaciones enable row level security;
alter table public.activos enable row level security;
alter table public.documentos enable row level security;
alter table public.videos enable row level security;
alter table public.fotos enable row level security;
alter table public.historial_mantenimiento enable row level security;
alter table public.incidencias enable row level security;
alter table public.qr_registry enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_queue enable row level security;

create policy tenants_select on public.tenants
for select using (deleted_at is null and public.has_tenant_access(id));
create policy tenants_insert on public.tenants
for insert with check (public.is_super_admin());
create policy tenants_update on public.tenants
for update using (public.can_manage_tenant(id)) with check (public.can_manage_tenant(id));

create policy profiles_select on public.profiles
for select using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.tenant_members tm_self
    join public.tenant_members tm_other on tm_other.tenant_id = tm_self.tenant_id
    where tm_self.user_id = auth.uid()
      and tm_other.user_id = profiles.id
      and tm_self.estado = 'activo'
      and tm_other.estado = 'activo'
  )
);
create policy profiles_insert_own on public.profiles
for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
for update using (id = auth.uid() or public.is_super_admin()) with check (id = auth.uid() or public.is_super_admin());

create policy tenant_members_select on public.tenant_members
for select using (public.has_tenant_access(tenant_id));
create policy tenant_members_manage on public.tenant_members
for all using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create policy tenant_invitations_select on public.tenant_invitations
for select using (public.can_manage_tenant(tenant_id));
create policy tenant_invitations_update on public.tenant_invitations
for update using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create or replace function public.create_tenant_invitation(
  tenant_uuid uuid,
  invite_email text,
  invite_role text,
  require_mfa boolean default false
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  inserted_id uuid;
  inserted_expires_at timestamptz;
begin
  if not public.can_manage_tenant(tenant_uuid) then
    raise exception 'permission denied';
  end if;

  if invite_role not in ('admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura') then
    raise exception 'invalid role';
  end if;

  raw_token := public.secure_token(32);

  insert into public.tenant_invitations (
    tenant_id,
    email,
    role,
    token_hash,
    mfa_required,
    invited_by
  )
  values (
    tenant_uuid,
    lower(trim(invite_email)),
    invite_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    coalesce(require_mfa, false),
    auth.uid()
  )
  returning id, expires_at into inserted_id, inserted_expires_at;

  perform public.log_audit(
    tenant_uuid,
    'create_invitation',
    'tenant_invitation',
    inserted_id,
    jsonb_build_object('email', lower(trim(invite_email)), 'role', invite_role, 'mfa_required', coalesce(require_mfa, false))
  );

  return query select inserted_id, raw_token, inserted_expires_at;
end;
$$;

create or replace function public.accept_tenant_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tenant_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
  into invitation
  from public.tenant_invitations
  where token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
    and estado = 'pendiente'
    and expires_at > now()
  limit 1;

  if invitation.id is null then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(invitation.email) <> current_email then
    raise exception 'invitation email does not match current user';
  end if;

  insert into public.profiles (id, email, global_role, mfa_required)
  values (auth.uid(), current_email, 'usuario', invitation.mfa_required)
  on conflict (id) do update
  set email = excluded.email,
      mfa_required = public.profiles.mfa_required or excluded.mfa_required,
      updated_at = now();

  insert into public.tenant_members (tenant_id, user_id, role, estado)
  values (invitation.tenant_id, auth.uid(), invitation.role, 'activo')
  on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      estado = 'activo',
      updated_at = now();

  update public.tenant_invitations
  set estado = 'aceptada',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = invitation.id;

  perform public.log_audit(
    invitation.tenant_id,
    'accept_invitation',
    'tenant_invitation',
    invitation.id,
    jsonb_build_object('email', current_email, 'role', invitation.role)
  );

  return invitation.tenant_id;
end;
$$;

create or replace function public.set_member_mfa_required(member_user_id uuid, require_mfa boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  managed_tenant uuid;
begin
  select tm.tenant_id
  into managed_tenant
  from public.tenant_members tm
  where tm.user_id = member_user_id
    and public.can_manage_tenant(tm.tenant_id)
  limit 1;

  if managed_tenant is null then
    raise exception 'permission denied';
  end if;

  update public.profiles
  set mfa_required = require_mfa,
      updated_at = now()
  where id = member_user_id;

  perform public.log_audit(
    managed_tenant,
    'update_member_mfa',
    'profile',
    member_user_id,
    jsonb_build_object('mfa_required', require_mfa)
  );
end;
$$;

create policy instalaciones_select on public.instalaciones
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy instalaciones_insert on public.instalaciones
for insert with check (public.can_manage_tenant(tenant_id));
create policy instalaciones_update on public.instalaciones
for update using (deleted_at is null and public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create policy ubicaciones_select on public.ubicaciones
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy ubicaciones_insert on public.ubicaciones
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy ubicaciones_update on public.ubicaciones
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy activos_select on public.activos
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy activos_insert on public.activos
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy activos_update on public.activos
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy documentos_select on public.documentos
for select using (public.can_view_document(id));
create policy documentos_insert on public.documentos
for insert with check (
  public.can_manage_tenant(tenant_id)
  or (public.has_tenant_role(tenant_id, 'tecnico') and visibilidad in ('tecnico', 'cliente'))
);
create policy documentos_update_admin on public.documentos
for update using (deleted_at is null and public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));
create policy documentos_update_tecnico_limited on public.documentos
for update using (deleted_at is null and public.has_tenant_role(tenant_id, 'tecnico') and visibilidad <> 'privado')
with check (public.has_tenant_role(tenant_id, 'tecnico') and visibilidad in ('tecnico', 'cliente'));

create policy videos_select on public.videos
for select using (deleted_at is null and public.can_view_media(tenant_id, visibilidad));
create policy videos_insert on public.videos
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy videos_update on public.videos
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy fotos_select on public.fotos
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy fotos_insert on public.fotos
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy fotos_update on public.fotos
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy historial_select on public.historial_mantenimiento
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy historial_insert on public.historial_mantenimiento
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy historial_update on public.historial_mantenimiento
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy incidencias_select on public.incidencias
for select using (deleted_at is null and public.has_tenant_access(tenant_id));
create policy incidencias_insert on public.incidencias
for insert with check (public.has_tenant_access(tenant_id));
create policy incidencias_update on public.incidencias
for update using (deleted_at is null and (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico')))
with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));

create policy qr_registry_select on public.qr_registry
for select using (estado = 'activo' and public.has_tenant_access(tenant_id));
create policy qr_registry_insert on public.qr_registry
for insert with check (public.can_manage_tenant(tenant_id) or public.has_tenant_role(tenant_id, 'tecnico'));
create policy qr_registry_update on public.qr_registry
for update using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create policy audit_logs_select on public.audit_logs
for select using (
  public.is_super_admin()
  or (tenant_id is not null and public.has_tenant_role(tenant_id, 'admin_cliente'))
);
create policy audit_logs_insert on public.audit_logs
for insert with check (user_id = auth.uid() and (tenant_id is null or public.has_tenant_access(tenant_id)));

create policy sync_queue_select on public.sync_queue
for select using (user_id = auth.uid() and public.has_tenant_access(tenant_id));
create policy sync_queue_insert on public.sync_queue
for insert with check (user_id = auth.uid() and public.has_tenant_access(tenant_id));
create policy sync_queue_update on public.sync_queue
for update using (user_id = auth.uid() and public.has_tenant_access(tenant_id))
with check (user_id = auth.uid() and public.has_tenant_access(tenant_id));

create or replace function public.resolve_qr(qr_token_text text)
returns table (
  tenant_id uuid,
  entity_type text,
  entity_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select qr.tenant_id, qr.entity_type, qr.entity_id
  from public.qr_registry qr
  where qr.token = qr_token_text
    and qr.estado = 'activo'
    and public.has_tenant_access(qr.tenant_id);
end;
$$;

create or replace function public.export_installation_json(installation_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.can_manage_tenant(i.tenant_id) then
      jsonb_build_object('error', 'permission_denied')
    else
      jsonb_build_object(
        'instalacion', to_jsonb(i) - 'deleted_at',
        'ubicaciones', coalesce((select jsonb_agg(to_jsonb(u) - 'deleted_at') from public.ubicaciones u where u.instalacion_id = i.id and u.deleted_at is null), '[]'::jsonb),
        'activos', coalesce((select jsonb_agg(to_jsonb(a) - 'deleted_at') from public.activos a where a.instalacion_id = i.id and a.deleted_at is null), '[]'::jsonb),
        'historial', coalesce((select jsonb_agg(to_jsonb(h) - 'deleted_at') from public.historial_mantenimiento h join public.activos a on a.id = h.activo_id where a.instalacion_id = i.id and h.deleted_at is null), '[]'::jsonb),
        'incidencias', coalesce((select jsonb_agg(to_jsonb(inc) - 'deleted_at') from public.incidencias inc where inc.instalacion_id = i.id and inc.deleted_at is null), '[]'::jsonb),
        'documentos_metadata', coalesce((select jsonb_agg(to_jsonb(d) - 'storage_path' - 'deleted_at') from public.documentos d where d.instalacion_id = i.id and d.deleted_at is null), '[]'::jsonb),
        'generated_at', now()
      )
    end
  from public.instalaciones i
  where i.id = installation_uuid and i.deleted_at is null;
$$;
