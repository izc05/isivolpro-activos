import { createScheduledMaintenance } from './scheduledMaintenanceService';
import { generateWorkOrderForScheduledMaintenance } from './scheduledMaintenanceService';
import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

export async function createCorrectiveMaintenance(tenantId, payload, { generateOt = true } = {}) {
  const scheduled = await createScheduledMaintenance(tenantId, {
    ...payload,
    tipo: 'correctivo',
    estado: payload.estado || 'programado',
    origen: payload.origen || (payload.incidencia_id ? 'incidencia' : 'activo')
  });

  let workOrder = null;
  if (generateOt) {
    const result = await generateWorkOrderForScheduledMaintenance(scheduled);
    workOrder = result.workOrder;
  }

  if (payload.incidencia_id && workOrder) {
    await supabase
      .from('incidencias')
      .update({ ot_id: workOrder.id, estado: 'convertida_en_ot', convertida_at: new Date().toISOString(), fecha_cierre: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', payload.incidencia_id);
    await logAudit({ tenantId, action: 'create_corrective_from_incident', entityType: 'incidencia', entityId: payload.incidencia_id, metadata: { mantenimientoId: scheduled.id, otId: workOrder.id } });
  }

  return { scheduled, workOrder };
}
