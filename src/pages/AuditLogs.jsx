import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Filter } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import WorkOrderSection from '../components/WorkOrders/WorkOrderSection';
import { useTenantRows } from '../hooks/useTenantRows';
import { formatDateTime } from '../utils/dateUtils';
import { auditActionLabel, auditMetadataSummary, getAuditWorkOrderId, isWorkOrderAuditEntry } from '../services/auditService';

const SCOPE_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ot', label: 'Solo órdenes de trabajo' },
  { value: 'seguridad', label: 'Seguridad / accesos' },
  { value: 'archivos', label: 'Archivos / descargas' }
];

function scopeMatches(row, scope) {
  if (scope === 'todos') return true;
  if (scope === 'ot') return isWorkOrderAuditEntry(row);
  if (scope === 'seguridad') return ['login', 'logout', 'access_denied', 'permission_denied'].some((token) => String(row.action || '').includes(token));
  if (scope === 'archivos') return ['upload', 'download', 'file', 'pdf', 'document'].some((token) => String(row.action || '').includes(token));
  return true;
}

function metadataText(row) {
  return auditMetadataSummary(row.metadata || {});
}

export default function AuditLogs() {
  const { rows } = useTenantRows('audit_logs', '*, profiles(email,nombre)', { order: 'created_at' });
  const [filters, setFilters] = useState({ search: '', scope: 'todos' });

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return sortedRows.filter((row) => {
      const searchable = [
        row.action,
        auditActionLabel(row.action),
        row.entity_type,
        row.entity_id,
        row.profiles?.nombre,
        row.profiles?.email,
        metadataText(row),
        JSON.stringify(row.metadata || {})
      ].filter(Boolean).join(' ').toLowerCase();
      return scopeMatches(row, filters.scope) && (!text || searchable.includes(text));
    });
  }, [sortedRows, filters]);

  const otCount = useMemo(() => sortedRows.filter(isWorkOrderAuditEntry).length, [sortedRows]);
  const correctionCount = useMemo(() => sortedRows.filter((row) => row.action === 'request_work_order_corrections').length, [sortedRows]);
  const validationCount = useMemo(() => sortedRows.filter((row) => row.action === 'validate_work_order').length, [sortedRows]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <>
      <PageHeader title="Auditoria" subtitle="Libro de movimientos: accesos, cambios de OT, informes, firmas, fotos, materiales y acciones administrativas." />

      <section className="technician-kpi-grid" aria-label="Resumen auditoria">
        <article><Activity size={18} /><span>Registros</span><strong>{rows.length}</strong></article>
        <article><Activity size={18} /><span>Eventos OT</span><strong>{otCount}</strong></article>
        <article className={correctionCount ? 'warn' : ''}><Activity size={18} /><span>Correcciones</span><strong>{correctionCount}</strong></article>
        <article><Activity size={18} /><span>Validaciones</span><strong>{validationCount}</strong></article>
      </section>

      <WorkOrderSection title="Filtros de auditoría" subtitle="Localiza rápidamente movimientos de órdenes, usuarios, archivos o cambios de estado" icon={Filter} badge={`${filteredRows.length}/${rows.length}`} defaultOpen>
        <div className="user-filter-grid">
          <label>
            <span>Buscar</span>
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="OT, acción, usuario, motivo, informe, material..." />
          </label>
          <label>
            <span>Ámbito</span>
            <select value={filters.scope} onChange={(event) => updateFilter('scope', event.target.value)}>
              {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="quick-actions user-filter-actions">
          <button className="secondary-button" type="button" onClick={() => updateFilter('scope', 'ot')}>Solo OT</button>
          <button className="secondary-button" type="button" onClick={() => updateFilter('search', 'correccion')}>Correcciones</button>
          <button className="secondary-button" type="button" onClick={() => updateFilter('search', 'validada')}>Validadas</button>
          <button className="ghost-button" type="button" onClick={() => setFilters({ search: '', scope: 'todos' })}>Limpiar</button>
        </div>
      </WorkOrderSection>

      <DataTable columns={[
        { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) },
        { key: 'action', label: 'Acción', render: (row) => <strong>{auditActionLabel(row.action)}</strong> },
        { key: 'user', label: 'Usuario', render: (row) => row.profiles?.nombre || row.profiles?.email || 'Sistema' },
        { key: 'entity_type', label: 'Entidad', render: (row) => row.entity_type || '-' },
        { key: 'ot', label: 'OT', render: (row) => {
          const workOrderId = getAuditWorkOrderId(row);
          return workOrderId ? <Link to={`/ots/${workOrderId}`}>{String(workOrderId).slice(0, 8)}</Link> : '-';
        } },
        { key: 'metadata', label: 'Detalle', render: (row) => metadataText(row) }
      ]} rows={filteredRows} empty="Sin registros de auditoría para los filtros seleccionados." />
    </>
  );
}
