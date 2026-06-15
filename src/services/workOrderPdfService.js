import { jsPDF } from 'jspdf';
import { supabase } from './supabaseClient';
import { buildStoragePath, createSignedUrl, uploadPrivateFile } from './fileService';
import { logAudit } from './auditService';
import {
  getWorkOrder,
  listChecklistPhotos,
  listWorkOrderChecklist,
  listWorkOrderMaterials,
  listWorkOrderVisits,
  MATERIAL_MOVEMENT_LABELS,
  signedChecklistPhotoUrl
} from './workOrderService';
import { updateWorkOrderLifecycleStatus } from './workOrderLifecycleService';
import { signedVisitSignatureUrl } from './workOrderSignatureService';
import { isWorkOrderClosed, priorityLabel, workOrderStatusLabel, workOrderTypeLabel } from '../utils/workOrderLifecycle';

const PAGE = { width: 210, height: 297, margin: 14 };

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

async function urlToDataUrl(url) {
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
  return PAGE.margin;
}

function addHeader(doc, title, subtitle = '') {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, PAGE.margin, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, PAGE.margin, 24);
  doc.line(PAGE.margin, 28, PAGE.width - PAGE.margin, 28);
  return 36;
}

function addSection(doc, y, title) {
  y = addPageIfNeeded(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, PAGE.margin, y);
  doc.line(PAGE.margin, y + 2, PAGE.width - PAGE.margin, y + 2);
  return y + 8;
}

function addKeyValue(doc, y, label, value) {
  y = addPageIfNeeded(doc, y, 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`${label}:`, PAGE.margin, y);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(safeText(value), 130);
  doc.text(lines, PAGE.margin + 42, y);
  return y + Math.max(6, lines.length * 5);
}

function addParagraph(doc, y, text, maxWidth = 180) {
  y = addPageIfNeeded(doc, y, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(safeText(text), maxWidth);
  doc.text(lines, PAGE.margin, y);
  return y + lines.length * 5 + 2;
}

async function addImageBlock(doc, y, dataUrl, caption, maxWidth = 82, maxHeight = 58) {
  y = addPageIfNeeded(doc, y, maxHeight + 18);
  const dimensions = await imageDimensions(dataUrl);
  const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  const width = dimensions.width * ratio;
  const height = dimensions.height * ratio;
  doc.addImage(dataUrl, imageFormat(dataUrl), PAGE.margin, y, width, height, undefined, 'FAST');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const captionLines = doc.splitTextToSize(safeText(caption), 170);
  doc.text(captionLines, PAGE.margin, y + height + 5);
  return y + height + 7 + captionLines.length * 4;
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`IsiVoltPro · Informe OT · Pagina ${i}/${pageCount}`, PAGE.margin, 290);
  }
}

async function collectReportData(tenantId, workOrderId) {
  const [workOrder, visits, checklist, materials] = await Promise.all([
    getWorkOrder(tenantId, workOrderId),
    listWorkOrderVisits(tenantId, workOrderId),
    listWorkOrderChecklist(tenantId, workOrderId),
    listWorkOrderMaterials(tenantId, workOrderId).catch((error) => {
      console.warn('No se pudieron cargar materiales para informe', error);
      return [];
    })
  ]);

  const photosByChecklistId = {};
  for (const item of checklist) {
    const photos = await listChecklistPhotos(tenantId, item.id);
    const withUrls = [];
    for (const photo of photos) {
      try {
        const signedUrl = await signedChecklistPhotoUrl(photo, 600);
        withUrls.push({ ...photo, signedUrl });
      } catch (error) {
        console.error('No se pudo firmar foto', error);
      }
    }
    photosByChecklistId[item.id] = withUrls;
  }

  const visitsWithSignatures = [];
  for (const visit of visits) {
    let signatureUrl = '';
    if (visit.firma_path) {
      try {
        signatureUrl = await signedVisitSignatureUrl(visit, 600);
      } catch (error) {
        console.error('No se pudo firmar la firma', error);
      }
    }
    visitsWithSignatures.push({ ...visit, signatureUrl });
  }

  return { workOrder, visits: visitsWithSignatures, checklist, photosByChecklistId, materials };
}

