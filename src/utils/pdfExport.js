import jsPDF from 'jspdf';
import { formatDate } from './dateUtils';

export function exportAssetPdf({ asset, installation, location, documents = [], history = [], qrDataUrl }) {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('IsiVoltPro Activos QR', 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Documentacion tecnica y mantenimiento por QR', 14, 26);

  if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', 160, 12, 34, 34);

  const rows = [
    ['Activo', asset.nombre],
    ['Tipo', asset.tipo || ''],
    ['Estado', asset.estado || ''],
    ['Criticidad', asset.criticidad || ''],
    ['Instalacion', installation?.nombre || ''],
    ['Ubicacion', location?.nombre || ''],
    ['Marca / modelo', `${asset.marca || ''} ${asset.modelo || ''}`.trim()],
    ['Numero de serie', asset.numero_serie || ''],
    ['Fecha instalacion', formatDate(asset.fecha_instalacion)],
    ['Ultima revision', formatDate(asset.fecha_ultima_revision)],
    ['Proxima revision', formatDate(asset.fecha_proxima_revision)]
  ];

  let y = 54;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '-'), 58, y);
    y += 8;
  });

  doc.setFont('helvetica', 'bold');
  doc.text('Documentos asociados', 14, y + 8);
  doc.setFont('helvetica', 'normal');
  documents.slice(0, 8).forEach((item, index) => doc.text(`- ${item.titulo} (${item.tipo || 'sin tipo'})`, 14, y + 18 + index * 7));

  y += 82;
  doc.setFont('helvetica', 'bold');
  doc.text('Historial', 14, y);
  doc.setFont('helvetica', 'normal');
  history.slice(0, 8).forEach((item, index) => doc.text(`- ${formatDate(item.fecha)}: ${item.titulo}`, 14, y + 10 + index * 7));

  doc.setFontSize(9);
  doc.text(`Generado: ${formatDate(new Date())}`, 14, 286);
  doc.save(`activo-${asset.nombre}.pdf`);
}
