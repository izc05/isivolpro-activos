import { supabase } from './supabaseClient';
import { logAudit } from './auditService';
import { createWorkOrder } from './workOrderService';

export const INCIDENT_STATUSES = ['abierta', 'en_revision', 'convertida_en_ot', 'descartada', 'cerrada'];
export const INCIDENT_STATUS_LABELS = {
  abierta: 'Abierta',
  en_revision: 'En revisión',
  convertida_en_ot: 'Convertida en OT',
  descartada: 'Descartada',
  cerrada: 'Cerrada'
};

const PRIORITY_TO_OT = {
  baja: 'baja',
  media: 'normal',
  normal: 'normal',
  alta: 'alta',
  urgente: 'urgente',
  critica: 'critica'
};

function incidentToWorkOrderPayload(incident, options = {}) {
  const type = options.tipo_ot || 'aviso_cliente';
  return {
    instalacion_id: incident.instalacion_id,
    ubicacion_id: incident.ubicacion_id || null,
    activo_id: incident.activo_id || null,
    activos_relacionados: incident.activo_id ? [incident.activo_id] : [],
    titulo: options.titulo || `Incidencia: ${incident.titulo}`,
    descripcion: options.descripcion || incident.descripcion || null,
    tipo: type,
    tipo_ot: type,
    sintomas: incident.descripcion || null,
    trabajo_solicitado: options.trabajo_solicitado || incident.titulo,
    instrucciones_tecnico: options.instrucciones_tecnico || null,
    riesgos_precauciones: options.riesgos_precauciones || null,
    resultado_esperado: options.resultado_esperado || 'Resolver incidencia comunicada y dejar constancia de la actuación realizada.',
    prioridad: options.prioridad || PRIORITY_TO_OT[incident.prioridad] || 'normal',
    assigned_to: options.assigned_to || null,
    fecha_prevista: options.fecha_prevista || '',
    fecha_limite: options.fecha_limite || '',
    duracion_estimada_minutos: options.duracion_estimada_minutos || '',
    estado: options.assigned_to ? 'ASIGNADA' : 'NUEVA',
    configuracion: options.configuracion || {
      requiere_checklist: true,
      requiere_fotos_iniciales: true,
      requiere_fotos_finales: true,
      requiere_materiales: false,
      requiere_firma_cliente: false,
      requiere_informe: true,
      requiere_revision_admin: true,
      requiere_prueba_funcional_final: true
    }
  };
}

export async function markIncidentInReview(incident, notes = '') {
  const { data: userData } = await supabase.auth.getUser();
  const patch = {
    estado: 'en_revision',
    revisada_by: userData.user?.id || null,
    revisada_at: new Date().toISOString(),
    notas_revision: notes || incident.notas_revision || null
  };
  const { data, error } = await supabase
    .from('incidencias')
    .update(patch)
    .eq('id', incident.id)
    .eq('tenant_id', incident.tenant_id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: 'review_incident', entityType: 'incidencia', entityId: incident.id, metadata: { notes } });
  return data;
}

export async function discardIncident(incident, reason = '') {
  if (!reason?.trim()) throw new Error('Indica el motivo de descarte.');
  const { data: userData } = await supabase.auth.getUser();
  const patch = {
    estado: 'descartada',
    motivo_descarte: reason.trim(),
    descartada_by: userData.user?.id || null,
    descartada_at: new Date().toISOString(),
    fecha_cierre: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('incidencias')
    .update(patch)
    .eq('id', incident.id)
    .eq('tenant_id', incident.tenant_id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: 'discard_incident', entityType: 'incidencia', entityId: incident.id, metadata: { reason: reason.trim() } });
  return data;
}

export async function closeIncidentWorkflow(incident) {
  const { data, error } = await supabase
    .from('incidencias')
    .update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() })
    .eq('id', incident.id)
    .eq('tenant_id', incident.tenant_id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: 'close_incident', entityType: 'incidencia', entityId: incident.id });
  return data;
}

export async function convertIncidentToWorkOrder(incident, options = {}) {
  if (incident.ot_id) throw new Error('Esta incidencia ya está vinculada a una OT.');
  if (['convertida_en_ot', 'cerrada', 'descartada'].includes(incident.estado)) throw new Error('La incidencia ya está cerrada o descartada.');
  const { data: userData } = await supabase.auth.getUser();
  const createdOt = await createWorkOrder(incident.tenant_id, incidentToWorkOrderPayload(incident, options));
  const patch = {
    estado: 'convertida_en_ot',
    ot_id: createdOt.id,
    convertida_by: userData.user?.id || null,
    convertida_at: new Date().toISOString(),
    fecha_cierre: new Date().toISOString(),
    notas_revision: options.notas_revision || incident.notas_revision || null
  };
  const { data, error } = await supabase
    .from('incidencias')
    .update(patch)
    .eq('id', incident.id)
    .eq('tenant_id', incident.tenant_id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ tenantId: incident.tenant_id, action: 'convert_incident_to_work_order', entityType: 'incidencia', entityId: incident.id, metadata: { otId: createdOt.id } });
  return { incident: data, workOrder: createdOt };
}
