export const FV_INSTALLATION_TYPES = ['fotovoltaica', 'fv', 'solar', 'autoconsumo'];

const FV_KEYWORDS = [
  'fotovoltaica',
  'fotovoltaico',
  'fv',
  'solar',
  'autoconsumo',
  'inversor',
  'string',
  'modulo',
  'panel',
  'vertido cero',
  'contador bidireccional',
  'cuadro dc',
  'cuadro ac'
];

function textOf(...values) {
  return values.filter(Boolean).join(' ').toLowerCase();
}

export function isFvInstallation(installation = {}) {
  const text = textOf(installation.tipo, installation.nombre, installation.codigo, installation.descripcion);
  return FV_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function isFvAsset(asset = {}) {
  const text = textOf(asset.tipo, asset.nombre, asset.marca, asset.modelo, asset.referencia, asset.observaciones);
  return FV_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function fvAssetFamily(asset = {}) {
  const text = textOf(asset.tipo, asset.nombre, asset.modelo, asset.referencia);
  if (text.includes('inversor')) return 'Inversor';
  if (text.includes('string') || text.includes('campo') || text.includes('modulo') || text.includes('panel')) return 'Campo FV / strings';
  if (text.includes('dc') || text.includes('continua') || text.includes('combiner')) return 'Cuadro DC';
  if (text.includes('ac') || text.includes('alterna')) return 'Cuadro AC';
  if (text.includes('contador') || text.includes('vertido')) return 'Contador / vertido cero';
  if (text.includes('seccionador') || text.includes('bomberos') || text.includes('emergencia')) return 'Seguridad FV';
  return 'Otros FV';
}

export function summarizeFvInstallation(installation = {}, assets = [], locations = [], workOrders = [], plans = []) {
  const installationAssets = assets.filter((asset) => asset.instalacion_id === installation.id);
  const installationLocations = locations.filter((location) => location.instalacion_id === installation.id);
  const installationOrders = workOrders.filter((order) => order.instalacion_id === installation.id);
  const installationPlans = plans.filter((plan) => plan.instalacion_id === installation.id);
  const fvAssets = installationAssets.filter(isFvAsset);
  const criticalAssets = fvAssets.filter((asset) => ['alta', 'critica'].includes(asset.criticidad));
  const pendingAssets = fvAssets.filter((asset) => ['pendiente', 'averiado', 'fuera_servicio'].includes(asset.estado));
  const openOrders = installationOrders.filter((order) => !['VALIDADA', 'CERRADA', 'CANCELADA'].includes(String(order.estado || '').toUpperCase()));
  const validationOrders = installationOrders.filter((order) => String(order.estado || '').toUpperCase() === 'FINALIZADA');
  const duePlans = installationPlans.filter((plan) => plan.activo !== false && plan.fecha_proxima_realizacion && new Date(plan.fecha_proxima_realizacion) < new Date());
  const families = fvAssets.reduce((acc, asset) => {
    const family = fvAssetFamily(asset);
    acc[family] = (acc[family] || 0) + 1;
    return acc;
  }, {});

  return {
    isFv: isFvInstallation(installation) || fvAssets.length > 0,
    locations: installationLocations.length,
    assets: installationAssets.length,
    fvAssets: fvAssets.length,
    criticalAssets: criticalAssets.length,
    pendingAssets: pendingAssets.length,
    openOrders: openOrders.length,
    validationOrders: validationOrders.length,
    preventivePlans: installationPlans.length,
    duePlans: duePlans.length,
    families
  };
}

export function fvInstallationRisk(summary = {}) {
  if (summary.duePlans > 0) return { tone: 'danger', label: `${summary.duePlans} preventivo(s) vencido(s)` };
  if (summary.validationOrders > 0) return { tone: 'warn', label: `${summary.validationOrders} OT pendiente(s) de validar` };
  if (summary.pendingAssets > 0) return { tone: 'warn', label: `${summary.pendingAssets} activo(s) con aviso` };
  if (summary.criticalAssets > 0) return { tone: 'ok', label: `${summary.criticalAssets} activo(s) critico(s) controlados` };
  return { tone: 'ok', label: 'Sin riesgos FV visibles' };
}

export function sortFvInstallations(first, second) {
  const a = first.fvSummary || {};
  const b = second.fvSummary || {};
  const score = (item) => (item.duePlans || 0) * 100 + (item.validationOrders || 0) * 40 + (item.openOrders || 0) * 20 + (item.criticalAssets || 0) * 10;
  return score(b) - score(a);
}
