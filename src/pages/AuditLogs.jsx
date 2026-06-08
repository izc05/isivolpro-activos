import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDateTime } from '../utils/dateUtils';

export default function AuditLogs() {
  const { rows } = useTenantRows('audit_logs', '*, profiles(email,nombre)', { order: 'created_at' });
  return (
    <>
      <PageHeader title="Auditoria" subtitle="Accesos, descargas, modificaciones y denegaciones registradas." />
      <DataTable columns={[
        { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) },
        { key: 'action', label: 'Accion' },
        { key: 'user', label: 'Usuario', render: (row) => row.profiles?.nombre || row.profiles?.email || 'Sistema' },
        { key: 'entity_type', label: 'Entidad' },
        { key: 'metadata', label: 'Metadata', render: (row) => JSON.stringify(row.metadata || {}) }
      ]} rows={rows} />
    </>
  );
}
