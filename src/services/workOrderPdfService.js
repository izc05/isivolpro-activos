import { jsPDF } from 'jspdf';
import homeserveLogo from '../assets/homeserve/homeserve-logo-rojo-horizontal.png';
import { supabase } from './supabaseClient';
import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';
import {
  getWorkOrder,
  listWorkOrderChecklist,
  listWorkOrderMaterials,
  listWorkOrderVisits,
  MATERIAL_MOVEMENT_LABELS,
  signedChecklistPhotoUrl
} from './workOrderService';
import { signedTechnicianSignatureUrl, signedVisitSignatureUrl } from './workOrderSignatureService';
import { isWorkOrderReadOnly, priorityLabel, workOrderStatusLabel, workOrderTypeLabel } from '../utils/workOrderLifecycle';

const PAGE = { width: 210, height: 297, margin: 14 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const COLORS = {
  primary: [42, 49, 64],
  red: [223, 79, 69],
  redDark: [184, 61, 53],
  redSoft: [255, 241, 239],
  line: [227, 231, 238],
  muted: [101, 112, 132],
  surface: [255, 255, 255],
  soft: [247, 250, 252],
  ok: [8, 127, 91],
  okSoft: [234, 250, 241],
  warn: [180, 83, 9],
  warnSoft: [255, 251, 235],
  danger: [180, 35, 24],
  dangerSoft: [255, 240, 239]
};

const FV_KEYWORDS = [
  'fotovoltaica',
  'fotovoltaico',
  'fv',
  'inversor',
  'string',
  'strings',
  'dc',
  'cuadro dc',
  'cuadro ac',
  'contador bidireccional',
  'vertido cero',
  'seccionador',
  'módulo',
  'modulo',
  'placa solar',
  'panel solar'
];

function safeText(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function resultLabel(value) {
  const labels = { pendiente: 'Pendiente', ok: 'OK', no_ok: 'NO OK', no_aplica: 'No aplica' };
  return labels[value] || safeText(value);
}

function resultTone(value = '') {
  if (value === 'ok') return { bg: COLORS.okSoft, fg: COLORS.ok };
  if (value === 'no_ok') return { bg: COLORS.dangerSoft, fg: COLORS.danger };
  if (value === 'no_aplica') return { bg: COLORS.soft, fg: COLORS.muted };
  return { bg: COLORS.warnSoft, fg: COLORS.warn };
}

function statusTone(status = '') {
  const normalized = String(status || '').toUpperCase();
  if (['VALIDADA', 'CERRADA', 'FINALIZADA', 'FIRMADA', 'INFORME_GENERADO'].includes(normalized)) return { bg: COLORS.okSoft, fg: COLORS.ok };
  if (['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'PAUSADA'].includes(normalized)) return { bg: COLORS.warnSoft, fg: COLORS.warn };
  if (normalized === 'CANCELADA') return { bg: COLORS.dangerSoft, fg: COLORS.danger };
  return { bg: COLORS.redSoft, fg: COLORS.redDark };
}

function setFill(doc, color) {
  doc.setFillColor(...color);
}

function setDraw(doc, color) {
  doc.setDrawColor(...color);
}

function setText(doc, color) {
  doc.setTextColor(...color);
}

function addPageIfNeeded(doc, y, needed = 12) {
  if (y + needed <= PAGE.height - PAGE.margin) return y;
  doc.addPage();
  return PAGE.margin + 6;
}

async function normalizeImageForPdf(dataUrl) {
  if (typeof dataUrl !== 'string') return dataUrl;
  if (!dataUrl.startsWith('data:image/webp')) return dataUrl;
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.86);
}

async function urlToDataUrl(url) {
  if (typeof url === 'string' && url.startsWith('data:image/')) return normalizeImageForPdf(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo cargar una imagen del informe.');
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return normalizeImageForPdf(dataUrl);
}

function imageFormat(dataUrl) {
  if (typeof dataUrl !== 'string') return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return 'PNG';
}

function imageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => resolve({ width: 1200, height: 800 });
    image.src = dataUrl;
  });
}

function addLogo(doc, logoDataUrl, x, y, width, height) {
  if (!logoDataUrl) return;
  try {
    doc.addImage(logoDataUrl, imageFormat(logoDataUrl), x, y, width, height, undefined, 'FAST');
  } catch (error) {
    console.warn('No se pudo incluir el logo en el PDF', error);
  }
}

function isPhotovoltaicWorkOrder(workOrder = {}) {
  const searchable = [
    workOrder.tipo,
    workOrder.tipo_ot,
    workOrder.titulo,
    workOrder.descripcion,
    workOrder.trabajo_solicitado,
    workOrder.instrucciones_tecnico,
    workOrder.instalaciones?.nombre,
    workOrder.instalaciones?.tipo,
    workOrder.ubicaciones?.nombre,
    workOrder.activos?.nombre,
    workOrder.activos?.tipo,
    workOrder.activos?.marca,
    workOrder.activos?.modelo,
    workOrder.activos?.referencia
  ].filter(Boolean).join(' ').toLowerCase();
  return FV_KEYWORDS.some((keyword) => searchable.includes(keyword));
}

function addHeader(doc, title, subtitle = '', logoDataUrl = '', workOrder = {}) {
  setFill(doc, COLORS.red);
  doc.rect(0, 0, PAGE.width, 10, 'F');
  setFill(doc, COLORS.surface);
  setDraw(doc, COLORS.line);
  doc.roundedRect(PAGE.margin, 15, 48, 18, 2, 2, 'FD');
  addLogo(doc, logoDataUrl, PAGE.margin + 3, 18, 42, 12);

  setText(doc, COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(title, PAGE.margin, 45);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, COLORS.muted);
  doc.text(doc.splitTextToSize(subtitle, 118), PAGE.margin, 51);

  setFill(doc, COLORS.soft);
  setDraw(doc, COLORS.line);
  doc.roundedRect(140, 18, 56, 34, 2, 2, 'FD');
  setText(doc, COLORS.muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE OT', 145, 25);
  setText(doc, COLORS.primary);
  doc.setFontSize(11);
  doc.text(safeText(workOrder.codigo_ot || workOrder.id).slice(0, 22), 145, 32);
  const tone = statusTone(workOrder.estado);
  setFill(doc, tone.bg);
  doc.roundedRect(145, 37, 42, 8, 3, 3, 'F');
  setText(doc, tone.fg);
  doc.setFontSize(7);
  doc.text(workOrderStatusLabel(workOrder.estado).slice(0, 24), 148, 42.5);

  setDraw(doc, COLORS.line);
  doc.line(PAGE.margin, 60, PAGE.width - PAGE.margin, 60);
  setText(doc, COLORS.primary);
  return 70;
}

function addSection(doc, y, title) {
  y = addPageIfNeeded(doc, y, 16);
  setFill(doc, COLORS.redSoft);
  setDraw(doc, [242, 208, 204]);
  doc.roundedRect(PAGE.margin, y - 6, CONTENT_WIDTH, 11, 2, 2, 'FD');
  setText(doc, COLORS.redDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), PAGE.margin + 4, y + 1.5);
  setText(doc, COLORS.primary);
  return y + 11;
}

function addKeyValue(doc, y, label, value, labelWidth = 42) {
  y = addPageIfNeeded(doc, y, 8);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  setText(doc, COLORS.muted);
  doc.text(`${label}:`, PAGE.margin, y);
  doc.setFont('helvetica', 'normal');
  setText(doc, COLORS.primary);
  const lines = doc.splitTextToSize(safeText(value), CONTENT_WIDTH - labelWidth - 6);
  doc.text(lines, PAGE.margin + labelWidth, y);
  return y + Math.max(6, lines.length * 5);
}

function addParagraph(doc, y, text, maxWidth = CONTENT_WIDTH) {
  y = addPageIfNeeded(doc, y, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, COLORS.primary);
  const lines = doc.splitTextToSize(safeText(text), maxWidth);
  doc.text(lines, PAGE.margin, y);
  return y + lines.length * 5 + 2;
}

function addWarningBox(doc, y, text, tone = 'warn') {
  const palette = tone === 'danger'
    ? { bg: COLORS.dangerSoft, fg: COLORS.danger, line: [248, 196, 190] }
    : { bg: COLORS.warnSoft, fg: COLORS.warn, line: [253, 230, 138] };
  const lines = doc.splitTextToSize(safeText(text), CONTENT_WIDTH - 10);
  const height = Math.max(16, lines.length * 5 + 8);
  y = addPageIfNeeded(doc, y, height + 4);
  setFill(doc, palette.bg);
  setDraw(doc, palette.line);
  doc.roundedRect(PAGE.margin, y - 5, CONTENT_WIDTH, height, 2, 2, 'FD');
  setText(doc, palette.fg);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(lines, PAGE.margin + 5, y + 2);
  setText(doc, COLORS.primary);
  return y + height + 3;
}

function addSummaryCards(doc, y, cards) {
  const gap = 3;
  const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = PAGE.margin + index * (width + gap);
    setFill(doc, COLORS.surface);
    setDraw(doc, COLORS.line);
    doc.roundedRect(x, y, width, 22, 2, 2, 'FD');
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(card.label.toUpperCase(), x + 3, y + 7);
    setText(doc, card.color || COLORS.primary);
    doc.setFontSize(12);
    doc.text(safeText(card.value).slice(0, 16), x + 3, y + 16);
  });
  return y + 30;
}

