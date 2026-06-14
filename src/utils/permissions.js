export const TENANT_ROLES = ['admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'];

export const ROLE_LABELS = {
  super_admin: 'Super administrador',
  admin_cliente: 'Administrador del cliente',
  tecnico: 'Tecnico interno',
  tecnico_externo: 'Tecnico externo',
  cliente_lectura: 'Cliente solo lectura'
};

export const ROLE_DESCRIPTIONS = {
  admin_cliente: 'Gestiona usuarios, instalaciones, QR, documentos, OT, auditoria y ajustes del cliente.',
  tecnico: 'Puede trabajar con inventario, activos, incidencias y ordenes de trabajo del cliente.',
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
  const canManageWorkOrders = Boolean(isTenantAdmin || isInternalTechnician);
  const canUseWorkOrders = Boolean(canManageWorkOrders || isExternalTechnician);
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
