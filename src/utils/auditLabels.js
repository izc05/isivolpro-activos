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
  accept_work_order: 'OT aceptada por técnico',
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
  create_oca_control: 'Control OCA creado',
  update_oca_control: 'Control OCA actualizado',
  delete_oca_control: 'Control OCA dado de baja',
  create_oca_inspection: 'Inspección OCA creada',
  update_oca_inspection: 'Inspección OCA actualizada',
  close_oca_inspection: 'Inspección OCA cerrada',
  delete_oca_inspection: 'Inspección OCA dada de baja',
  create_oca_incident: 'Incidencia OCA creada',
  update_oca_incident: 'Incidencia OCA actualizada',
  oca_incident_subsanada: 'Incidencia OCA subsanada',
  oca_incident_pendiente_verificacion: 'Incidencia OCA pendiente de verificación',
  oca_incident_verificada: 'Incidencia OCA verificada',
  link_oca_document: 'Documento OCA vinculado',
  unlink_oca_document: 'Documento OCA desvinculado',
  link_oca_incident_work_order: 'OT vinculada a incidencia OCA',
  create_oca_corrective_work_order: 'OT de subsanación OCA creada',
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
  control_oca: 'Control OCA',
  inspeccion_oca: 'Inspección OCA',
  incidencia_oca: 'Incidencia OCA',
  incidencia_oca_ot: 'Vínculo OCA-OT',
  oca_documento: 'Documento OCA',
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
