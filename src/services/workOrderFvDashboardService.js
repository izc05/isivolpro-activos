import { ACTIVE_WORK_ORDER_STATUSES, normalizedStatus } from '../utils/workOrderLifecycle';

const FV_KEYWORDS = [
  'fotovoltaica',
  'fotovoltaico',
  'fv',
  'solar',
  'panel',
  'modulo',
  'módulo',
  'string',
  'strings',
  'inversor',
  'dc',
  'ac fv',
  'contador bidireccional',
  'vertido cero',
  'seccionador bomberos',
  'seccionador emergencia',
  'marquesina',
  'cubierta'
];

const ASSET_BUCKETS = [
  { key: 'inversor', label: 'Inversor FV', keywords: ['inversor', 'sun2000', 'sungrow', 'huawei'] },
  { key: 'campo', label: 'Campo FV / strings', keywords: ['campo', 'string', 'strings', 'modulo', 'módulo', 'panel', 'placa'] },
  { key: 'cuadro_dc', label: 'Cuadro DC', keywords: ['cuadro dc', 'combiner', 'spd dc', 'dc fv', 'seccionador dc'] },
  { key: 'cuadro_ac', label: 'Cuadro AC', keywords: ['cuadro ac', 'protecciones ac', 'ac fv'] },
  { key: 'contador', label: 'Contador / vertido cero', keywords: ['contador', 'bidireccional', 'vertido cero', 'cvm'] },
  { key: 'seguridad', label: 'Seguridad FV', keywords: ['seccionador', 'bomberos', 'emergencia'] }
];

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function fvSearchText(order = {}) {
  return normalizeText([
    order.codigo_ot,
    order.titulo,
    order.descripcion,
    order.trabajo_solicitado,
    order.instrucciones_tecnico,
    order.resultado_esperado,
    order.tipo,
    order.tipo_ot,
    order.instalaciones?.nombre,
    order.ubicaciones?.nombre,
    order.activos?.nombre,
    order.activos?.tipo,
    order.activos?.marca,
    order.activos?.modelo
  ].filter(Boolean).join(' '));
}

export function isFvWorkOrder(order = {}) {
  const text = fvSearchText(order);
  return FV_KEYWORDS.some((keyword) => text.includes(normalizeText(keyword)));
}

export function fvAssetBucket(order = {}) {
  const text = fvSearchText(order);
  return ASSET_BUCKETS.find((bucket) => bucket.keywords.some((keyword) => text.includes(normalizeText(keyword)))) || { key: 'otro', label: 'FV general' };
}

export function fvAssetBuckets() {
  return [...ASSET_BUCKETS, { key: 'otro', label: 'FV general' }];
}

export function isOpenStatus(status = '') {
  return ACTIVE_WORK_ORDER_STATUSES.includes(normalizedStatus(status));
}

export function isFinalReviewPending(order = {}) {
  return normalizedStatus(order.estado) === 'FINALIZADA' && order.revision_admin_estado !== 'validada';
}

export function isCriticalPriority(priority = '') {
  return ['alta', 'urgente', 'critica'].includes(String(priority || '').toLowerCase());
}

export function isOverdueOrder(order = {}) {
  if (!order.fecha_limite && !order.fecha_prevista) return false;
  if (['VALIDADA', 'CANCELADA'].includes(normalizedStatus(order.estado))) return false;
  const target = new Date(order.fecha_limite || order.fecha_prevista);
  if (Number.isNaN(target.getTime())) return false;
  return target < new Date();
}

export function buildFvDashboardSummary(orders = [], visits = []) {
  const fvOrders = orders.filter(isFvWorkOrder);
  const fvOrderIds = new Set(fvOrders.map((order) => order.id));
  const fvVisits = visits.filter((visit) => fvOrderIds.has(visit.ot_id));
  const open = fvOrders.filter((order) => isOpenStatus(order.estado)).length;
  const inProgress = fvOrders.filter((order) => normalizedStatus(order.estado) === 'EN_CURSO').length;
  const pendingValidation = fvOrders.filter(isFinalReviewPending).length;
  const pendingMaterial = fvOrders.filter((order) => normalizedStatus(order.estado) === 'PENDIENTE_MATERIAL').length;
  const critical = fvOrders.filter((order) => isCriticalPriority(order.prioridad)).length;
  const overdue = fvOrders.filter(isOverdueOrder).length;
  const withoutTechnician = fvOrders.filter((order) => !order.assigned_to && !['VALIDADA', 'CANCELADA'].includes(normalizedStatus(order.estado))).length;
  const activeVisits = fvVisits.filter((visit) => visit.estado === 'EN_CURSO').length;
  const installations = new Set(fvOrders.map((order) => order.instalacion_id).filter(Boolean)).size;
  const buckets = fvAssetBuckets().map((bucket) => ({
    ...bucket,
    count: fvOrders.filter((order) => fvAssetBucket(order).key === bucket.key).length
  }));

  return {
    total: fvOrders.length,
    open,
    inProgress,
    pendingValidation,
    pendingMaterial,
    critical,
    overdue,
    withoutTechnician,
    activeVisits,
    installations,
    buckets
  };
}

export function filterFvOrders(orders = [], filters = {}) {
  const onlyFv = filters.scope !== 'all';
  return orders
    .filter((order) => !onlyFv || isFvWorkOrder(order))
    .filter((order) => {
      if (filters.status === 'abiertas') return isOpenStatus(order.estado);
      if (filters.status === 'pendiente_validar') return isFinalReviewPending(order);
      if (filters.status === 'vencidas') return isOverdueOrder(order);
      if (filters.status === 'pendiente_material') return normalizedStatus(order.estado) === 'PENDIENTE_MATERIAL';
      if (filters.status && filters.status !== 'todos') return normalizedStatus(order.estado) === filters.status;
      return true;
    })
    .filter((order) => filters.priority === 'todas' || order.prioridad === filters.priority)
    .filter((order) => filters.assetType === 'todos' || fvAssetBucket(order).key === filters.assetType)
    .sort(sortFvOperationalOrders);
}

export function sortFvOperationalOrders(a = {}, b = {}) {
  const score = (order) => {
    if (isOverdueOrder(order)) return 0;
    if (isFinalReviewPending(order)) return 1;
    if (normalizedStatus(order.estado) === 'EN_CURSO') return 2;
    if (normalizedStatus(order.estado) === 'PENDIENTE_MATERIAL') return 3;
    if (isCriticalPriority(order.prioridad)) return 4;
    if (isOpenStatus(order.estado)) return 5;
    return 6;
  };
  const byScore = score(a) - score(b);
  if (byScore !== 0) return byScore;
  return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
}

export function fvRiskItems(orders = []) {
  return orders.filter((order) => isOverdueOrder(order) || isFinalReviewPending(order) || normalizedStatus(order.estado) === 'PENDIENTE_MATERIAL' || !order.assigned_to).slice(0, 6);
}
