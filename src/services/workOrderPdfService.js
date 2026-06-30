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

function safeText(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function resultLabel(value) {
  const labels = { pendiente: 'Pendiente', ok: 'OK', no_ok: 'No OK', no_aplica: 'No aplica' };
  return labels[value] || safeText(value);
}

function resultTone(value = '') {
  if (value === 'ok') return { bg: COLORS.okSoft, fg: COLORS.ok };
  if (value === 'no_ok') return { bg: COLORS.dangerSoft, fg: COLORS.danger };
  if (value === 'no_aplica') return { bg: COLORS.soft, fg: COLORS.muted };
  return { bg: COLORS.warnSoft, fg: COLORS.warn };
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

function imageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => resolve({ width: 1200, height: 800 });
    image.src = dataUrl;
  });
}

function imageFormat(dataUrl) {
  if (typeof dataUrl !== 'string') return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return 'PNG';
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

function addPageIfNeeded(doc, y, needed = 12) {
  if (y + needed <= PAGE.height - PAGE.margin) return y;
  doc.addPage();
  return PAGE.margin + 6;
}

function statusTone(status = '') {
  const normalized = String(status || '').toUpperCase();
  if (['VALIDADA', 'CERRADA', 'FINALIZADA', 'FIRMADA', 'INFORME_GENERADO'].includes(normalized)) return { bg: COLORS.okSoft, fg: COLORS.ok };
  if (['PENDIENTE_MATERIAL', 'PENDIENTE_CLIENTE', 'PAUSADA'].includes(normalized)) return { bg: COLORS.warnSoft, fg: COLORS.warn };
  if (normalized === 'CANCELADA') return { bg: COLORS.dangerSoft, fg: COLORS.danger };
  return { bg: COLORS.redSoft, fg: COLORS.redDark };
}

function addLogo(doc, logoDataUrl, x, y, width, height) {
  if (!logoDataUrl) return;
  try {
    doc.addImage(logoDataUrl, imageFormat(logoDataUrl), x, y, width, height, undefined, 'FAST');
  } catch (error) {
    console.warn('No se pudo incluir el logo en el PDF', error);
  }
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
  doc.setFontSize(18);
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
  doc.roundedRect(PAGE.margin, y - 6, PAGE.width - PAGE.margin * 2, 11, 2, 2, 'FD');
  setText(doc, COLORS.redDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), PAGE.margin + 4, y + 1.5);
  setText(doc, COLORS.primary);
  return y + 11;
}

function addKeyValue(doc, y, label, value) {
  y = addPageIfNeeded(doc, y, 8);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  setText(doc, COLORS.muted);
  doc.text(`${label}:`, PAGE.margin, y);
  doc.setFont('helvetica', 'normal');
  setText(doc, COLORS.primary);
  const lines = doc.splitTextToSize(safeText(value), 124);
  doc.text(lines, PAGE.margin + 42, y);
  return y + Math.max(6, lines.length * 5);
}

function addParagraph(doc, y, text, maxWidth = 180) {
  y = addPageIfNeeded(doc, y, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, COLORS.primary);
  const lines = doc.splitTextToSize(safeText(text), maxWidth);
  doc.text(lines, PAGE.margin, y);
  return y + lines.length * 5 + 2;
}

function addSummaryCards(doc, y, cards) {
  const gap = 4;
  const width = (PAGE.width - PAGE.margin * 2 - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = PAGE.margin + index * (width + gap);
    setFill(doc, COLORS.surface);
    setDraw(doc, COLORS.line);
    doc.roundedRect(x, y, width, 22, 2, 2, 'FD');
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(card.label.toUpperCase(), x + 4, y + 7);
    setText(doc, card.color || COLORS.primary);
    doc.setFontSize(13);
    doc.text(safeText(card.value), x + 4, y + 16);
  });
  return y + 30;
}

function addReportIntro(doc, y, workOrder, generatedAt) {
  y = addPageIfNeeded(doc, y, 32);
  setFill(doc, COLORS.primary);
  setDraw(doc, COLORS.primary);
  doc.roundedRect(PAGE.margin, y - 6, PAGE.width - PAGE.margin * 2, 27, 2, 2, 'FD');
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumen profesional de la intervencion', PAGE.margin + 5, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const summary = [
    `Cliente / instalacion: ${safeText(workOrder.instalaciones?.nombre)}`,
    `Activo intervenido: ${safeText(workOrder.activos?.nombre)}`,
    `Tecnico responsable: ${safeText(workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar')}`,
    `Generado: ${formatDate(generatedAt)}`
  ];
  doc.text(summary, PAGE.margin + 5, y + 8);
  setText(doc, COLORS.primary);
  return y + 32;
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

async function addImageBlock(doc, y, dataUrl, caption, maxWidth = 82, maxHeight = 58) {
  y = addPageIfNeeded(doc, y, maxHeight + 22);
  const dimensions = await imageDimensions(dataUrl);
  const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  const width = dimensions.width * ratio;
  const height = dimensions.height * ratio;
  setFill(doc, COLORS.soft);
  setDraw(doc, COLORS.line);
  doc.roundedRect(PAGE.margin, y - 4, PAGE.width - PAGE.margin * 2, height + 16, 2, 2, 'FD');
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
    doc.text(`HomeServe - Gestion QR de activos e instalaciones - Creado por IsiVoltPro`, PAGE.margin, 290);
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
        console.error('No se pudo preparar la firma del técnico', error);
      }
    }
    visitsWithSignatures.push({ ...visit, signatureUrl, technicianSignatureUrl });
  }

  return { workOrder, visits: visitsWithSignatures, checklist, photosByChecklistId, materials, allPhotos: signedPhotos };
}

