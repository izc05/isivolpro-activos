export const ROLE_PERMISSION_MATRIX = {
  superadmin: {
    label: 'Superadmin',
    scope: 'Plataforma completa',
    canManageTenant: true,
    canManageUsers: true,
    canManageInventory: true,
    canManageWorkOrders: true,
    canExecuteWorkOrders: false,
    canValidateWorkOrders: true,
    canAnnulWorkOrders: true,
    canViewAudit: true,
    canManageCatalogs: true,
    canManageDemo: true
  },
  admin_cliente: {
    label: 'Administrador cliente',
    scope: 'Cliente activo completo',
    canManageTenant: true,
    canManageUsers: true,
    canManageInventory: true,
    canManageWorkOrders: true,
    canExecuteWorkOrders: false,
    canValidateWorkOrders: true,
    canAnnulWorkOrders: true,
    canViewAudit: true,
    canManageCatalogs: true,
    canManageDemo: true
  },
  coordinador: {
    label: 'Coordinador',
    scope: 'Operativa y planificación',
    canManageTenant: false,
    canManageUsers: false,
    canManageInventory: true,
    canManageWorkOrders: true,
    canExecuteWorkOrders: false,
    canValidateWorkOrders: true,
    canAnnulWorkOrders: true,
    canViewAudit: true,
    canManageCatalogs: false,
    canManageDemo: false
  },
  tecnico: {
    label: 'Técnico propio',
    scope: 'OT asignadas del cliente',
    canManageTenant: false,
    canManageUsers: false,
    canManageInventory: false,
    canManageWorkOrders: false,
    canExecuteWorkOrders: true,
    canValidateWorkOrders: false,
    canAnnulWorkOrders: false,
    canViewAudit: false,
    canManageCatalogs: false,
    canManageDemo: false
  },
  tecnico_externo: {
    label: 'Técnico externo',
    scope: 'OT y accesos concedidos',
    canManageTenant: false,
    canManageUsers: false,
    canManageInventory: false,
    canManageWorkOrders: false,
    canExecuteWorkOrders: true,
    canValidateWorkOrders: false,
    canAnnulWorkOrders: false,
    canViewAudit: false,
    canManageCatalogs: false,
    canManageDemo: false
  },
  cliente_lectura: {
    label: 'Cliente lectura',
    scope: 'Consulta sin edición',
    canManageTenant: false,
    canManageUsers: false,
    canManageInventory: false,
    canManageWorkOrders: false,
    canExecuteWorkOrders: false,
    canValidateWorkOrders: false,
    canAnnulWorkOrders: false,
    canViewAudit: false,
    canManageCatalogs: false,
    canManageDemo: false
  }
};

export const WORK_ORDER_ROLE_RULES = [
  'El administrador crea, asigna, anula, solicita correcciones y valida la OT; no debe ejecutar pasos técnicos ni finalizar saltándose el cierre guiado.',
  'El técnico ejecuta visitas, checklist, fotos, materiales, firmas e informe; no puede validar ni anular una OT.',
  'Las OT finalizadas pasan a revisión administrativa antes de quedar validadas.',
  'Una OT validada, cerrada, cancelada o anulada debe quedar en solo lectura salvo reapertura controlada.',
  'Las correcciones vuelven al técnico con nota obligatoria y trazabilidad en auditoría.'
];

export function roleLabel(role) {
  return ROLE_PERMISSION_MATRIX[role]?.label || role || '-';
}

export function roleCan(role, permission) {
  return Boolean(ROLE_PERMISSION_MATRIX[role]?.[permission]);
}

export function rolePermissionRows() {
  return Object.entries(ROLE_PERMISSION_MATRIX).map(([role, data]) => ({ role, ...data }));
}

export function explainRole(role) {
  const data = ROLE_PERMISSION_MATRIX[role];
  if (!data) return 'Rol no reconocido.';
  const allowed = Object.entries(data)
    .filter(([key, value]) => key.startsWith('can') && value)
    .map(([key]) => key.replace(/^can/, ''));
  return `${data.label}: ${data.scope}. Permisos: ${allowed.join(', ') || 'solo lectura'}.`;
}
