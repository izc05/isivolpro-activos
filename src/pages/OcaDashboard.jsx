import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { loadOcaDashboard, isOcaSchemaMissing } from '../services/ocaDueDateService';
import { formatDate } from '../utils/dateUtils';
import { OCA_CONTROL_STATES, OCA_RESULTS, OCA_SPECIALTIES, ocaLabel, ocaStatusClass } from '../constants/oca';

export default function OcaDashboard() {
  const { activeTenantId } = useTenant();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    let mounted = true;
    setError('');
    setSchemaPending(false);
    loadOcaDashboard(activeTenantId)
      .then((result) => { if (mounted) setData(result); })
      .catch((err) => {
        if (!mounted) return;
        if (isOcaSchemaMissing(err)) {
          setSchemaPending(true);
          setData({ metrics: {}, controls: [] });
          return;
        }
        setError(err.message);
      });
    return () => { mounted = false; };
  }, [activeTenantId]);

  const metrics = data?.metrics || {};
  const cards = useMemo(() => [
    ['Al día', metrics.ok || 0, CheckCircle2, 'ok'],
    ['Próximas 30 días', metrics.next30 || 0, CalendarClock, 'warn'],
    ['Próximas 90 días', metrics.next90 || 0, CalendarClock],
    ['Vencidas', metrics.overdue || 0, AlertTriangle, 'danger'],
    ['Actas pendientes', metrics.missingActs || 0, FileWarning, 'warn'],
    ['Condicionadas', metrics.conditioned || 0, AlertTriangle, 'warn'],
    ['Desfavorables', metrics.unfavorable || 0, AlertTriangle, 'danger'],
    ['Incidencias pendientes', metrics.pendingIncidents || 0, AlertTriangle, 'warn'],
    ['Pendientes de verificación', metrics.pendingVerification || 0, ShieldCheck]
  ], [metrics]);

  return (
    <>
      <PageHeader
        title="Panel OCA"
        subtitle="Calendario, documentación e historial de cumplimiento reglamentario por instalación."
        action={<div className="button-row"><Link className="secondary-button" to="/oca/vencimientos">Ver vencimientos</Link><Link className="primary-button" to="/oca/inspecciones/nueva">Nueva inspección</Link></div>}
      />
      {schemaPending && <OcaSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      <section className="grid metrics oca-metrics">
        {cards.map(([label, value, Icon, tone]) => (
          <article className={`metric-card ${tone || ''}`} key={label}>
            <Icon size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section>
        <h2 className="section-heading">Control por instalación</h2>
        <DataTable columns={[
          { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'especialidad', label: 'Tipo OCA', render: (row) => ocaLabel(OCA_SPECIALTIES, row.especialidad) },
          { key: 'ultima', label: 'Última inspección', render: (row) => formatDate(row.fecha_ultima_inspeccion) },
          { key: 'resultado', label: 'Resultado', render: (row) => ocaLabel(OCA_RESULTS, row.latestInspection?.resultado) },
          { key: 'proxima', label: 'Próxima', render: (row) => formatDate(row.fecha_proxima_inspeccion) },
          { key: 'dias', label: 'Días', render: (row) => row.daysRemaining ?? '-' },
          { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${ocaStatusClass(row.estado)}`}>{ocaLabel(OCA_CONTROL_STATES, row.estado)}</span> }
        ]} rows={data?.controls || []} empty="No hay controles OCA registrados." />
      </section>
    </>
  );
}

export function OcaSchemaNotice() {
  return (
    <div className="schema-notice">
      <strong>La estructura del Bloque OCA todavía no está aplicada en Supabase.</strong>
      <span>Ejecuta la migración `src/sql/031_bloque_control_oca.sql` para activar controles, inspecciones, incidencias y documentación OCA.</span>
    </div>
  );
}
