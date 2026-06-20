import { useEffect, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { groupControlsByDueDate, isOcaSchemaMissing, loadOcaDashboard } from '../services/ocaDueDateService';
import { OcaSchemaNotice } from './OcaDashboard';
import { formatDate } from '../utils/dateUtils';
import { OCA_SPECIALTIES, ocaLabel, ocaStatusClass } from '../constants/oca';

export default function OcaDueDates() {
  const { activeTenantId } = useTenant();
  const [groups, setGroups] = useState({});
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    loadOcaDashboard(activeTenantId)
      .then((data) => setGroups(groupControlsByDueDate(data.controls || [])))
      .catch((err) => {
        if (isOcaSchemaMissing(err)) setSchemaPending(true);
        else setError(err.message);
      });
  }, [activeTenantId]);

  return (
    <>
      <PageHeader title="Próximas y vencidas" subtitle="Control de vencimientos OCA por fecha, instalación y especialidad." />
      {schemaPending && <OcaSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <div className="section-stack">
        <DueTable title="Vencidas" rows={groups.overdue || []} />
        <DueTable title="Próximas 7 días" rows={groups.next7 || []} />
        <DueTable title="Próximas 30 días" rows={groups.next30 || []} />
        <DueTable title="Próximas 90 días" rows={groups.next90 || []} />
        <DueTable title="Sin próxima fecha" rows={groups.withoutNextDate || []} />
        <DueTable title="Sin inspección registrada" rows={groups.withoutDocumentation || []} />
      </div>
    </>
  );
}

function DueTable({ title, rows }) {
  return (
    <section>
      <h2 className="section-heading">{title}</h2>
      <DataTable columns={[
        { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
        { key: 'especialidad', label: 'Especialidad', render: (row) => ocaLabel(OCA_SPECIALTIES, row.especialidad) },
        { key: 'ultima', label: 'Última', render: (row) => formatDate(row.fecha_ultima_inspeccion) },
        { key: 'proxima', label: 'Próxima', render: (row) => formatDate(row.fecha_proxima_inspeccion) },
        { key: 'dias', label: 'Días restantes', render: (row) => row.daysRemaining ?? '-' },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${ocaStatusClass(row.estado)}`}>{row.estado?.replaceAll('_', ' ') || '-'}</span> }
      ]} rows={rows} empty="Sin elementos en este grupo." />
    </section>
  );
}
