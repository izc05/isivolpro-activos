import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import QRCodeCard from '../components/QR/QRCodeCard';
import DataTable from '../components/Cards/DataTable';
import { useRowById } from '../hooks/useRowById';
import { useTenantRows } from '../hooks/useTenantRows';

export default function LocationDetail() {
  const { id } = useParams();
  const { row } = useRowById('ubicaciones', id, '*, instalaciones(nombre)');
  const { rows: assets } = useTenantRows('activos', '*', { order: 'created_at' });
  const filteredAssets = assets.filter((asset) => asset.ubicacion_id === id);

  if (!row) return <PageHeader title="Ubicacion" subtitle="Cargando..." />;

  return (
    <>
      <PageHeader title={row.nombre} subtitle={row.instalaciones?.nombre} />
      <div className="grid two">
        <div className="card">
          <p><strong>Tipo:</strong> {row.tipo || '-'}</p>
          <p><strong>Planta:</strong> {row.planta || '-'}</p>
          <p><strong>Zona:</strong> {row.zona || '-'}</p>
          <p>{row.descripcion}</p>
        </div>
        <QRCodeCard token={row.qr_token} title={row.nombre} />
      </div>
      <div style={{ marginTop: 16 }}>
        <DataTable columns={[
          { key: 'nombre', label: 'Activos', render: (asset) => <Link to={`/activos/${asset.id}`}>{asset.nombre}</Link> },
          { key: 'tipo', label: 'Tipo' },
          { key: 'estado', label: 'Estado' },
          { key: 'qr', label: 'QR', render: (asset) => <span className="badge">{asset.qr_token?.slice(0, 8).toUpperCase()}</span> }
        ]} rows={filteredAssets} />
      </div>
      <div className="section-stack">
        <div className="section-title">
          <h2>QR de esta ubicacion y sus activos</h2>
        </div>
        <div className="qr-grid">
          <QRCodeCard token={row.qr_token} title={row.nombre} subtitle="QR de ubicacion" compact />
          {filteredAssets.map((asset) => (
            <QRCodeCard key={asset.id} token={asset.qr_token} title={asset.nombre} subtitle="QR de activo" compact />
          ))}
        </div>
      </div>
    </>
  );
}