export async function generateWorkOrderPdfBlob(tenantId, workOrderId) {
  const { workOrder, visits, checklist, photosByChecklistId, materials } = await collectReportData(tenantId, workOrderId);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  let y = addHeader(doc, 'Informe de Orden de Trabajo', `${workOrder.codigo_ot || workOrder.id} · ${workOrder.titulo}`);

  y = addSection(doc, y, '1. Datos generales');
  y = addKeyValue(doc, y, 'OT', workOrder.codigo_ot || workOrder.id);
  y = addKeyValue(doc, y, 'Estado', workOrderStatusLabel(workOrder.estado));
  y = addKeyValue(doc, y, 'Tipo', workOrderTypeLabel(workOrder.tipo_ot || workOrder.tipo));
  y = addKeyValue(doc, y, 'Prioridad', priorityLabel(workOrder.prioridad));
  y = addKeyValue(doc, y, 'Tecnico', workOrder.assigned?.nombre || workOrder.assigned?.email || 'Sin asignar');
  y = addKeyValue(doc, y, 'Fecha prevista', formatDate(workOrder.fecha_prevista));
  y = addKeyValue(doc, y, 'Fecha inicio', formatDate(workOrder.fecha_inicio));
  y = addKeyValue(doc, y, 'Fecha fin', formatDate(workOrder.fecha_fin));

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
    visits.forEach((visit, index) => {
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
    });
  }

  y = addSection(doc, y, '5. Checklist');
  if (checklist.length === 0) {
    y = addParagraph(doc, y, 'No hay checklist registrado.');
  } else {
    for (const item of checklist) {
      y = addPageIfNeeded(doc, y, 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${item.punto}. ${item.descripcion}`, PAGE.margin, y);
      y += 5;
      y = addKeyValue(doc, y, 'Resultado', resultLabel(item.resultado));
      y = addKeyValue(doc, y, 'Requiere foto', item.requiere_foto ? 'Si' : 'No');
      y = addParagraph(doc, y, item.observacion || 'Sin observacion.');
      const photos = photosByChecklistId[item.id] || [];
      if (photos.length > 0) {
        for (const photo of photos) {
          try {
            const dataUrl = await urlToDataUrl(photo.signedUrl);
            y = await addImageBlock(doc, y, dataUrl, `${photo.comentario || 'Foto del punto'} · ${formatDate(photo.created_at)}`);
          } catch (error) {
            y = addParagraph(doc, y, `No se pudo incluir una foto: ${photo.file_name || photo.id}`);
          }
        }
      }
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

  y = addSection(doc, y, '7. Firma cliente / responsable');
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
  const filename = `informe-${workOrder.codigo_ot || workOrder.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  return { blob, filename, workOrder };
}

export async function generateAndUploadWorkOrderPdf(tenantId, workOrderId) {
  const { blob, filename, workOrder } = await generateWorkOrderPdfBlob(tenantId, workOrderId);
  if (isWorkOrderClosed(workOrder)) throw new Error('La OT esta cerrada y no admite nuevos informes.');
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
  if (!['FINALIZADA', 'VALIDADA', 'CERRADA'].includes(workOrder.estado)) await updateWorkOrderLifecycleStatus(workOrder, 'FINALIZADA');
  await logAudit({ tenantId, action: 'generate_work_order_pdf_report', entityType: 'ot_informe', entityId: data.id, metadata: { otId: workOrderId, filename } });
  return data;
}

export async function listWorkOrderReports(tenantId, workOrderId) {
  const { data, error } = await supabase.from('ot_informes').select('*').eq('tenant_id', tenantId).eq('ot_id', workOrderId).order('created_at', { ascending: false });
  if (error) throw error;
  const reports = data || [];
  const userIds = [...new Set(reports.map((report) => report.created_by).filter(Boolean))];
  if (userIds.length === 0) return reports;
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,nombre,email').in('id', userIds);
  if (profileError) {
    console.warn('No se pudieron cargar perfiles de informes OT', profileError);
    return reports;
  }
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return reports.map((report) => ({ ...report, created_by_profile: profileById.get(report.created_by) || null }));
}

export async function signedWorkOrderReportUrl(report, expiresIn = 600) {
  if (!report?.bucket || !report?.path) return '';
  return createSignedUrl({ tenantId: report.tenant_id, bucket: report.bucket, path: report.path, entityType: 'ot_informe', entityId: report.id, expiresIn });
}
