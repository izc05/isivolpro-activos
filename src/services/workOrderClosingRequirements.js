import { FINISHED_WORK_ORDER_STATUSES, normalizedStatus } from '../utils/workOrderLifecycle';

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function cfg(config, ...keys) {
  return keys.some((key) => bool(config?.[key]));
}

function normalizeResult(value) {
  return String(value || '').toLowerCase();
}

function isAnswered(item) {
  const result = normalizeResult(item?.resultado);
  return Boolean(result && result !== 'pendiente');
}

function photoType(photo) {
  return String(photo?.tipo_foto || photo?.tipo || '').toLowerCase();
}

function photoLooksLike(photo, target) {
  const type = photoType(photo);
  if (target === 'inicial') return type.includes('inicial') || type.includes('antes');
  if (target === 'final') return type.includes('final') || type.includes('despues') || type.includes('después');
  return false;
}

function item(key, label, { required = true, completed = false, detail = '', warning = false } = {}) {
  const status = required
    ? completed ? 'ok' : 'missing'
    : warning ? 'warning' : completed ? 'ok' : 'optional';
  return {
    key,
    label,
    required: Boolean(required),
    completed: Boolean(completed),
    status,
    detail,
    blocking: Boolean(required && !completed),
    passed: Boolean(completed)
  };
}

function hasPhotoForChecklistItem(photos, checklistItemId) {
  return photos.some((photo) => {
    const checklistId = photo.checklist_id || photo.checklist_item_id || photo.respuesta_id || photo.checklist_respuesta_id;
    return checklistId && checklistId === checklistItemId;
  });
}

function materialIsReviewed(material) {
  const movement = String(material?.tipo_movimiento || material?.estado || '').toLowerCase();
  return ['utilizado', 'usado', 'pendiente_pedir', 'pendiente', 'devuelto', 'no_necesario', 'retirado'].some((value) => movement.includes(value));
}

