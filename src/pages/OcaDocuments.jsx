import { useEffect, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { listOcaDocuments } from '../services/ocaDocumentService';
import { isOcaSchemaMissing } from '../services/ocaDueDateService';
import { OcaSchemaNotice } from './OcaDashboard';
import { formatDate } from '../utils/dateUtils';
import { OCA_DOCUMENT_TYPES, ocaLabel } from '../constants/oca';

export default function OcaDocuments() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    listOcaDocuments(activeTenantId)
      .then(setRows)
      .catch((err) => {
        if (isOcaSchemaMissing(err)) setSchemaPending(true);
        else setError(err.message);
      });
  }, [activeTenantId]);

  return (
    <>
      <PageHeader title="Documentación OCA" subtitle="Actas, certificados, proyectos y documentación reglamentaria vinculada sin duplicar archivos." />
      {schemaPending && <OcaSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <DataTable columns={[
        { key: 'documento', label: 'Documento', render: (row) => row.documentos?.titulo || '-' },
        { key: 'instalacion', label: 'Instalación', render: (row) => row.inspecciones_oca?.instalaciones?.nombre || row.controles_oca?.instalaciones?.nombre || row.incidencias_oca?.instalaciones?.nombre || '-' },
        { key: 'inspeccion', label: 'Inspección', render: (row) => row.inspecciones_oca?.codigo || formatDate(row.inspecciones_oca?.fecha_realizada) },
        { key: 'tipo', label: 'Tipo', render: (row) => ocaLabel(OCA_DOCUMENT_TYPES, row.tipo_documento) },
        { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.created_at) },
        { key: 'version', label: 'Versión', render: (row) => row.documentos?.version || 1 },
        { key: 'visibilidad', label: 'Visibilidad', render: (row) => row.documentos?.visibilidad || '-' },
        { key: 'descarga', label: 'Archivo', render: (row) => row.documentos?.file_name || '-' }
      ]} rows={rows} empty="No hay documentación OCA vinculada." />
    </>
  );
}
