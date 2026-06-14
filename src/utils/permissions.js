export const TENANT_ROLES = ['admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'];

export const ROLE_LABELS = {
  super_admin: 'Super administrador',
  admin_cliente: 'Administrador del cliente',
  tecnico: 'Tecnico propio',
  tecnico_externo: 'Tecnico externo',
  cliente_lectura: 'Cliente solo lectura'
};

export const ROLE_DESCRIPTIONS = {
  admin_cliente: 'Gestiona usuarios, instalaciones, QR, documentos, todas las OT, auditoria y ajustes del cliente.',
  tecnico: 'Tecnico propio de la empresa. Puede ver inventario y trabajar cualquier OT que se le asigne, sin crear accesos temporales por instalacion.',
  tecnico_externo: 'Acceso limitado: mis OT, escaner, incidencias y permisos concretos por instalacion.',
  cliente_lectura: 'Consulta informacion visible para cliente sin crear ni modificar datos.'
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || (role ? role.replaceAll('_', ' ') : 'Sin rol asignado');
}

export function buildTenantPermissions({ activeRole, isSuperAdmin = false, hasTenantContext = false } = {}) {
  const isTenantAdmin = Boolean(isSuperAdmin || activeRole === 'admin_cliente');
  const isInternalTechnician = activeRole === 'tecnico';
  const isExternalTechnician = activeRole === 'tecnico_externo';
  const isReadOnlyClient = activeRole === 'cliente_lectura';
  const isTenantMember = Boolean(activeRole);
  const canViewInventory = Boolean(isTenantAdmin || isInternalTechnician || isReadOnlyClient);
  const canManageInventory = Boolean(isTenantAdmin || isInternalTechnician);
  const canManageWorkOrders = Boolean(isTenantAdmin);
  const canUseWorkOrders = Boolean(isTenantAdmin || isInternalTechnician || isExternalTechnician);
  const canManageUsers = Boolean(isTenantAdmin);
  const canViewAudit = Boolean(isTenantAdmin);
  const canUseQrGenerator = Boolean(isTenantAdmin || isInternalTechnician);
  const canCreateIncidents = Boolean(isTenantAdmin || isInternalTechnician || isExternalTechnician || hasTenantContext);
  const isReadOnly = Boolean(isReadOnlyClient);

  return {
    isTenantAdmin,
    isInternalTechnician,
    isExternalTechnician,
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
    isReadOnly
  };
}

export function canAccessRole(activeRole, allowedRoles = [], isSuperAdmin = false) {
  if (isSuperAdmin) return true;
  return allowedRoles.includes(activeRole);
}