export function buildWorkOrderClosingRequirements({
  workOrder,
  visits = [],
  checklistResponses = [],
  photos = [],
  reports = [],
  qrVerifications = [],
  materials = []
} = {}) {
  const config = workOrder?.configuracion || {};
  const state = normalizedStatus(workOrder?.estado);
  const isFinalStatus = FINISHED_WORK_ORDER_STATUSES.includes(state) || state === 'FINALIZADA';
  const hasStartedVisit = visits.some((visit) => visit.fecha_inicio || visit.estado === 'EN_CURSO' || visit.estado === 'FINALIZADA');
  const hasFinishedVisit = visits.some((visit) => visit.estado === 'FINALIZADA' || visit.fecha_fin);

  const requiresChecklist = cfg(config, 'requiere_checklist');
  const answeredChecklist = checklistResponses.filter(isAnswered).length;
  const checklistComplete = !requiresChecklist || (checklistResponses.length > 0 && answeredChecklist === checklistResponses.length);

  const checklistPhotoItems = checklistResponses.filter((entry) => bool(entry.requiere_foto));
  const missingChecklistPhotoItems = checklistPhotoItems.filter((entry) => !hasPhotoForChecklistItem(photos, entry.id));

  const requiresInitialPhotos = cfg(config, 'requiere_fotos_iniciales');
  const requiresFinalPhotos = cfg(config, 'requiere_fotos_finales');
  const hasInitialPhoto = photos.some((photo) => photoLooksLike(photo, 'inicial'));
  const hasFinalPhoto = photos.some((photo) => photoLooksLike(photo, 'final'));
  const photoRequirements = [
    missingChecklistPhotoItems.length === 0,
    !requiresInitialPhotos || hasInitialPhoto,
    !requiresFinalPhotos || hasFinalPhoto
  ];
  const photosRequired = checklistPhotoItems.length > 0 || requiresInitialPhotos || requiresFinalPhotos;
  const photosComplete = !photosRequired || photoRequirements.every(Boolean);
  const missingPhotoDetails = [
    ...missingChecklistPhotoItems.map((entry) => entry.descripcion || `Punto ${entry.punto || ''}`.trim() || 'Punto con foto obligatoria'),
    requiresInitialPhotos && !hasInitialPhoto ? 'Foto inicial' : '',
    requiresFinalPhotos && !hasFinalPhoto ? 'Foto final' : ''
  ].filter(Boolean);

  const requiresMaterials = cfg(config, 'requiere_materiales');
  const materialsReviewed = !requiresMaterials || (materials.length > 0 && materials.every(materialIsReviewed));

  const requiresClientSignature = cfg(config, 'requiere_firma_cliente');
  const hasClientSignature = visits.some((visit) => Boolean(visit.firma_path || visit.firma_cliente_path));

  const requiresTechnicianSignature = cfg(config, 'requiere_firma_tecnico');
  const hasTechnicianSignature = visits.some((visit) => Boolean(visit.firma_tecnico_path));

  const requiresReport = cfg(config, 'requiere_informe');
  const hasReport = reports.length > 0;

  const requiresQr = cfg(config, 'requiere_qr', 'requiere_verificacion_qr');
  const hasValidQr = qrVerifications.some((entry) => {
    const result = String(entry.resultado || '').toLowerCase();
    return !result || result === 'correcto' || result === 'ok' || result === 'validado';
  });

  const items = [
    item('visita_iniciada', 'Intervención iniciada', {
      required: true,
      completed: hasStartedVisit || isFinalStatus,
      detail: hasStartedVisit ? `${visits.length} visita(s) registrada(s)` : 'No hay visita iniciada'
    }),
    item('visita_finalizada', 'Existe al menos una visita finalizada', {
      required: true,
      completed: hasFinishedVisit || state === 'FINALIZADA' || state === 'VALIDADA',
      detail: hasFinishedVisit ? `${visits.length} visita(s) registrada(s)` : 'No hay visita finalizada'
    }),
    item('estado_finalizado', 'OT finalizada por técnico', {
      required: true,
      completed: state === 'FINALIZADA' || state === 'VALIDADA' || state === 'CERRADA',
      detail: `Estado actual: ${workOrder?.estado || '-'}`
    }),
    item('checklist', 'Checklist completado', {
      required: requiresChecklist,
      completed: checklistComplete,
      detail: requiresChecklist ? `${answeredChecklist}/${checklistResponses.length} puntos completados` : 'No obligatorio'
    }),
    item('fotos', 'Fotografías obligatorias adjuntas', {
      required: photosRequired,
      completed: photosComplete,
      detail: photosRequired
        ? (photosComplete ? `${photos.length} foto(s) en la OT` : `Falta: ${missingPhotoDetails.join(', ')}`)
        : `${photos.length} foto(s), no obligatorio`
    }),
    item('materiales', 'Materiales revisados', {
      required: requiresMaterials,
      completed: materialsReviewed,
      detail: requiresMaterials ? `${materials.length} material(es) registrado(s)` : `${materials.length} material(es), no obligatorio`
    }),
    item('firma_cliente', 'Firma del cliente / responsable', {
      required: requiresClientSignature,
      completed: !requiresClientSignature || hasClientSignature,
      detail: requiresClientSignature ? (hasClientSignature ? 'Firma registrada' : 'Falta firma') : 'No obligatoria'
    }),
    item('firma_tecnico', 'Firma del técnico', {
      required: requiresTechnicianSignature,
      completed: !requiresTechnicianSignature || hasTechnicianSignature,
      detail: requiresTechnicianSignature ? (hasTechnicianSignature ? 'Firma registrada' : 'Falta firma') : 'No obligatoria'
    }),
    item('qr', 'QR de la intervención verificado', {
      required: requiresQr,
      completed: !requiresQr || hasValidQr,
      detail: requiresQr ? (hasValidQr ? 'QR correcto registrado' : 'Falta verificar el QR') : 'No obligatorio'
    }),
    item('informe', 'Informe PDF generado', {
      required: requiresReport,
      completed: !requiresReport || hasReport,
      detail: requiresReport ? `${reports.length} informe(s) guardado(s)` : `${reports.length} informe(s), no obligatorio`
    })
  ];

  const requiredItems = items.filter((entry) => entry.required);
  const missing = requiredItems.filter((entry) => !entry.completed).map((entry) => entry.label);

  const technicalBlockingKeys = new Set(['visita_iniciada', 'checklist', 'fotos', 'materiales', 'firma_cliente', 'firma_tecnico', 'qr', 'informe']);
  const canClose = !items.some((entry) => entry.required && !entry.completed && technicalBlockingKeys.has(entry.key));
  const canValidate = missing.length === 0;

  return {
    canClose,
    canValidate,
    missing,
    items
  };
}

export function toFinalReviewItems(requirements) {
  return (requirements?.items || []).map((entry) => ({
    key: entry.key,
    label: entry.label,
    required: entry.required,
    completed: entry.completed,
    status: entry.status,
    detail: entry.detail,
    passed: entry.completed,
    blocking: Boolean(entry.required && !entry.completed)
  }));
}