function addReportIntro(doc, y, workOrder, generatedAt, isFv) {
  y = addPageIfNeeded(doc, y, 36);
  setFill(doc, COLORS.primary);
  setDraw(doc, COLORS.primary);
  doc.roundedRect(PAGE.margin, y - 6, CONTENT_WIDTH, 31, 2, 2, 'FD');
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isFv ? 'Informe tecnico de mantenimiento fotovoltaico' : 'Resumen profesional de la intervencion', PAGE.margin + 5, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const summary = [
    `Cliente / instalacion: ${safeText(workOrder.instalaciones?.nombre)}`,
    `Ubicacion: ${safeText(workOrder.ubicaciones?.nombre)}`,
    `Activo intervenido: ${safeText(workOrder.activos?.nombre)}`,
    `Tecnico responsable: ${safeText(workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar')}`,
    `Generado: ${formatDate(generatedAt)}`
  ];
  doc.text(summary, PAGE.margin + 5, y + 8);
  setText(doc, COLORS.primary);
  return y + 36;
}

function addPill(doc, x, y, label, tone) {
  setFill(doc, tone.bg);
  doc.roundedRect(x, y - 5, 30, 7, 3, 3, 'F');
  setText(doc, tone.fg);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(safeText(label).slice(0, 18), x + 3, y);
  setText(doc, COLORS.primary);
}

