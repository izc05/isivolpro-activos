import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { nextDateFrom } from '../constants/maintenance';

export async function closeMaintenanceFromWorkOrder(workOrder) {
  if (!workOrder?.tenant_id || !workOrder?.id) throw new Error('No se ha podido identificar la OT.');
  const { data: scheduled, error: scheduledError } = await supabase
    .from('mantenimientos_programados')
    .select('*, plan:planes_mantenimiento(*)')
    .eq('tenant_id', workOrder.tenant_id)
    .eq('ot_id', workOrder.id)
    .maybeSingle();
  if (scheduledError) throw scheduledError;
  if (!scheduled) return null;

  const { data: existing, error: existingError } = await supabase
    .from('historial_mantenimiento')
    .select('id')
    .eq('tenant_id', workOrder.tenant_id)
    .eq('ot_id', workOrder.id)
    .maybeSingle();
  if (existingError) throw existingError;

  const [visitsResult, materialsResult] = await Promise.all([
    supabase.from('ot_visitas').select('*').eq('tenant_id', workOrder.tenant_id).eq('ot_id', workOrder.id).order('fecha_inicio', { ascending: true }),
    supabase.from('ot_visita_materiales').select('*').eq('tenant_id', workOrder.tenant_id).eq('ot_id', workOrder.id)
  ]);
  if (visitsResult.error) throw visitsResult.error;
  if (materialsResult.error) throw materialsResult.error;

  const visits = visitsResult.data || [];
  const materials = materialsResult.data || [];
  const firstVisit = visits[0];
  const lastVisit = visits[visits.length - 1];
  const totalMaterialCost = materials.reduce((sum, item) => sum + Number(item.coste_total || item.coste || 0), 0);
  const start = workOrder.fecha_inicio || firstVisit?.fecha_inicio || workOrder.created_at;
  const end = workOrder.fecha_fin || lastVisit?.fecha_fin || new Date().toISOString();
  const duration = start && end ? Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000)) : null;
  const trabajoRealizado = visits.map((visit) => visit.trabajo_realizado || visit.diagnostico || visit.observaciones).filter(Boolean).join('\n\n') || workOrder.resultado_esperado || null;
  const estadoFinal = lastVisit?.estado_final_activo || workOrder.estado_final_activo || null;
  const historyPayload = {
    tenant_id: workOrder.tenant_id,
    activo_id: scheduled.activo_id,
    fecha: (end || new Date().toISOString()).slice(0, 10),
    tipo: scheduled.tipo,
    titulo: scheduled.titulo,
    descripcion: trabajoRealizado,
    plan_id: scheduled.plan_id,
    mantenimiento_programado_id: scheduled.id,
    ot_id: workOrder.id,
    incidencia_id: scheduled.incidencia_id || null,
    origen: scheduled.origen || 'ot',
    fecha_inicio: start,
    fecha_fin: end,
    trabajo_previsto: scheduled.descripcion || workOrder.trabajo_solicitado || null,
    trabajo_realizado: trabajoRealizado,
    resultado: workOrder.estado,
    tecnico_id: workOrder.assigned_to || lastVisit?.tecnico_id || firstVisit?.tecnico_id || null,
    estado_activo_final: estadoFinal,
    estado_final: estadoFinal,
    tiempo_parada_minutos: duration,
    coste_materiales: totalMaterialCost,
    coste_total: totalMaterialCost,
    proxima_accion: lastVisit?.proxima_accion || null
  };

  const historyQuery = existing
    ? supabase.from('historial_mantenimiento').update(historyPayload).eq('tenant_id', workOrder.tenant_id).eq('id', existing.id).select().single()
    : supabase.from('historial_mantenimiento').insert(historyPayload).select().single();
  const { data: history, error: historyError } = await historyQuery;
  if (historyError) throw historyError;

  await supabase
    .from('mantenimientos_programados')
    .update({ estado: 'completado', completed_at: end })
    .eq('tenant_id', workOrder.tenant_id)
    .eq('id', scheduled.id);

  if (estadoFinal) {
    await supabase
      .from('activos')
      .update({ estado: estadoFinal, fecha_ultima_revision: historyPayload.fecha })
      .eq('tenant_id', workOrder.tenant_id)
      .eq('id', scheduled.activo_id);
  } else {
    await supabase
      .from('activos')
      .update({ fecha_ultima_revision: historyPayload.fecha })
      .eq('tenant_id', workOrder.tenant_id)
      .eq('id', scheduled.activo_id);
  }

  if (scheduled.plan_id && scheduled.plan) {
    const nextDate = nextDateFrom(historyPayload.fecha, scheduled.plan.periodicidad_valor, scheduled.plan.periodicidad_unidad);
    await supabase
      .from('planes_mantenimiento')
      .update({ fecha_ultima_realizacion: historyPayload.fecha, fecha_proxima_realizacion: nextDate })
      .eq('tenant_id', workOrder.tenant_id)
      .eq('id', scheduled.plan_id);
    if (nextDate) {
      await supabase.from('mantenimientos_programados').upsert({
        tenant_id: workOrder.tenant_id,
        plan_id: scheduled.plan_id,
        instalacion_id: scheduled.instalacion_id,
        ubicacion_id: scheduled.ubicacion_id || null,
        activo_id: scheduled.activo_id,
        titulo: scheduled.plan.nombre,
        descripcion: scheduled.plan.descripcion || scheduled.plan.instrucciones || null,
        tipo: scheduled.plan.tipo,
        estado: 'programado',
        prioridad: scheduled.plan.prioridad || 'media',
        fecha_programada: nextDate,
        assigned_to: scheduled.plan.responsable_id || null,
        origen: 'plan'
      }, { onConflict: 'plan_id,fecha_programada' });
    }
  }

  await logAudit({ tenantId: workOrder.tenant_id, action: 'close_maintenance_from_work_order', entityType: 'orden_trabajo', entityId: workOrder.id, metadata: { mantenimientoId: scheduled.id, historyId: history.id } });
  return history;
}
