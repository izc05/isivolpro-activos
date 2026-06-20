const ACTION_LABELS = {
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  permission_denied: 'Acceso denegado',
  create_asset: 'Activo creado',
  update_asset: 'Activo actualizado',
  delete_asset: 'Activo dado de baja',
  create_incident: 'Incidencia creada',
  review_incident: 'Incidencia revisada',
  close_incident: 'Incidencia cerrada',
  convert_incident_to_work_order: 'Incidencia convertida en OT',
  create_work_order: 'OT creada',
  update_work_order: 'OT actualizada',
  update_work_order_status: 'Estado de OT actualizado',
  delete_work_order: 'OT dada de baja',
  start_work_order_visit: 'Visita iniciada',
  finish_work_order_visit: 'Visita finalizada',
  update_work_order_checklist_item: 'Checklist actualizado',
  register_work_order_checklist_photo: 'Foto de checklist registrada',
  create_work_order_visit_material: 'Material registrado',
  create_maintenance_plan: 'Plan creado',
  update_maintenance_plan: 'Plan actualizado',
  generate_scheduled_maintenance: 'Mantenimiento programado',
  generate_maintenance_work_order: 'OT generada desde mantenimiento',
  create_corrective_from_incident: 'Correctivo creado',
  close_maintenance_from_work_order: 'Mantenimiento cerrado desde OT',
  update_member_role: 'Rol actualizado',
  update_member_status: 'Usuario actualizado',
  invite_user: 'Usuario invitado',
  revoke_invitation: 'Invitación revocada'
};

const ENTITY_LABELS = {
  activo: 'Activo',
  incidencia: 'Incidencia',
  orden_trabajo: 'OT',
  ot_visita: 'Visita',
  ot_checklist_respuesta: 'Checklist',
  ot_foto: 'Foto OT',
  ot_visita_material: 'Material',
  historial_mantenimiento: 'Historial',
  plan_mantenimiento: 'Plan',
  mantenimiento_programado: 'Mantenimiento',
  tenant_member: 'Usuario',
  tenant_invitation: 'Invitación'
};

export function auditActionLabel(action) {
  if (!action) return 'Movimiento registrado';
  return ACTION_LABELS[action] || action.replaceAll('_', ' ');
}

export function auditEntityLabel(entityType) {
  if (!entityType) return 'Sistema';
  return ENTITY_LABELS[entityType] || entityType.replaceAll('_', ' ');
}
