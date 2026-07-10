export const ALL_INSTALLATIONS_STORAGE_VALUE = '__all_installations__';

export function normalizeContextText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function contextItemSearchText(item = {}) {
  return normalizeContextText([
    item.nombre,
    item.codigo,
    item.direccion,
    item.tipo,
    item.cif,
    item.email
  ].filter(Boolean).join(' '));
}

export function matchesContextSearch(item, query = '') {
  const normalizedQuery = normalizeContextText(query);
  if (!normalizedQuery) return true;
  return normalizedQuery.split(/\s+/).every((term) => contextItemSearchText(item).includes(term));
}

export function resolveInstallationSelection({ installations = [], storedValue = null, currentValue = null } = {}) {
  const items = Array.isArray(installations) ? installations : [];
  const validIds = new Set(items.map((item) => item?.id).filter(Boolean));

  if (storedValue === ALL_INSTALLATIONS_STORAGE_VALUE) return null;
  if (storedValue && validIds.has(storedValue)) return storedValue;
  if (currentValue && validIds.has(currentValue)) return currentValue;
  if (items.length === 1) return items[0].id;
  return null;
}

export function installationSelectionStorageValue(installationId) {
  return installationId || ALL_INSTALLATIONS_STORAGE_VALUE;
}

export function workContextLabel({ tenant, installation, installationCount = 0 } = {}) {
  if (!tenant) return 'Sin cliente activo';
  if (installation) return `${tenant.nombre} / ${installation.nombre}`;
  if (installationCount > 0) return `${tenant.nombre} / Todas las instalaciones`;
  return `${tenant.nombre} / Sin instalaciones`;
}
