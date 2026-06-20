import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { listOcaInspections } from '../services/ocaInspectionService';
import { listOcaIncidents } from '../services/ocaIncidentService';
import { isOcaSchemaMissing } from '../services/ocaDueDateService';
import { OcaSchemaNotice } from './OcaDashboard';
import { formatDate } from '../utils/dateUtils';
import { OCA_INSPECTION_STATES, OCA_RESULTS, OCA_SPECIALTIES, ocaLabel, ocaStatusClass } from '../constants/oca';

export default function OcaInspections() {
  const { activeTenantId, activeTenant } = useTenant();
  const [rows, setRows] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [filters, setFilters] = useState({ search: '', resultado: '', estado: '', especialidad: '' });
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    setError('');
    setSchemaPending(false);
    Promise.all([listOcaInspections(activeTenantId), listOcaIncidents(activeTenantId)])
      .then(([inspectionRows, incidentRows]) => {
        setRows(inspectionRows);
        setIncidents(incidentRows);
      })
      .catch((err) => {
        if (isOcaSchemaMissing(err)) {
          setSchemaPending(true);
          return;
        }
        setError(err.message);
      });
  }, [activeTenantId]);

  const incidentCountByInspection = useMemo(() => {
    const map = new Map();
    incidents.forEach((incident) => {
      if (!['verificada', 'no_procede'].includes(incident.estado)) {
        map.set(incident.inspeccion_oca_id, (map.get(incident.inspeccion_oca_id) || 0) + 1);
      }
    });
    return map;
  }, [incidents]);

  const filteredRows = rows.filter((row) => {
    const text = `${row.codigo || ''} ${row.instalaciones?.nombre || ''} ${row.organismo_control || ''} ${row.numero_acta || ''}`.toLowerCase();
    return (!filters.search || text.includes(filters.search.toLowerCase()))
      && (!filters.resultado || row.resultado === filters.resultado)
      && (!filters.estado || row.estado === filters.estado)
      && (!filters.especialidad || row.controles_oca?.especialidad === filters.especialidad);
  });

  return (
    <>
      <PageHeader
        title="Inspecciones OCA"
        subtitle="Registro de inspecciones realizadas o programadas, actas, resultados e incidencias."
        action={<Link className="primary-button" to="/oca/inspecciones/nueva">Nueva inspección</Link>}
      />
      {schemaPending && <OcaSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <section className="filter-panel">
        <input placeholder="Buscar instalación, acta u organismo" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select value={filters.especialidad} onChange={(event) => setFilters({ ...filters, especialidad: event.target.value })}>
          <option value="">Todas las especialidades</option>
          {OCA_SPECIALTIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.resultado} onChange={(event) => setFilters({ ...filters, resultado: event.target.value })}>
          <option value="">Todos los resultados</option>
          {OCA_RESULTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.estado} onChange={(event) => setFilters({ ...filters, estado: event.target.value })}>
          <option value="">Todos los estados</option>
          {OCA_INSPECTION_STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </section>
      <DataTable columns={[
        { key: 'codigo', label: 'Código', render: (row) => <Link className="table-link" to={`/oca/inspecciones/${row.id}`}>{row.codigo || 'Abrir'}</Link> },
        { key: 'cliente', label: 'Cliente', render: () => activeTenant?.nombre || '-' },
        { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
        { key: 'especialidad', label: 'Especialidad', render: (row) => ocaLabel(OCA_SPECIALTIES, row.controles_oca?.especialidad) },
        { key: 'fecha_realizada', label: 'Fecha realizada', render: (row) => formatDate(row.fecha_realizada) },
        { key: 'organismo_control', label: 'Organismo' },
        { key: 'numero_acta', label: 'Acta', render: (row) => row.numero_acta || '-' },
        { key: 'resultado', label: 'Resultado', render: (row) => <span className={`badge ${ocaStatusClass(row.resultado)}`}>{ocaLabel(OCA_RESULTS, row.resultado)}</span> },
        { key: 'proxima', label: 'Próxima', render: (row) => formatDate(row.fecha_proxima_inspeccion) },
        { key: 'incidencias', label: 'Incidencias', render: (row) => incidentCountByInspection.get(row.id) || 0 },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${ocaStatusClass(row.estado)}`}>{ocaLabel(OCA_INSPECTION_STATES, row.estado)}</span> }
      ]} rows={filteredRows} empty="No hay inspecciones OCA." />
    </>
  );
}
