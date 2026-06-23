export const TENANT_ROLES = ['administrador', 'coordinador', 'tecnico', 'inspector_oca', 'cliente', 'admin_cliente', 'tecnico_externo', 'cliente_lectura'];

const ROLE_ALIASES = {
  admin_cliente: 'administrador',
  tecnico_externo: 'tecnico',
  cliente_lectura: 'cliente'
};

export const ROLE_LABELS = {
  super_admin: 'Super administrador',
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  admin_cliente: 'Administrador del cliente',
  tecnico: 'Tecnico propio',
  inspector_oca: 'Inspector OCA',
  cliente: 'Cliente',
  tecnico_externo: 'Tecnico externo',
  cliente_lectura: 'Cliente solo lectura'
};

export const ROLE_DESCRIPTIONS = {
  administrador: 'Control total sobre clientes, usuarios, inventario, mantenimiento, OCA, OT, auditoria y configuracion.',
  coordinador: 'Coordina inventario, mantenimiento, incidencias y OT sin privilegios globales de administracion.',
  admin_cliente: 'Gestiona usuarios, instalaciones, QR, documentos, todas las OT, auditoria y ajustes del cliente.',
  tecnico: 'Acceso operativo limitado a sus OT asignadas, checklist, visitas, materiales, fotos, documentos e incidencias permitidas.',
  inspector_oca: 'Acceso limitado a inspecciones, vencimientos, incidencias y documentacion OCA.',
  cliente: 'Consulta limitada de informacion visible para cliente sin modificar datos tecnicos ni usuarios.',
  tecnico_externo: 'Acceso limitado: mis OT, escaner, incidencias y permisos concretos por instalacion.',
  cliente_lectura: 'Consulta informacion visible para cliente sin crear ni modificar datos.'
};

export function normalizeRole(role) {
  return ROLE_ALIASES[role] || role || null;
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || (role ? role.replaceAll('_', ' ') : 'Sin rol asignado');
}

export function buildTenantPermissions({ activeRole, isSuperAdmin = false } = {}) {
  const role = normalizeRole(activeRole);
  const isTenantAdmin = Boolean(isSuperAdmin || role === 'administrador');
  const isCoordinator = role === 'coordinador';
  const isInternalTechnician = role === 'tecnico';
  const isExternalTechnician = activeRole === 'tecnico_externo';
  const isOcaInspector = role === 'inspector_oca';
  const isReadOnlyClient = role === 'cliente';
  const isTenantMember = Boolean(activeRole);
  const canViewInventory = Boolean(isTenantAdmin || isCoordinator || isReadOnlyClient);
  const canManageInventory = Boolean(isTenantAdmin || isCoordinator);
  const canManageWorkOrders = Boolean(isTenantAdmin || isCoordinator);
  const canUseWorkOrders = Boolean(isTenantAdmin || isCoordinator || isInternalTechnician || isExternalTechnician);
  const canManageUsers = Boolean(isTenantAdmin);
  const canViewAudit = Boolean(isTenantAdmin);
  const canUseQrGenerator = Boolean(isTenantAdmin || isCoordinator);
  const canCreateIncidents = Boolean(isTenantAdmin || isCoordinator || isInternalTechnician || isExternalTechnician);
  const canViewOca = Boolean(isTenantAdmin || isCoordinator || isOcaInspector || isReadOnlyClient);
  const canCreateOca = Boolean(isTenantAdmin || isCoordinator || isOcaInspector);
  const canEditOca = Boolean(isTenantAdmin || isCoordinator || isOcaInspector);
  const canManageOcaDocuments = Boolean(isTenantAdmin || isCoordinator || isOcaInspector);
  const canManageOcaIncidents = Boolean(isTenantAdmin || isCoordinator || isOcaInspector);
  const canCreateOcaWorkOrder = Boolean(isTenantAdmin || isCoordinator);
  const canVerifyOcaIncident = Boolean(isTenantAdmin || isCoordinator || isOcaInspector);
  const canCloseOca = Boolean(isTenantAdmin || isCoordinator);
  const isReadOnly = Boolean(isReadOnlyClient);

  return {
    isTenantAdmin,
    isCoordinator,
    isInternalTechnician,
    isExternalTechnician,
    isOcaInspector,
    isReadOnlyClient,
    isTenantMember,
    canViewInventory,
    canManageInventory,
    canManageWorkOrders,
    canUseWorkOrders,
    canManageUsers,
    canViewAudit,
    canUseQrGenerator,
    canCreateIncidents,
    canViewOca,
    canCreateOca,
    canEditOca,
    canManageOcaDocuments,
    canManageOcaIncidents,
    canCreateOcaWorkOrder,
    canVerifyOcaIncident,
    canCloseOca,
    isReadOnly
  };
}

export function canAccessRole(activeRole, allowedRoles = [], isSuperAdmin = false) {
  if (isSuperAdmin) return true;
  return allowedRoles.includes(activeRole) || allowedRoles.includes(normalizeRole(activeRole));
}

