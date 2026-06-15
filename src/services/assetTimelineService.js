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

function buildAssetTimeline({ workOrders, incidents, visits, materials, reports, incidentPhotos }) {
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
    visits: [],
    materials: [],
    reports: [],
    incidentPhotos: [],
    timeline: [],
    metrics: { workOrders: 0, openWorkOrders: 0, incidents: 0, openIncidents: 0, materials: 0, reports: 0, photos: 0 }
  };
}