function checklistStats(checklist) {
  const total = checklist.length;
  const ok = checklist.filter((item) => item.resultado === 'ok').length;
  const noOk = checklist.filter((item) => item.resultado === 'no_ok').length;
  const pending = checklist.filter((item) => !item.resultado || item.resultado === 'pendiente').length;
  const requiredPhotos = checklist.filter((item) => item.requiere_foto).length;
  return { total, ok, noOk, pending, requiredPhotos };
}

function addChecklistSummaryTable(doc, y, checklist, photosByChecklistId) {
  y = addPageIfNeeded(doc, y, 20);
  const headerHeight = 8;
  const columns = [
    { label: 'Punto', x: PAGE.margin + 3, width: 12 },
    { label: 'Comprobacion', x: PAGE.margin + 17, width: 88 },
    { label: 'Resultado', x: PAGE.margin + 108, width: 28 },
    { label: 'Foto', x: PAGE.margin + 138, width: 18 },
    { label: 'Observacion', x: PAGE.margin + 158, width: 34 }
  ];
  setFill(doc, COLORS.soft);
  setDraw(doc, COLORS.line);
  doc.rect(PAGE.margin, y - 5, CONTENT_WIDTH, headerHeight, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(doc, COLORS.muted);
  columns.forEach((column) => doc.text(column.label, column.x, y));
  y += headerHeight;

  checklist.forEach((item) => {
    const photos = photosByChecklistId[item.id] || [];
    const desc = doc.splitTextToSize(safeText(item.descripcion), 86);
    const obs = doc.splitTextToSize(safeText(item.observacion || item.medicion_valor || item.defecto || ''), 32);
    const height = Math.max(9, desc.length * 4, obs.length * 4) + 3;
    y = addPageIfNeeded(doc, y, height + 3);
    setDraw(doc, COLORS.line);
    doc.line(PAGE.margin, y - 5, PAGE.width - PAGE.margin, y - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, COLORS.primary);
    doc.text(safeText(item.punto), columns[0].x, y);
    doc.text(desc, columns[1].x, y);
    doc.setFont('helvetica', 'bold');
    doc.text(resultLabel(item.resultado).slice(0, 12), columns[2].x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(item.requiere_foto ? `${photos.length} / req.` : String(photos.length), columns[3].x, y);
    doc.text(obs.length ? obs : '-', columns[4].x, y);
    y += height;
  });
  return y + 4;
}

function addFvTechnicalBlock(doc, y, workOrder) {
  y = addSection(doc, y, '3. Datos tecnicos FV');
  y = addWarningBox(doc, y, 'Instalacion fotovoltaica: aplicar procedimiento de seguridad, seccionamiento y comprobacion de ausencia de tension cuando proceda. Documentar estado de inversor, strings DC, protecciones AC/DC, contador, vertido cero y seccionador de emergencia si existen en el activo o instalacion.', 'warn');
  const assetType = safeText(workOrder.activos?.tipo || workOrder.tipo_ot || workOrder.tipo);
  const recommended = [];
  const assetName = `${workOrder.activos?.nombre || ''} ${workOrder.activos?.tipo || ''}`.toLowerCase();
  if (assetName.includes('inversor')) recommended.push('Inversor FV: alarmas, produccion instantanea, ventilacion, comunicaciones, temperatura y conexiones AC/DC.');
  if (assetName.includes('string') || assetName.includes('campo')) recommended.push('Campo FV / strings: tension por string, intensidad si procede, sombras, conectores, danos visibles y estado de modulos.');
  if (assetName.includes('dc')) recommended.push('Cuadro DC: seccionador, fusibles, SPD DC, polaridad, conectores, cable solar y senalizacion de riesgo DC.');
  if (assetName.includes('ac')) recommended.push('Cuadro AC: magnetotermico, diferencial, SPD AC, embarrado, apriete visual y ausencia de calentamientos.');
  if (assetName.includes('contador') || assetName.includes('vertido')) recommended.push('Contador / vertido cero: lectura importada/exportada, comunicaciones, estado de equipo y alarmas.');
  if (recommended.length === 0) recommended.push('Revisar elementos FV asociados: inversor, strings, protecciones, contador, vertido cero, estructura y seccionador de emergencia si aplican.');
  y = addKeyValue(doc, y, 'Tipo activo', assetType);
  y = addKeyValue(doc, y, 'Marca / modelo', [workOrder.activos?.marca, workOrder.activos?.modelo].filter(Boolean).join(' / '));
  y = addKeyValue(doc, y, 'Referencia', workOrder.activos?.referencia || workOrder.activos?.numero_serie);
  y = addParagraph(doc, y, recommended.join('\n'));
  return y;
}

function buildFinalResult(workOrder, checklist, materials, visits) {
  const stats = checklistStats(checklist);
  const pendingMaterials = materials.filter((material) => material.tipo_movimiento === 'pendiente_pedir');
  const noOk = checklist.filter((item) => item.resultado === 'no_ok');
  const lastVisit = visits.find((visit) => visit.fecha_fin) || visits[visits.length - 1];
  const lines = [];
  if (lastVisit?.resultado_cierre) lines.push(`Resultado de cierre: ${lastVisit.resultado_cierre.replaceAll('_', ' ')}.`);
  if (lastVisit?.motivo_cierre) lines.push(`Justificacion: ${lastVisit.motivo_cierre}.`);
  if (lastVisit?.proxima_accion) lines.push(`Proxima accion: ${lastVisit.proxima_accion}.`);
  if (stats.noOk > 0) lines.push(`Se registran ${stats.noOk} punto(s) NO OK en el checklist.`);
  if (pendingMaterials.length > 0) lines.push(`Queda material pendiente de pedir: ${pendingMaterials.map((m) => m.descripcion_libre || m.referencia || 'material').join(', ')}.`);
  if (noOk.length === 0 && pendingMaterials.length === 0) lines.push('Intervencion documentada sin defectos bloqueantes registrados en checklist ni material pendiente.');
  if (workOrder.revision_admin_estado === 'correccion_solicitada') lines.push(`Correccion solicitada por administracion: ${workOrder.revision_admin_notas || 'sin nota'}.`);
  return lines.join('\n');
}

async function addImageBlock(doc, y, dataUrl, caption, maxWidth = 82, maxHeight = 58) {
  y = addPageIfNeeded(doc, y, maxHeight + 22);
  const dimensions = await imageDimensions(dataUrl);
  const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  const width = dimensions.width * ratio;
  const height = dimensions.height * ratio;
  setFill(doc, COLORS.soft);
  setDraw(doc, COLORS.line);
  doc.roundedRect(PAGE.margin, y - 4, CONTENT_WIDTH, height + 16, 2, 2, 'FD');
  doc.addImage(dataUrl, imageFormat(dataUrl), PAGE.margin + 4, y, width, height, undefined, 'FAST');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  setText(doc, COLORS.primary);
  const captionLines = doc.splitTextToSize(safeText(caption), 94);
  doc.text(captionLines, PAGE.margin + width + 9, y + 5);
  return y + height + 12;
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    setDraw(doc, COLORS.line);
    doc.line(PAGE.margin, 283, PAGE.width - PAGE.margin, 283);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setText(doc, COLORS.muted);
    doc.text('HomeServe - Gestion QR de activos e instalaciones - Creado por IsiVoltPro', PAGE.margin, 290);
    doc.text(`Pagina ${i}/${pageCount}`, PAGE.width - PAGE.margin - 20, 290);
  }
}

async function listWorkOrderPhotosForReport(tenantId, workOrderId) {
  const query = supabase
    .from('ot_fotos')
    .select('*, created_by_profile:profiles!ot_fotos_created_by_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('ot_id', workOrderId)
    .order('created_at', { ascending: true });

  let { data, error } = await query;

  if (error && String(error.message || '').includes('relationship')) {
    const fallback = await supabase
      .from('ot_fotos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ot_id', workOrderId)
      .order('created_at', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return data || [];
}

async function collectReportData(tenantId, workOrderId) {
  const [workOrder, visits, checklist, materials, allPhotos] = await Promise.all([
    getWorkOrder(tenantId, workOrderId),
    listWorkOrderVisits(tenantId, workOrderId),
    listWorkOrderChecklist(tenantId, workOrderId),
    listWorkOrderMaterials(tenantId, workOrderId).catch((error) => {
      console.warn('No se pudieron cargar materiales para informe', error);
      return [];
    }),
    listWorkOrderPhotosForReport(tenantId, workOrderId).catch((error) => {
      console.warn('No se pudieron cargar fotos para informe', error);
      return [];
    })
  ]);

  const photosByChecklistId = {};
  const signedPhotos = [];
  for (const photo of allPhotos) {
    try {
      const signedUrl = await signedChecklistPhotoUrl(photo, 600);
      const signedPhoto = { ...photo, signedUrl };
      signedPhotos.push(signedPhoto);
      if (photo.checklist_respuesta_id) {
        if (!photosByChecklistId[photo.checklist_respuesta_id]) photosByChecklistId[photo.checklist_respuesta_id] = [];
        photosByChecklistId[photo.checklist_respuesta_id].push(signedPhoto);
      }
    } catch (error) {
      console.error('No se pudo firmar foto', error);
    }
  }

  for (const item of checklist) {
    if (photosByChecklistId[item.id]) continue;
    photosByChecklistId[item.id] = [];
  }

  const visitsWithSignatures = [];
  for (const visit of visits) {
    let signatureUrl = '';
    let technicianSignatureUrl = '';
    if (visit.firma_path) {
      try {
        signatureUrl = await signedVisitSignatureUrl(visit, 600);
      } catch (error) {
        console.error('No se pudo firmar la firma', error);
      }
    }
    if (visit.firma_tecnico_path) {
      try {
        technicianSignatureUrl = await signedTechnicianSignatureUrl(visit, 600);
      } catch (error) {
        console.error('No se pudo preparar la firma del tecnico', error);
      }
    }
    visitsWithSignatures.push({ ...visit, signatureUrl, technicianSignatureUrl });
  }

  return { workOrder, visits: visitsWithSignatures, checklist, photosByChecklistId, materials, allPhotos: signedPhotos };
}

export async function generateWorkOrderPdfBlob(tenantId, workOrderId) {
  const { workOrder, visits, checklist, photosByChecklistId, materials, allPhotos } = await collectReportData(tenantId, workOrderId);
  const generatedAt = new Date();
  const isFv = isPhotovoltaicWorkOrder(workOrder);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const logoDataUrl = await urlToDataUrl(homeserveLogo).catch((error) => {
    console.warn('No se pudo cargar el logo para el PDF', error);
    return '';
  });

  const stats = checklistStats(checklist);
  let y = addHeader(
    doc,
    isFv ? 'Informe tecnico FV de orden de trabajo' : 'Informe tecnico de orden de trabajo',
    `${workOrder.codigo_ot || workOrder.id} - ${workOrder.titulo}`,
    logoDataUrl,
    workOrder
  );

  y = addSummaryCards(doc, y, [
    { label: 'Estado', value: workOrderStatusLabel(workOrder.estado), color: statusTone(workOrder.estado).fg },
    { label: 'Checklist', value: `${stats.ok}/${stats.total || 0}`, color: COLORS.ok },
    { label: 'NO OK', value: String(stats.noOk), color: stats.noOk ? COLORS.danger : COLORS.ok },
    { label: 'Fotos', value: String(allPhotos.length || 0), color: COLORS.red },
    { label: 'Materiales', value: String(materials.length || 0), color: COLORS.primary }
  ]);
  y = addReportIntro(doc, y, workOrder, generatedAt, isFv);

  y = addSection(doc, y, '1. Datos generales');
  y = addKeyValue(doc, y, 'OT', workOrder.codigo_ot || workOrder.id);
  y = addKeyValue(doc, y, 'Titulo', workOrder.titulo);
  y = addKeyValue(doc, y, 'Informe generado', formatDate(generatedAt));
  y = addKeyValue(doc, y, 'Estado', workOrderStatusLabel(workOrder.estado));
  y = addKeyValue(doc, y, 'Tipo', workOrderTypeLabel(workOrder.tipo_ot || workOrder.tipo));
  y = addKeyValue(doc, y, 'Prioridad', priorityLabel(workOrder.prioridad));
  y = addKeyValue(doc, y, 'Tecnico', workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar');
  y = addKeyValue(doc, y, 'Fecha prevista', formatDate(workOrder.fecha_prevista));
  y = addKeyValue(doc, y, 'Fecha inicio', formatDate(workOrder.fecha_inicio));
  y = addKeyValue(doc, y, 'Fecha fin', formatDate(workOrder.fecha_fin || workOrder.closed_at));
  y = addKeyValue(doc, y, 'Revision admin', workOrder.revision_admin_estado || '-');

  y = addSection(doc, y, '2. Instalacion / activo');
  y = addKeyValue(doc, y, 'Instalacion', workOrder.instalaciones?.nombre);
  y = addKeyValue(doc, y, 'Direccion', workOrder.instalaciones?.direccion);
  y = addKeyValue(doc, y, 'Contacto', workOrder.instalaciones?.contacto_nombre);
  y = addKeyValue(doc, y, 'Telefono', workOrder.instalaciones?.contacto_telefono);
  y = addKeyValue(doc, y, 'Ubicacion', workOrder.ubicaciones?.nombre);
  y = addKeyValue(doc, y, 'Activo', workOrder.activos?.nombre);
  y = addKeyValue(doc, y, 'Tipo activo', workOrder.activos?.tipo);
  y = addKeyValue(doc, y, 'Marca/modelo', [workOrder.activos?.marca, workOrder.activos?.modelo].filter(Boolean).join(' / '));
  y = addKeyValue(doc, y, 'Numero serie', workOrder.activos?.numero_serie);
  y = addKeyValue(doc, y, 'Referencia', workOrder.activos?.referencia);

  if (isFv) {
    y = addFvTechnicalBlock(doc, y, workOrder);
  }

  y = addSection(doc, y, isFv ? '4. Trabajo solicitado y diagnostico' : '3. Descripcion del trabajo');
  y = addParagraph(doc, y, workOrder.descripcion || 'Sin descripcion adicional.');
  if (workOrder.sintomas) y = addKeyValue(doc, y, 'Sintomas / situacion', workOrder.sintomas);
  if (workOrder.trabajo_solicitado) y = addKeyValue(doc, y, 'Trabajo solicitado', workOrder.trabajo_solicitado);
  if (workOrder.instrucciones_tecnico) y = addKeyValue(doc, y, 'Instrucciones', workOrder.instrucciones_tecnico);
  if (workOrder.riesgos_precauciones) y = addKeyValue(doc, y, 'Riesgos / precauciones', workOrder.riesgos_precauciones);
  if (workOrder.resultado_esperado) y = addKeyValue(doc, y, 'Resultado esperado', workOrder.resultado_esperado);

  y = addSection(doc, y, isFv ? '5. Intervencion realizada' : '4. Visitas');
  if (visits.length === 0) {
    y = addParagraph(doc, y, 'No hay visitas registradas.');
  } else {
    for (const [index, visit] of visits.entries()) {
      y = addPageIfNeeded(doc, y, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Visita ${index + 1}`, PAGE.margin, y);
      y += 6;
      y = addKeyValue(doc, y, 'Tecnico', visit.tecnico?.nombre || visit.tecnico?.email || '-');
      y = addKeyValue(doc, y, 'Inicio', formatDate(visit.fecha_inicio));
      y = addKeyValue(doc, y, 'Fin', formatDate(visit.fecha_fin));
      y = addKeyValue(doc, y, 'Estado', visit.estado);
      y = addKeyValue(doc, y, 'Ubicacion GPS', visit.latitud && visit.longitud ? `${visit.latitud}, ${visit.longitud}` : '-');
      if (visit.estado_final_activo) y = addKeyValue(doc, y, 'Estado final activo', visit.estado_final_activo.replaceAll('_', ' '));
      y = addParagraph(doc, y, visit.trabajo_realizado || visit.observaciones || 'Sin observaciones.');
    }
  }

  y = addSection(doc, y, isFv ? '6. Checklist y mediciones FV' : '5. Checklist completo con fotos');
  if (checklist.length === 0) {
    y = addParagraph(doc, y, 'No hay checklist registrado.');
  } else {
    y = addKeyValue(doc, y, 'Resumen', `${stats.ok} OK · ${stats.noOk} NO OK · ${stats.pending} pendiente(s) · ${stats.requiredPhotos} con foto requerida`);
    y = addChecklistSummaryTable(doc, y, checklist, photosByChecklistId);
    y = addSection(doc, y, 'Detalle del checklist');
    for (const item of checklist) {
      y = addPageIfNeeded(doc, y, 28);
      setFill(doc, COLORS.surface);
      setDraw(doc, COLORS.line);
      doc.roundedRect(PAGE.margin, y - 6, CONTENT_WIDTH, 18, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setText(doc, COLORS.primary);
      const titleLines = doc.splitTextToSize(`${item.punto}. ${item.descripcion}`, 142);
      doc.text(titleLines, PAGE.margin + 4, y);
      addPill(doc, PAGE.width - PAGE.margin - 34, y, resultLabel(item.resultado), resultTone(item.resultado));
      y += Math.max(5, titleLines.length * 5) + 7;
      y = addKeyValue(doc, y, 'Requiere foto', item.requiere_foto ? 'Si' : 'No');
      if (item.valor_referencia) y = addKeyValue(doc, y, 'Rango / referencia', item.valor_referencia);
      if (item.medicion_valor) y = addKeyValue(doc, y, 'Medicion', item.medicion_valor);
      if (item.defecto) y = addKeyValue(doc, y, 'Defecto', item.defecto);
      if (item.accion_realizada) y = addKeyValue(doc, y, 'Accion realizada', item.accion_realizada);
      if (item.estado_despues) y = addKeyValue(doc, y, 'Estado despues', item.estado_despues);
      if (item.recomendacion) y = addKeyValue(doc, y, 'Recomendacion', item.recomendacion);
      y = addParagraph(doc, y, item.observacion || 'Sin observacion.');
      const photos = photosByChecklistId[item.id] || [];
      if (photos.length > 0) {
        for (const photo of photos) {
          try {
            const dataUrl = await urlToDataUrl(photo.signedUrl);
            y = await addImageBlock(doc, y, dataUrl, `${photo.comentario || 'Foto del punto'} - ${formatDate(photo.created_at)}`);
          } catch (error) {
            y = addParagraph(doc, y, `No se pudo incluir una foto: ${photo.file_name || photo.id}`);
          }
        }
      } else if (item.requiere_foto) {
        y = addWarningBox(doc, y, 'Punto marcado con foto requerida, sin foto asociada.', 'danger');
      }
      y += 2;
    }
  }

  y = addSection(doc, y, isFv ? '7. Materiales usados o pendientes' : '6. Materiales');
  if (materials.length === 0) {
    y = addParagraph(doc, y, 'No hay materiales registrados.');
  } else {
    const pending = materials.filter((material) => material.tipo_movimiento === 'pendiente_pedir');
    if (pending.length > 0) y = addWarningBox(doc, y, `Material pendiente de pedir: ${pending.map((m) => m.descripcion_libre || m.referencia || 'material').join(', ')}`, 'warn');
    for (const material of materials) {
      y = addPageIfNeeded(doc, y, 22);
      y = addKeyValue(doc, y, 'Material', material.descripcion_libre || material.material_id || '-');
      y = addKeyValue(doc, y, 'Cantidad', `${material.cantidad || 0} ${material.unidad || 'ud'}`);
      y = addKeyValue(doc, y, 'Movimiento', MATERIAL_MOVEMENT_LABELS[material.tipo_movimiento] || material.tipo_movimiento);
      if (material.referencia) y = addKeyValue(doc, y, 'Referencia', material.referencia);
      if (material.numero_serie) y = addKeyValue(doc, y, 'Numero serie', material.numero_serie);
      if (material.observaciones) y = addParagraph(doc, y, material.observaciones);
      y += 2;
    }
  }

  const orphanPhotos = allPhotos.filter((photo) => !photo.checklist_respuesta_id || !checklist.some((item) => item.id === photo.checklist_respuesta_id));
  y = addSection(doc, y, isFv ? '8. Evidencias fotograficas' : '7. Evidencias fotograficas adicionales');
  if (orphanPhotos.length === 0) {
    y = addParagraph(doc, y, 'No hay fotos adicionales fuera del checklist.');
  } else {
    for (const photo of orphanPhotos) {
      try {
        const dataUrl = await urlToDataUrl(photo.signedUrl);
        const author = photo.created_by_profile?.nombre || photo.created_by_profile?.email || 'Sin autor';
        y = await addImageBlock(doc, y, dataUrl, `${photo.tipo_foto || 'Foto'} - ${photo.comentario || photo.file_name || 'Evidencia OT'} - ${author} - ${formatDate(photo.created_at)}`, 96, 66);
      } catch (error) {
        y = addParagraph(doc, y, `No se pudo incluir una foto adicional: ${photo.file_name || photo.id}`);
      }
    }
  }

  y = addSection(doc, y, isFv ? '9. Resultado final' : '8. Resultado final');
  y = addParagraph(doc, y, buildFinalResult(workOrder, checklist, materials, visits));
  y = addKeyValue(doc, y, 'Estado final OT', workOrderStatusLabel(workOrder.estado));
  y = addKeyValue(doc, y, 'Estado final activo', visits.find((visit) => visit.estado_final_activo)?.estado_final_activo || '-');

  y = addSection(doc, y, isFv ? '10. Firmas de la intervencion' : '9. Firmas de la intervencion');
  const technicianSignedVisits = visits.filter((visit) => visit.firma_tecnico_path);
  y = addParagraph(doc, y, 'Firma del tecnico');
  if (technicianSignedVisits.length === 0) {
    y = addWarningBox(doc, y, workOrder.configuracion?.requiere_firma_tecnico ? 'Firma del tecnico pendiente.' : 'No hay firma del tecnico guardada.', workOrder.configuracion?.requiere_firma_tecnico ? 'danger' : 'warn');
  } else {
    for (const visit of technicianSignedVisits) {
      y = addKeyValue(doc, y, 'Tecnico firmante', visit.firma_tecnico_nombre || workOrder.assigned?.nombre || '-');
      y = addKeyValue(doc, y, 'Fecha de firma', formatDate(visit.firma_tecnico_at || visit.fecha_inicio));
      try {
        const dataUrl = await urlToDataUrl(visit.technicianSignatureUrl);
        y = await addImageBlock(doc, y, dataUrl, 'Firma del tecnico', 120, 45);
      } catch (error) {
        y = addParagraph(doc, y, 'No se pudo incluir la firma del tecnico.');
      }
    }
  }

  y = addParagraph(doc, y, 'Firma del cliente / responsable');
  const signedVisits = visits.filter((visit) => visit.firma_path);
  if (signedVisits.length === 0) {
    y = addWarningBox(doc, y, workOrder.configuracion?.requiere_firma_cliente ? 'Firma del cliente pendiente.' : 'Firma cliente no requerida o no registrada.', workOrder.configuracion?.requiere_firma_cliente ? 'danger' : 'warn');
  } else {
    for (const visit of signedVisits) {
      y = addKeyValue(doc, y, 'Firmante', visit.nombre_firmante || '-');
      y = addKeyValue(doc, y, 'Identificacion', visit.dni_firmante || '-');
      y = addKeyValue(doc, y, 'Visita', formatDate(visit.fecha_inicio));
      try {
        const dataUrl = await urlToDataUrl(visit.signatureUrl);
        y = await addImageBlock(doc, y, dataUrl, 'Firma del cliente / responsable', 120, 45);
      } catch (error) {
        y = addParagraph(doc, y, 'No se pudo incluir la imagen de firma.');
      }
    }
  }

  addFooter(doc);
  const blob = doc.output('blob');
  const stamp = generatedAt.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const prefix = isFv ? 'OT-FV' : 'OT';
  const filename = `${prefix}-${workOrder.codigo_ot || workOrder.id}-informe-${stamp}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  return { blob, filename, workOrder };
}

export async function listWorkOrderReports(tenantId, workOrderId) {
  const query = supabase
    .from('ot_informes')
    .select('*, created_by_profile:profiles!ot_informes_created_by_fkey(nombre,email)')
    .eq('tenant_id', tenantId)
    .eq('ot_id', workOrderId)
    .order('created_at', { ascending: false });

  let { data, error } = await query;

  if (error && String(error.message || '').includes('relationship')) {
    const fallback = await supabase
      .from('ot_informes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ot_id', workOrderId)
      .order('created_at', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return data || [];
}

export async function signedWorkOrderReportUrl(report, expiresIn = 600) {
  if (!report?.bucket || !report?.path) return '';
  return createSignedUrl({
    tenantId: report.tenant_id,
    bucket: report.bucket,
    path: report.path,
    entityType: 'ot_informe',
    entityId: report.id,
    expiresIn
  });
}

export async function generateAndUploadWorkOrderPdf(tenantId, workOrderId) {
  const { blob, filename, workOrder } = await generateWorkOrderPdfBlob(tenantId, workOrderId);
  if (isWorkOrderReadOnly(workOrder)) throw new Error('La OT esta finalizada y no admite nuevos informes. Descarga el acta final desde OT realizadas.');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const path = buildStoragePath({ tenantId, scope: 'ordenes-trabajo', scopeId: workOrderId, folder: 'informes', file });

  await uploadPrivateFile({
    tenantId,
    bucket: 'documents-private',
    path,
    file,
    metadata: { auditAction: 'upload_work_order_pdf_report', entityType: 'orden_trabajo', entityId: workOrderId }
  });

  const { data, error } = await supabase
    .from('ot_informes')
    .insert({ tenant_id: tenantId, ot_id: workOrderId, bucket: 'documents-private', path, filename, created_by: (await supabase.auth.getUser()).data.user?.id || null })
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId, action: 'generate_work_order_pdf_report', entityType: 'ot_informe', entityId: data.id, metadata: { otId: workOrderId, filename, photovoltaic: isPhotovoltaicWorkOrder(workOrder) } });
  return data;
}