export async function generateWorkOrderPdfBlob(tenantId, workOrderId) {
  const { workOrder, visits, checklist, photosByChecklistId, materials, allPhotos } = await collectReportData(tenantId, workOrderId);
  const generatedAt = new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const logoDataUrl = await urlToDataUrl(homeserveLogo).catch((error) => {
    console.warn('No se pudo cargar el logo para el PDF', error);
    return '';
  });
  let y = addHeader(doc, 'Informe tecnico de orden de trabajo', `${workOrder.codigo_ot || workOrder.id} - ${workOrder.titulo}`, logoDataUrl, workOrder);

  const checklistOk = checklist.filter((item) => item.resultado === 'ok').length;
  y = addSummaryCards(doc, y, [
    { label: 'Estado', value: workOrderStatusLabel(workOrder.estado), color: statusTone(workOrder.estado).fg },
    { label: 'Checklist', value: `${checklistOk}/${checklist.length || 0}`, color: COLORS.ok },
    { label: 'Fotos', value: String(allPhotos.length || 0), color: COLORS.red },
    { label: 'Materiales', value: String(materials.length || 0), color: COLORS.primary }
  ]);
  y = addReportIntro(doc, y, workOrder, generatedAt);

  y = addSection(doc, y, '1. Datos generales');
  y = addKeyValue(doc, y, 'OT', workOrder.codigo_ot || workOrder.id);
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
  y = addKeyValue(doc, y, 'Marca/modelo', [workOrder.activos?.marca, workOrder.activos?.modelo].filter(Boolean).join(' / '));
  y = addKeyValue(doc, y, 'Numero serie', workOrder.activos?.numero_serie);

  y = addSection(doc, y, '3. Descripcion del trabajo');
  y = addParagraph(doc, y, workOrder.descripcion || 'Sin descripcion adicional.');
  if (workOrder.trabajo_solicitado) y = addKeyValue(doc, y, 'Trabajo solicitado', workOrder.trabajo_solicitado);
  if (workOrder.instrucciones_tecnico) y = addKeyValue(doc, y, 'Instrucciones', workOrder.instrucciones_tecnico);
  if (workOrder.resultado_esperado) y = addKeyValue(doc, y, 'Resultado esperado', workOrder.resultado_esperado);

  y = addSection(doc, y, '4. Visitas');
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
      y = addParagraph(doc, y, visit.trabajo_realizado || visit.observaciones || 'Sin observaciones.');
    }
  }

  y = addSection(doc, y, '5. Checklist completo con fotos');
  if (checklist.length === 0) {
    y = addParagraph(doc, y, 'No hay checklist registrado.');
  } else {
    for (const item of checklist) {
      y = addPageIfNeeded(doc, y, 28);
      setFill(doc, COLORS.surface);
      setDraw(doc, COLORS.line);
      doc.roundedRect(PAGE.margin, y - 6, PAGE.width - PAGE.margin * 2, 18, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setText(doc, COLORS.primary);
      const titleLines = doc.splitTextToSize(`${item.punto}. ${item.descripcion}`, 142);
      doc.text(titleLines, PAGE.margin + 4, y);
      addPill(doc, PAGE.width - PAGE.margin - 34, y, resultLabel(item.resultado), resultTone(item.resultado));
      y += Math.max(5, titleLines.length * 5);
      y += 7;
      y = addKeyValue(doc, y, 'Requiere foto', item.requiere_foto ? 'Si' : 'No');
      if (item.medicion_valor) y = addKeyValue(doc, y, 'Medicion', item.medicion_valor);
      if (item.accion_realizada) y = addKeyValue(doc, y, 'Accion realizada', item.accion_realizada);
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
        y = addParagraph(doc, y, 'Punto marcado con foto requerida, sin foto asociada.');
      }
      y += 2;
    }
  }

  y = addSection(doc, y, '6. Materiales');
  if (materials.length === 0) {
    y = addParagraph(doc, y, 'No hay materiales registrados.');
  } else {
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
  y = addSection(doc, y, '7. Evidencias fotograficas adicionales');
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

  y = addSection(doc, y, '8. Firmas de la intervención');
  const technicianSignedVisits = visits.filter((visit) => visit.firma_tecnico_path);
  y = addParagraph(doc, y, 'Firma del técnico');
  if (technicianSignedVisits.length === 0) {
    y = addParagraph(doc, y, 'No hay firma del técnico guardada.');
  } else {
    for (const visit of technicianSignedVisits) {
      y = addKeyValue(doc, y, 'Técnico firmante', visit.firma_tecnico_nombre || workOrder.assigned?.nombre || '-');
      y = addKeyValue(doc, y, 'Fecha de firma', formatDate(visit.firma_tecnico_at || visit.fecha_inicio));
      try {
        const dataUrl = await urlToDataUrl(visit.technicianSignatureUrl);
        y = await addImageBlock(doc, y, dataUrl, 'Firma del técnico', 120, 45);
      } catch (error) {
        y = addParagraph(doc, y, 'No se pudo incluir la firma del técnico.');
      }
    }
  }

  y = addParagraph(doc, y, 'Firma del cliente / responsable');
  const signedVisits = visits.filter((visit) => visit.firma_path);
  if (signedVisits.length === 0) {
    y = addParagraph(doc, y, 'No hay firma guardada.');
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
  const filename = `OT-${workOrder.codigo_ot || workOrder.id}-informe-${stamp}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
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
  await logAudit({ tenantId, action: 'generate_work_order_pdf_report', entityType: 'ot_informe', entityId: data.id, metadata: { otId: workOrderId, filename } });
  return data;
}
