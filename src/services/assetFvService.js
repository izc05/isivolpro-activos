const FV_ASSET_KEYWORDS = ['fv', 'fotovolta', 'solar', 'inversor', 'string', 'modulo', 'panel', 'cuadro dc', 'cuadro ac', 'contador', 'vertido', 'seccionador', 'bomberos'];

function textOf(asset = {}) {
  return [asset.tipo, asset.nombre, asset.marca, asset.modelo, asset.referencia, asset.numero_serie, asset.observaciones]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isFvAsset(asset = {}) {
  const text = textOf(asset);
  return FV_ASSET_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function fvAssetType(asset = {}) {
  const text = textOf(asset);
  if (text.includes('inversor')) return 'inversor';
  if (text.includes('string') || text.includes('campo') || text.includes('modulo') || text.includes('panel')) return 'campo_fv';
  if (text.includes('dc') || text.includes('combiner')) return 'cuadro_dc';
  if (text.includes('ac')) return 'cuadro_ac';
  if (text.includes('contador') || text.includes('vertido')) return 'contador';
  if (text.includes('seccionador') || text.includes('bomberos') || text.includes('emergencia')) return 'seguridad';
  return 'otro_fv';
}

export const FV_ASSET_TYPE_LABELS = {
  inversor: 'Inversor FV',
  campo_fv: 'Campo FV / strings',
  cuadro_dc: 'Cuadro DC FV',
  cuadro_ac: 'Cuadro AC FV',
  contador: 'Contador / vertido cero',
  seguridad: 'Seguridad FV',
  otro_fv: 'Otros FV'
};

export function fvAssetTypeLabel(asset = {}) {
  return FV_ASSET_TYPE_LABELS[fvAssetType(asset)] || 'FV';
}

export function fvAssetRisk(asset = {}, workOrders = [], plans = []) {
  const today = new Date();
  const assetOrders = workOrders.filter((order) => order.activo_id === asset.id && !['VALIDADA', 'CERRADA', 'CANCELADA'].includes(String(order.estado || '').toUpperCase()));
  const validationOrders = workOrders.filter((order) => order.activo_id === asset.id && String(order.estado || '').toUpperCase() === 'FINALIZADA');
  const assetPlans = plans.filter((plan) => plan.activo_id === asset.id && plan.activo !== false);
  const overduePlans = assetPlans.filter((plan) => plan.fecha_proxima_realizacion && new Date(plan.fecha_proxima_realizacion) < today);
  const nextReviewOverdue = asset.fecha_proxima_revision && new Date(asset.fecha_proxima_revision) < today;
  const degraded = ['pendiente', 'averiado', 'fuera_servicio'].includes(asset.estado);

  if (degraded) return { tone: 'danger', label: `Estado ${asset.estado}`, score: 100 };
  if (overduePlans.length > 0 || nextReviewOverdue) return { tone: 'danger', label: 'Revisión vencida', score: 80 };
  if (validationOrders.length > 0) return { tone: 'warn', label: 'OT pendiente validar', score: 65 };
  if (assetOrders.length > 0) return { tone: 'warn', label: `${assetOrders.length} OT abierta(s)`, score: 50 };
  if (['alta', 'critica'].includes(asset.criticidad)) return { tone: 'ok', label: `Crítico ${asset.criticidad}`, score: 20 };
  return { tone: 'ok', label: 'Operativo', score: 0 };
}

export function summarizeFvAssets(assets = [], workOrders = [], plans = []) {
  const fvAssets = assets.filter(isFvAsset);
  const risks = fvAssets.map((asset) => fvAssetRisk(asset, workOrders, plans));
  return {
    total: fvAssets.length,
    inverters: fvAssets.filter((asset) => fvAssetType(asset) === 'inversor').length,
    fields: fvAssets.filter((asset) => fvAssetType(asset) === 'campo_fv').length,
    dcBoards: fvAssets.filter((asset) => fvAssetType(asset) === 'cuadro_dc').length,
    acBoards: fvAssets.filter((asset) => fvAssetType(asset) === 'cuadro_ac').length,
    meters: fvAssets.filter((asset) => fvAssetType(asset) === 'contador').length,
    critical: fvAssets.filter((asset) => ['alta', 'critica'].includes(asset.criticidad)).length,
    risk: risks.filter((risk) => ['danger', 'warn'].includes(risk.tone)).length
  };
}

export function sortFvAssets(a, b, workOrders = [], plans = []) {
  return fvAssetRisk(b, workOrders, plans).score - fvAssetRisk(a, workOrders, plans).score;
}
