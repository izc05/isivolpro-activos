import { supabase } from './supabaseClient';

const SEARCH_LIMIT_PER_TYPE = 6;

function cleanSearchTerm(value = '') {
  return String(value)
    .trim()
    .replace(/[%',()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function ilikeOr(fields, term) {
  return fields.map((field) => `${field}.ilike.%${term}%`).join(',');
}

function compactParts(parts) {
  return parts.filter(Boolean).join(' - ');
}

function scoreResult(result, term) {
  const normalizedTerm = term.toLowerCase();
  const title = String(result.title || '').toLowerCase();
  const text = String(result.searchText || '').toLowerCase();
  if (title === normalizedTerm) return 0;
  if (title.startsWith(normalizedTerm)) return 1;
  if (title.includes(normalizedTerm)) return 2;
  if (text.includes(normalizedTerm)) return 3;
  return 4;
}

function normalizeAsset(row) {
  return {
    type: 'activo',
    id: row.id,
    title: row.nombre || 'Activo sin nombre',
    subtitle: compactParts([row.instalaciones?.nombre, row.ubicaciones?.nombre, row.tipo, row.numero_serie]),
    badge: row.estado || 'Activo',
    to: `/activos/${row.id}`,
    searchText: compactParts([row.nombre, row.tipo, row.marca, row.modelo, row.numero_serie, row.referencia])
  };
}

function normalizeInstallation(row) {
  return {
    type: 'instalacion',
    id: row.id,
    title: row.nombre || 'Instalacion sin nombre',
    subtitle: compactParts([row.direccion, row.tipo, row.codigo]),
    badge: row.estado || 'Instalacion',
    to: `/instalaciones/${row.id}`,
    searchText: compactParts([row.nombre, row.direccion, row.tipo, row.codigo])
  };
}

function normalizeLocation(row) {
  return {
    type: 'ubicacion',
    id: row.id,
    title: row.nombre || 'Ubicacion sin nombre',
    subtitle: compactParts([row.instalaciones?.nombre, row.tipo, row.planta, row.zona]),
    badge: 'Ubicacion',
    to: `/ubicaciones/${row.id}`,
    searchText: compactParts([row.nombre, row.tipo, row.planta, row.zona, row.instalaciones?.nombre])
  };
}

function normalizeWorkOrder(row) {
  return {
    type: 'ot',
    id: row.id,
    title: row.codigo_ot || row.titulo || `OT ${row.id.slice(0, 8)}`,
    subtitle: compactParts([row.titulo, row.instalaciones?.nombre, row.activos?.nombre]),
    badge: row.estado || 'OT',
    to: `/ots/${row.id}`,
    searchText: compactParts([row.codigo_ot, row.titulo, row.descripcion, row.estado, row.instalaciones?.nombre, row.activos?.nombre])
  };
}

export async function globalSearch(tenantId, value, options = {}) {
  const term = cleanSearchTerm(value);
  const limit = Number(options.limit || SEARCH_LIMIT_PER_TYPE);
  const installationId = options.installationId || null;
  if (!tenantId || term.length < 2) return [];

  let assetsQuery = supabase
    .from('activos')
    .select('id,nombre,tipo,marca,modelo,numero_serie,referencia,estado,instalaciones(nombre),ubicaciones(nombre)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .or(ilikeOr(['nombre', 'tipo', 'marca', 'modelo', 'numero_serie', 'referencia'], term))
    .order('nombre', { ascending: true })
    .limit(limit);

  let installationsQuery = supabase
    .from('instalaciones')
    .select('id,nombre,codigo,direccion,tipo,estado')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .or(ilikeOr(['nombre', 'codigo', 'direccion', 'tipo'], term))
    .order('nombre', { ascending: true })
    .limit(limit);

  let locationsQuery = supabase
    .from('ubicaciones')
    .select('id,nombre,tipo,planta,zona,instalaciones(nombre)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .or(ilikeOr(['nombre', 'tipo', 'planta', 'zona'], term))
    .order('nombre', { ascending: true })
    .limit(limit);

  let workOrdersQuery = supabase
    .from('ordenes_trabajo')
    .select('id,codigo_ot,titulo,descripcion,estado,instalaciones(nombre),activos(nombre)')
    .eq('tenant_id', tenantId)
    .or(ilikeOr(['codigo_ot', 'titulo', 'descripcion', 'estado'], term))
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (installationId) {
    assetsQuery = assetsQuery.eq('instalacion_id', installationId);
    installationsQuery = installationsQuery.eq('id', installationId);
    locationsQuery = locationsQuery.eq('instalacion_id', installationId);
    workOrdersQuery = workOrdersQuery.eq('instalacion_id', installationId);
  }

  const [assets, installations, locations, workOrders] = await Promise.all([assetsQuery, installationsQuery, locationsQuery, workOrdersQuery]);
  const firstError = [assets.error, installations.error, locations.error, workOrders.error].find(Boolean);
  if (firstError) throw firstError;

  return [
    ...(assets.data || []).map(normalizeAsset),
    ...(installations.data || []).map(normalizeInstallation),
    ...(locations.data || []).map(normalizeLocation),
    ...(workOrders.data || []).map(normalizeWorkOrder)
  ]
    .sort((a, b) => scoreResult(a, term) - scoreResult(b, term) || a.title.localeCompare(b.title))
    .slice(0, limit * 2);
}
