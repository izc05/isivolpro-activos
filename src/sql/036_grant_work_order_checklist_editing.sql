-- IsiVoltPro - Permisos de edicion para preparar checklist de OT

grant select, insert, update, delete on public.ot_checklist_respuestas to authenticated;

notify pgrst, 'reload schema';
