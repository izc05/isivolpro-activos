-- Verificación no destructiva después de aplicar 038_phase1_work_order_integrity.sql.

do $$
declare
  table_name text;
  policy_count integer;
begin
  if to_regprocedure('public.finalize_work_order_visit(uuid,jsonb)') is null then
    raise exception 'Falta finalize_work_order_visit(uuid,jsonb)';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_guard_work_order_update'
      and tgrelid = 'public.ordenes_trabajo'::regclass
      and not tgisinternal
  ) then
    raise exception 'Falta trg_guard_work_order_update';
  end if;

  foreach table_name in array array['ordenes_trabajo','ot_visitas','ot_checklist_respuestas','ot_fotos','ot_informes','ot_visita_materiales'] loop
    if to_regclass('public.' || table_name) is not null then
      if not exists (
        select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
      ) then
        raise exception 'RLS no está activo en %', table_name;
      end if;

      if table_name <> 'ordenes_trabajo' then
        select count(*) into policy_count
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname in (table_name || '_select', table_name || '_insert', table_name || '_update', table_name || '_delete');
        if policy_count <> 4 then
          raise exception 'Políticas incompletas en %: % de 4', table_name, policy_count;
        end if;
      end if;
    end if;
  end loop;
end $$;

select 'Fase 1 instalada: estructura RLS, triggers y RPC verificados' as resultado;
