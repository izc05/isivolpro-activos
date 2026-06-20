import { supabase } from './supabaseClient';

export async function loadAssetTimeline(tenantId, assetId) {
  if (!tenantId || !assetId) return emptyAssetTimeline();

  const { data: workOrders, error: workOrdersError } = await supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre), ubicaciones(nombre), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('activo_id', assetId)
    .order('created_at', { ascending: false });
  if (workOrdersError) throw workOrdersError;

  const { data: incidents, error: incidentsError } = await supabase
    .from('incidencias')
    .select('*, external_incident_reports(id,reporter_name,reporter_contact,created_at), incident_photos(id,source,tipo_foto,file_name,mime_type,size_bytes,data_url,comentario,created_at)')
    .eq('tenant_id', tenantId)
    .eq('activo_id', assetId)
    .order('fecha_apertura', { ascending: false });
  if (incidentsError) throw incidentsError;

  const { data: history, error: historyError } = await supabase
    .from('historial_mantenimiento')
    .select('*, ordenes_trabajo(id,codigo_ot), tecnico:profiles!historial_mantenimiento_tecnico_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('activo_id', assetId)
    .is('deleted_at', null)
    .order('fecha', { ascending: false });
  if (historyError) throw historyError;

  const { data: scheduled, error: scheduledError } = await supabase
    .from('mantenimientos_programados')
    .select('*, ordenes_trabajo(id,codigo_ot,estado), plan:planes_mantenimiento(nombre)')
    .eq('tenant_id', tenantId)
    .eq('activo_id', assetId)
    .is('deleted_at', null)
    .order('fecha_programada', { ascending: false });
  if (scheduledError) {
    if (!String(scheduledError.message || '').includes('mantenimientos_programados')) throw scheduledError;
  }

  const { data: plans, error: plansError } = await supabase
    .from('planes_mantenimiento')
    .select('*, responsable:profiles!planes_mantenimiento_responsable_id_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('activo_id', assetId)
    .is('deleted_at', null)
    .order('fecha_proxima_realizacion', { ascending: true });
  if (plansError) {
    if (!String(plansError.message || '').includes('planes_mantenimiento')) throw plansError;
  }

  const otIds = (workOrders || []).map((item) => item.id);
  const incidentIds = (incidents || []).map((item) => item.id);

  const [visits, materials, reports, incidentPhotos] = await Promise.all([
    otIds.length ? queryByIds('ot_visitas', tenantId, 'ot_id', otIds, 'fecha_inicio') : Promise.resolve([]),
    otIds.length ? queryByIds('ot_visita_materiales', tenantId, 'ot_id', otIds, 'created_at') : Promise.resolve([]),
    otIds.length ? queryByIds('ot_informes', tenantId, 'ot_id', otIds, 'created_at') : Promise.resolve([]),
    incidentIds.length ? queryByIds('incident_photos', tenantId, 'incidencia_id', incidentIds, 'created_at') : Promise.resolve([])
  ]);

  return buildAssetTimeline({
    workOrders: workOrders || [],
    incidents: incidents || [],
    history: history || [],
    plans: plans || [],
    scheduled: scheduled || [],
    visits,
    materials,
    reports,
    incidentPhotos
  });
}

async function queryByIds(table, tenantId, field, ids, orderField) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('tenant_id', tenantId)
    .in(field, ids)
    .order(orderField, { ascending: false });
  if (error) throw error;
  return data || [];
}

