import { supabase } from './supabaseClient';
import { statusForScheduledDate } from '../constants/maintenance';

export async function loadMaintenanceDashboard(tenantId, installationId = null) {
  if (!tenantId) return emptyDashboard();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = addDays(7);
  const in30 = addDays(30);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  let scheduledQuery = supabase.from('mantenimientos_programados').select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre,criticidad,estado), ordenes_trabajo(id,codigo_ot,estado), assigned:profiles!mantenimientos_programados_assigned_to_fkey(nombre,email)').eq('tenant_id', tenantId).is('deleted_at', null);
  let plansQuery = supabase.from('planes_mantenimiento').select('*, activos(id,nombre)').eq('tenant_id', tenantId).is('deleted_at', null);
  let assetsQuery = supabase.from('activos').select('id,nombre,estado,criticidad,instalacion_id').eq('tenant_id', tenantId).is('deleted_at', null);
  let historyQuery = supabase.from('historial_mantenimiento').select('*, activos(nombre,instalacion_id), tecnico:profiles!historial_mantenimiento_tecnico_id_fkey(nombre,email)').eq('tenant_id', tenantId).is('deleted_at', null).order('fecha', { ascending: false }).limit(40);

  if (installationId) {
    scheduledQuery = scheduledQuery.eq('instalacion_id', installationId);
    plansQuery = plansQuery.eq('instalacion_id', installationId);
    assetsQuery = assetsQuery.eq('instalacion_id', installationId);
  }

  const [scheduledResult, plansResult, assetsResult, historyResult] = await Promise.all([
    scheduledQuery,
    plansQuery,
    assetsQuery,
    historyQuery
  ]);
  if (scheduledResult.error) throw scheduledResult.error;
  if (plansResult.error) throw plansResult.error;
  if (assetsResult.error) throw assetsResult.error;
  if (historyResult.error) throw historyResult.error;

  const scheduled = scheduledResult.data || [];
  const plans = plansResult.data || [];
  const assets = assetsResult.data || [];
  const history = (historyResult.data || [])
    .filter((item) => !installationId || item.activos?.instalacion_id === installationId)
    .slice(0, 12);
  const activePlans = plans.filter((plan) => plan.activo);
  const plannedAssetIds = new Set(activePlans.map((plan) => plan.activo_id));
  const currentScheduled = scheduled.map((item) => ({ ...item, estado_calculado: item.estado === 'completado' ? item.estado : statusForScheduledDate(item.fecha_programada) }));
  const completedMonth = currentScheduled.filter((item) => item.completed_at?.slice(0, 10) >= monthStartIso || (item.estado === 'completado' && item.fecha_programada >= monthStartIso));
  const preventiveMonth = currentScheduled.filter((item) => item.tipo === 'preventivo' && item.fecha_programada >= monthStartIso && item.fecha_programada <= today);
  const preventiveCompleted = preventiveMonth.filter((item) => item.estado === 'completado').length;

  return {
    metrics: {
      today: currentScheduled.filter((item) => item.fecha_programada === today && item.estado !== 'completado').length,
      next7: currentScheduled.filter((item) => item.fecha_programada > today && item.fecha_programada <= in7 && item.estado !== 'completado').length,
      next30: currentScheduled.filter((item) => item.fecha_programada > today && item.fecha_programada <= in30 && item.estado !== 'completado').length,
      overdue: currentScheduled.filter((item) => item.estado_calculado === 'vencido' && item.estado !== 'completado').length,
      openCorrective: currentScheduled.filter((item) => item.tipo === 'correctivo' && !['completado', 'cancelado', 'no_aplica'].includes(item.estado)).length,
      urgentCorrective: currentScheduled.filter((item) => item.tipo === 'correctivo' && ['urgente', 'critica'].includes(item.prioridad) && !['completado', 'cancelado'].includes(item.estado)).length,
      brokenAssets: assets.filter((asset) => asset.estado === 'averiado').length,
      outOfServiceAssets: assets.filter((asset) => asset.estado === 'fuera_servicio').length,
      pendingMaterial: currentScheduled.filter((item) => item.estado === 'pendiente_material').length,
      activePlans: activePlans.length,
      assetsWithoutPlan: assets.filter((asset) => !plannedAssetIds.has(asset.id)).length,
      monthlyCompliance: preventiveMonth.length ? Math.round((preventiveCompleted / preventiveMonth.length) * 100) : 100,
      monthlyCost: completedMonth.reduce((sum, item) => sum + Number(item.coste_total || 0), 0)
    },
    overdue: currentScheduled
      .filter((item) => item.estado_calculado === 'vencido' && item.estado !== 'completado')
      .sort((a, b) => criticalityScore(b.activos?.criticidad) - criticalityScore(a.activos?.criticidad) || new Date(a.fecha_programada) - new Date(b.fecha_programada)),
    upcoming: currentScheduled.filter((item) => item.fecha_programada >= today && item.fecha_programada <= in30 && item.estado !== 'completado').sort((a, b) => new Date(a.fecha_programada) - new Date(b.fecha_programada)),
    corrective: currentScheduled.filter((item) => item.tipo === 'correctivo' && !['completado', 'cancelado', 'no_aplica'].includes(item.estado)),
    latest: history
  };
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function criticalityScore(value) {
  return { critica: 4, alta: 3, media: 2, baja: 1 }[value] || 0;
}

function emptyDashboard() {
  return { metrics: {}, overdue: [], upcoming: [], corrective: [], latest: [] };
}
