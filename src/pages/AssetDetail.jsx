import { useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import QRCodeCard from '../components/QR/QRCodeCard';
import DataTable from '../components/Cards/DataTable';
import { useRowById } from '../hooks/useRowById';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDate } from '../utils/dateUtils';
import { exportAssetPdf } from '../utils/pdfExport';
import { qrDataUrl } from '../services/qrService';

export default function AssetDetail() {
  const { id } = useParams();
  const { row: asset } = useRowById('activos', id, '*, instalaciones(nombre), ubicaciones(nombre)');
  const { rows: documents } = useTenantRows('documentos', '*', { order: 'created_at' });
  const { rows: history } = useTenantRows('historial_mantenimiento', '*', { order: 'fecha' });
  const { rows: incidents } = useTenantRows('incidencias', '*', { order: 'fecha_apertura' });

  if (!asset) return <PageHeader title="Activo" subtitle="Cargando ficha tecnica..." />;

  const assetDocuments = documents.filter((item) => item.activo_id === id);
  const assetHistory = history.filter((item) => item.activo_id === id);
  const assetIncidents = incidents.filter((item) => item.activo_id === id);

  async function handlePdf() {
    exportAssetPdf({
      asset,
      installation: asset.instalaciones,
      location: asset.ubicaciones,
      documents: assetDocuments,
      history: assetHistory,
      qrDataUrl: await qrDataUrl(asset.qr_token)
    });
  }

  return (
    <>
      <PageHeader title={asset.nombre} subtitle="Ficha tecnica de activo" action={<button className="primary-button" onClick={handlePdf}>Exportar PDF</button>} />
      <div className="grid two">
        <div className="card">
          <p><strong>Tipo:</strong> {asset.tipo || '-'}</p>
          <p><strong>Estado:</strong> <span className="badge">{asset.estado}</span></p>
          <p><strong>Criticidad:</strong> {asset.criticidad}</p>
          <p><strong>Instalacion:</strong> {asset.instalaciones?.nombre || '-'}</p>
          <p><strong>Ubicacion:</strong> {asset.ubicaciones?.nombre || '-'}</p>
          <p><strong>Marca:</strong> {asset.marca || '-'}</p>
          <p><strong>Modelo:</strong> {asset.modelo || '-'}</p>
          <p><strong>Numero de serie:</strong> {asset.numero_serie || '-'}</p>
          <p><strong>Fecha instalacion:</strong> {formatDate(asset.fecha_instalacion)}</p>
          <p><strong>Ultima revision:</strong> {formatDate(asset.fecha_ultima_revision)}</p>
          <p><strong>Proxima revision:</strong> {formatDate(asset.fecha_proxima_revision)}</p>
          <p><strong>Observaciones:</strong> {asset.observaciones || '-'}</p>
        </div>
        <QRCodeCard token={asset.qr_token} title={asset.nombre} />
      </div>
      <div className="grid" style={{ marginTop: 16 }}>
        <DataTable columns={[
          { key: 'titulo', label: 'Documentos' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'visibilidad', label: 'Visibilidad' }
        ]} rows={assetDocuments} />
        <DataTable columns={[
          { key: 'fecha', label: 'Historial', render: (row) => formatDate(row.fecha) },
          { key: 'tipo', label: 'Tipo' },
          { key: 'titulo', label: 'Titulo' }
        ]} rows={assetHistory} />
        <DataTable columns={[
          { key: 'titulo', label: 'Incidencias' },
          { key: 'prioridad', label: 'Prioridad' },
          { key: 'estado', label: 'Estado' }
        ]} rows={assetIncidents} />
      </div>
    </>
  );
}