function buildAssetTimeline({ workOrders, incidents, history, plans, scheduled, visits, materials, reports, incidentPhotos }) {
  const visitsByOt = groupBy(visits, 'ot_id');
  const materialsByOt = groupBy(materials, 'ot_id');
  const reportsByOt = groupBy(reports, 'ot_id');
  const photosByIncident = groupBy(incidentPhotos, 'incidencia_id');

  const workOrdersFull = workOrders.map((ot) => ({
    ...ot,
    visits: visitsByOt.get(ot.id) || [],
    materials: materialsByOt.get(ot.id) || [],
    reports: reportsByOt.get(ot.id) || []
  }));

  const incidentsFull = incidents.map((incident) => ({
    ...incident,
    photos: photosByIncident.get(incident.id) || incident.incident_photos || []
  }));

  const timeline = [
    ...history.map((entry) => ({
      id: `hist-${entry.id}`,
      source: 'historial',
      date: entry.fecha_fin || entry.fecha || entry.created_at,
      title: entry.titulo,
      subtitle: entry.origen === 'manual' ? 'Registro histórico' : entry.ordenes_trabajo?.codigo_ot || entry.tipo,
      status: entry.resultado || entry.estado_activo_final || entry.estado_final,
      priority: null,
      link: entry.ot_id ? `/ots/${entry.ot_id}` : '/mantenimiento/historial',
      meta: {
        technician: entry.tecnico?.nombre || entry.tecnico?.email || 'Sin técnico',
        planned: entry.trabajo_previsto || '',
        done: entry.trabajo_realizado || entry.descripcion || '',
        cost: entry.coste_total || 0,
        next: entry.proxima_fecha || entry.proxima_accion || ''
      }
    })),
    ...scheduled.filter((item) => !['completado', 'cancelado', 'no_aplica'].includes(item.estado)).map((item) => ({
      id: `mnt-${item.id}`,
      source: 'mantenimiento',
      date: item.fecha_programada || item.created_at,
      title: item.titulo,
      subtitle: item.plan?.nombre || item.origen || 'Mantenimiento programado',
      status: item.estado,
      priority: item.prioridad,
      link: item.ot_id ? `/ots/${item.ot_id}` : '/mantenimiento/pendientes',
      meta: {
        planned: item.descripcion || '',
        hasOt: Boolean(item.ot_id)
      }
    })),
    ...workOrdersFull.map((ot) => ({
      id: `ot-${ot.id}`,
      source: 'ot',
      date: ot.fecha_fin || ot.fecha_inicio || ot.fecha_prevista || ot.created_at,
      title: ot.titulo,
      subtitle: ot.codigo_ot || ot.id.slice(0, 8),
      status: ot.estado,
      priority: ot.prioridad,
      link: `/ots/${ot.id}`,
      meta: {
        technician: ot.assigned?.nombre || ot.assigned?.email || 'Sin técnico',
        visits: ot.visits.length,
        materials: ot.materials.length,
        reports: ot.reports.length
      }
    })),
    ...incidentsFull.map((incident) => ({
      id: `inc-${incident.id}`,
      source: 'incidencia',
      date: incident.fecha_cierre || incident.fecha_apertura || incident.created_at,
      title: incident.titulo,
      subtitle: externalReporterLabel(incident),
      status: incident.estado,
      priority: incident.prioridad,
      link: incident.ot_id ? `/ots/${incident.ot_id}` : '/incidencias',
      meta: {
        photos: incident.photos.length,
        hasOt: Boolean(incident.ot_id),
        description: incident.descripcion || ''
      }
    }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    workOrders: workOrdersFull,
    incidents: incidentsFull,
    history,
    plans,
    scheduled,
    visits,
    materials,
    reports,
    incidentPhotos,
    timeline,
    metrics: {
      workOrders: workOrdersFull.length,
      openWorkOrders: workOrdersFull.filter((ot) => !['VALIDADA', 'CERRADA', 'CANCELADA'].includes(ot.estado)).length,
      incidents: incidentsFull.length,
      openIncidents: incidentsFull.filter((incident) => !['cerrada', 'descartada', 'convertida_en_ot'].includes(incident.estado)).length,
      history: history.length,
      plans: plans.filter((plan) => plan.activo).length,
      scheduled: scheduled.filter((item) => !['completado', 'cancelado', 'no_aplica'].includes(item.estado)).length,
      materials: materials.length,
      reports: reports.length,
      photos: incidentPhotos.length
    }
  };
}

function groupBy(rows, field) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[field];
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function externalReporterLabel(incident) {
  const report = Array.isArray(incident.external_incident_reports)
    ? incident.external_incident_reports[0]
    : incident.external_incident_reports;
  if (!report) return 'Incidencia interna';
  return `QR público · ${report.reporter_name || 'sin nombre'}`;
}

function emptyAssetTimeline() {
  return {
    workOrders: [],
    incidents: [],
    history: [],
    plans: [],
    scheduled: [],
    visits: [],
    materials: [],
    reports: [],
    incidentPhotos: [],
    timeline: [],
    metrics: { workOrders: 0, openWorkOrders: 0, incidents: 0, openIncidents: 0, history: 0, plans: 0, scheduled: 0, materials: 0, reports: 0, photos: 0 }
  };
}
