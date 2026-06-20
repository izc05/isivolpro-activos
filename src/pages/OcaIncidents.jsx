import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { listOcaIncidents, setOcaIncidentState } from '../services/ocaIncidentService';
import { createOcaCorrectiveWorkOrder } from '../services/ocaWorkOrderBridgeService';
import { isOcaSchemaMissing } from '../services/ocaDueDateService';
import { OcaSchemaNotice } from './OcaDashboard';
import { formatDate } from '../utils/dateUtils';
import { OCA_INCIDENT_CLASSIFICATIONS, OCA_INCIDENT_STATES, ocaLabel, ocaStatusClass } from '../constants/oca';

export default function OcaIncidents() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

  function refresh() {
    if (!activeTenantId) return;
    listOcaIncidents(activeTenantId)
      .then(setRows)
      .catch((err) => {
        if (isOcaSchemaMissing(err)) setSchemaPending(true);
        else setError(err.message);
      });
  }

  useEffect(refresh, [activeTenantId]);

  async function generateWorkOrder(row) {
    setError('');
    try {
      await createOcaCorrectiveWorkOrder(activeTenantId, row);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredRows = rows.filter((row) => !filter || row.estado === filter);

  return (
    <>
      <PageHeader title="Incidencias OCA" subtitle="Defectos, subsanaciones, evidencias y verificación responsable." />
      {schemaPending && <OcaSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <section className="filter-panel">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">Todos los estados</option>
          {OCA_INCIDENT_STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </section>
      <DataTable columns={[
        { key: 'inspeccion', label: 'Inspección', render: (row) => row.inspeccion_oca_id ? <Link className="table-link" to={`/oca/inspecciones/${row.inspeccion_oca_id}`}>{row.inspecciones_oca?.codigo || 'Abrir'}</Link> : '-' },
        { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
        { key: 'codigo', label: 'Código', render: (row) => row.codigo || '-' },
        { key: 'descripcion', label: 'Descripción', render: (row) => row.titulo || row.descripcion },
        { key: 'clasificacion', label: 'Clasificación', render: (row) => <span className={`badge ${ocaStatusClass(row.clasificacion)}`}>{ocaLabel(OCA_INCIDENT_CLASSIFICATIONS, row.clasificacion)}</span> },
        { key: 'fecha_limite', label: 'Fecha límite', render: (row) => formatDate(row.fecha_limite) },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${ocaStatusClass(row.estado)}`}>{ocaLabel(OCA_INCIDENT_STATES, row.estado)}</span> },
        { key: 'responsable', label: 'Responsable', render: (row) => row.responsable?.nombre || '-' },
        { key: 'acciones', label: 'Acciones', render: (row) => <div className="button-row"><button className="ghost-button" onClick={() => generateWorkOrder(row)}>Crear OT</button><button className="ghost-button" onClick={() => setOcaIncidentState(row, 'subsanada').then(refresh)}>Subsanada</button><button className="ghost-button" onClick={() => setOcaIncidentState(row, 'verificada').then(refresh)}>Verificar</button></div> }
      ]} rows={filteredRows} empty="No hay incidencias OCA." />
    </>
  );
}
