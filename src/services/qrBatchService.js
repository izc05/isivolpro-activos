import { jsPDF } from 'jspdf';
import { qrDataUrl } from './qrService';
import { shortId } from '../utils/qrUtils';

const PAGE = {
  width: 210,
  height: 297,
  margin: 10,
  gap: 4,
  cardWidth: 45,
  cardHeight: 55,
  qrSize: 30
};

function safeLabel(value = '', fallback = '-') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function filenameDate() {
  return new Date().toISOString().slice(0, 10);
}

function addWrappedText(doc, text, x, y, maxWidth, options = {}) {
  const lines = doc.splitTextToSize(safeLabel(text), maxWidth).slice(0, options.maxLines || 2);
  lines.forEach((line, index) => doc.text(line, x, y + index * (options.lineHeight || 3.4), { align: options.align || 'center' }));
}

export async function generateQrBatchPdf({
  items = [],
  title = 'Etiquetas QR',
  kind = 'internal',
  baseUrl
}) {
  const printableItems = items.filter((item) => item?.token);
  if (!printableItems.length) throw new Error('No hay QR disponibles para generar el PDF.');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const columns = Math.floor((PAGE.width - PAGE.margin * 2 + PAGE.gap) / (PAGE.cardWidth + PAGE.gap));
  const rows = Math.floor((PAGE.height - PAGE.margin * 2 - 14 + PAGE.gap) / (PAGE.cardHeight + PAGE.gap));
  const perPage = Math.max(1, columns * rows);

  for (let index = 0; index < printableItems.length; index += 1) {
    if (index > 0 && index % perPage === 0) doc.addPage();

    const pageIndex = index % perPage;
    const column = pageIndex % columns;
    const row = Math.floor(pageIndex / columns);
    const x = PAGE.margin + column * (PAGE.cardWidth + PAGE.gap);
    const y = PAGE.margin + 14 + row * (PAGE.cardHeight + PAGE.gap);
    const item = printableItems[index];

    if (pageIndex === 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(23, 32, 51);
      doc.text(title, PAGE.margin, PAGE.margin + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(102, 112, 133);
      doc.text(`${printableItems.length} QR · ${kind === 'public-incident' ? 'Aviso externo' : 'Acceso interno'} · ${filenameDate()}`, PAGE.margin, PAGE.margin + 7);
    }

    doc.setDrawColor(220, 226, 235);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, PAGE.cardWidth, PAGE.cardHeight, 2, 2, 'FD');

    const qr = await qrDataUrl(item.token, baseUrl, kind);
    doc.addImage(qr, 'PNG', x + (PAGE.cardWidth - PAGE.qrSize) / 2, y + 4, PAGE.qrSize, PAGE.qrSize);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(23, 32, 51);
    addWrappedText(doc, item.title, x + PAGE.cardWidth / 2, y + 38, PAGE.cardWidth - 6, { maxLines: 2 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(102, 112, 133);
    addWrappedText(doc, item.subtitle || item.type || '', x + PAGE.cardWidth / 2, y + 46, PAGE.cardWidth - 6, { maxLines: 1 });
    doc.text(`ID ${shortId(item.token)}`, x + PAGE.cardWidth / 2, y + 51.5, { align: 'center' });
  }

  return {
    blob: doc.output('blob'),
    filename: `qr-etiquetas-${kind === 'public-incident' ? 'avisos-' : ''}${filenameDate()}.pdf`,
    count: printableItems.length
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
