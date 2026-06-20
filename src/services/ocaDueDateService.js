import { listOcaControls } from './ocaControlService';
import { listOcaInspections } from './ocaInspectionService';
import { listOcaIncidents } from './ocaIncidentService';
import { listOcaDocuments } from './ocaDocumentService';
import { daysUntil } from '../constants/oca';

const OPEN_INCIDENT_STATES = ['pendiente', 'ot_creada', 'en_reparacion', 'subsanada', 'pendiente_verificacion'];

export async function loadOcaDashboard(tenantId) {
  const [controls, inspections, incidents, documents] = await Promise.all([
    listOcaControls(tenantId),
    listOcaInspections(tenantId),
    listOcaIncidents(tenantId),
    listOcaDocuments(tenantId)
  ]);
  const actDocuments = new Set(documents.filter((doc) => doc.tipo_documento === 'acta_oca' && doc.inspeccion_oca_id).map((doc) => doc.inspeccion_oca_id));
  const latestByControl = new Map();
  inspections.forEach((inspection) => {
    if (!inspection.control_oca_id) return;
    const current = latestByControl.get(inspection.control_oca_id);
    const date = inspection.fecha_realizada || inspection.fecha_programada || '';
    const currentDate = current?.fecha_realizada || current?.fecha_programada || '';
    if (!current || date > currentDate) latestByControl.set(inspection.control_oca_id, inspection);
  });
  const pendingIncidents = incidents.filter((incident) => OPEN_INCIDENT_STATES.includes(incident.estado));
  const controlsWithSummary = controls.map((control) => {
    const latest = latestByControl.get(control.id);
    const incidentCount = pendingIncidents.filter((incident) => incident.inspecciones_oca?.control_oca_id === control.id).length;
    return { ...control, latestInspection: latest, pendingIncidentCount: incidentCount, daysRemaining: daysUntil(control.fecha_proxima_inspeccion) };
  });
  const metrics = {
    ok: controlsWithSummary.filter((item) => item.estado === 'al_dia').length,
    next30: controlsWithSummary.filter((item) => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 30).length,
    next90: controlsWithSummary.filter((item) => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 90).length,
    overdue: controlsWithSummary.filter((item) => item.daysRemaining !== null && item.daysRemaining < 0).length,
    missingActs: inspections.filter((item) => item.fecha_realizada && !actDocuments.has(item.id)).length,
    conditioned: inspections.filter((item) => item.resultado === 'condicionada').length,
    unfavorable: inspections.filter((item) => item.resultado === 'desfavorable').length,
    pendingIncidents: pendingIncidents.length,
    pendingVerification: incidents.filter((item) => item.estado === 'pendiente_verificacion').length
  };
  return {
    metrics,
    controls: controlsWithSummary,
    inspections,
    incidents,
    documents,
    overdue: groupControlsByDueDate(controlsWithSummary).overdue,
    next30: groupControlsByDueDate(controlsWithSummary).next30,
    next90: groupControlsByDueDate(controlsWithSummary).next90
  };
}

export function groupControlsByDueDate(controls = []) {
  return {
    overdue: controls.filter((item) => item.daysRemaining !== null && item.daysRemaining < 0),
    next7: controls.filter((item) => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 7),
    next30: controls.filter((item) => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 30),
    next90: controls.filter((item) => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 90),
    withoutNextDate: controls.filter((item) => !item.fecha_proxima_inspeccion),
    withoutDocumentation: controls.filter((item) => !item.latestInspection)
  };
}

export function isOcaSchemaMissing(error) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('controles_oca') || message.includes('inspecciones_oca') || message.includes('schema cache');
}
