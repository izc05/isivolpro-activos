import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { listMaintenanceHistory, createManualMaintenanceHistory } from '../services/maintenanceHistoryService';
import { formatDate } from '../utils/dateUtils';
import { MAINTENANCE_TYPES, maintenanceTypeLabel } from '../constants/maintenance';
import { softDeleteEntity } from '../services/entityService';

const emptyForm = {
  activo_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  tipo: 'historico',
  titulo: '',
  trabajo_realizado: '',
  tecnico_id: '',
  resultado: '',
  estado_final: '',
  coste_materiales: 0,
  coste_mano_obra: 0,
  garantia_hasta: '',
  proxima_accion: '',
  proxima_fecha: '',
  observaciones: ''
};

export default function MaintenanceHistory() {
  const { rows: assets, activeTenantId } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const { rows: users } = useTenantRows('tenant_members', 'id,user_id,role,profiles(nombre,email)', { order: 'created_at' });
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ tipo: '', activo_id: '' });
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    if (!activeTenantId) return;
    setRows(await listMaintenanceHistory(activeTenantId));
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [activeTenantId]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filters.tipo && row.tipo !== filters.tipo) return false;
    if (filters.activo_id && row.activo_id !== filters.activo_id) return false;
    const text = `${row.titulo || ''} ${row.trabajo_realizado || ''} ${row.activos?.nombre || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [rows, search, filters]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await createManualMaintenanceHistory(activeTenantId, form);
      setForm(emptyForm);
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el registro "${row.titulo}"?`)) return;
    await softDeleteEntity({ table: 'historial_mantenimiento', tenantId: row.tenant_id, id: row.id, entityType: 'historial_mantenimiento', auditAction: 'delete_maintenance_history' });
    await refresh();
  }

  function exportCsv() {
    const header = ['fecha', 'activo', 'tipo', 'titulo', 'tecnico', 'resultado', 'estado_final', 'coste', 'ot', 'proxima_fecha'];
    const lines = visibleRows.map((row) => [
      row.fecha,
      row.activos?.nombre || '',
      maintenanceTypeLabel(row.tipo),
      row.titulo || '',
      row.tecnico?.nombre || row.tecnico?.email || '',
      row.resultado || '',
      row.estado_activo_final || row.estado_final || '',
      row.coste_total || 0,
      row.ordenes_trabajo?.codigo_ot || '',
      row.proxima_fecha || ''
    ].map(csvValue).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historial-mantenimiento.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Historial"
        subtitle="Cronología técnica consolidada de preventivos, correctivos, sustituciones, mejoras, OT e incidencias."
        action={<div className="button-row"><button className="secondary-button" onClick={exportCsv}><Download size={18} /> Exportar</button><button className="primary-button" onClick={() => setOpen(true)}><Plus size={18} /> Registrar trabajo</button></div>}
      />
      {error && <p className="error-text">{error}</p>}
      <section className="filter-panel maintenance-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por activo, título o trabajo realizado" />
        <select value={filters.tipo} onChange={(event) => setFilters((current) => ({ ...current, tipo: event.target.value }))}>
          <option value="">Todos los tipos</option>
          {MAINTENANCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <select value={filters.activo_id} onChange={(event) => setFilters((current) => ({ ...current, activo_id: event.target.value }))}>
          <option value="">Todos los activos</option>
          {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.nombre}</option>)}
        </select>
      </section>
      <DataTable columns={[
        { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha) },
        { key: 'activo', label: 'Activo', render: (row) => row.activo_id ? <Link className="table-link" to={`/activos/${row.activo_id}`}>{row.activos?.nombre || row.activo_id}</Link> : '-' },
        { key: 'tipo', label: 'Tipo', render: (row) => maintenanceTypeLabel(row.tipo) },
        { key: 'titulo', label: 'Título' },
        { key: 'tecnico', label: 'Técnico', render: (row) => row.tecnico?.nombre || row.tecnico?.email || '-' },
        { key: 'resultado', label: 'Resultado', render: (row) => row.resultado || '-' },
        { key: 'estado', label: 'Estado final', render: (row) => row.estado_activo_final || row.estado_final || '-' },
        { key: 'coste', label: 'Coste', render: (row) => `${Number(row.coste_total || 0).toFixed(2)} €` },
        { key: 'ot', label: 'OT', render: (row) => row.ot_id ? <Link className="table-link" to={`/ots/${row.ot_id}`}>{row.ordenes_trabajo?.codigo_ot || 'Abrir'}</Link> : '-' },
        { key: 'proxima', label: 'Próxima', render: (row) => formatDate(row.proxima_fecha) },
        { key: 'actions', label: 'Acciones', render: (row) => <button className="danger-button" onClick={() => remove(row)}>Baja</button> }
      ]} rows={visibleRows} empty="Sin historial técnico." />
      <Modal title="Registrar trabajo sin OT" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Activo">
            <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.nombre}</option>)}
            </select>
          </FormField>
          <div className="grid two">
            <FormField label="Fecha"><input type="date" value={form.fecha} onChange={(event) => updateField('fecha', event.target.value)} required /></FormField>
            <FormField label="Tipo"><select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)}>{MAINTENANCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></FormField>
          </div>
          <FormField label="Título"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
          <FormField label="Trabajo realizado"><textarea rows="4" value={form.trabajo_realizado} onChange={(event) => updateField('trabajo_realizado', event.target.value)} /></FormField>
          <div className="grid two">
            <FormField label="Técnico"><select value={form.tecnico_id} onChange={(event) => updateField('tecnico_id', event.target.value)}><option value="">Usuario actual</option>{users.map((user) => <option key={user.user_id || user.id} value={user.user_id || user.id}>{user.profiles?.nombre || user.profiles?.email}</option>)}</select></FormField>
            <FormField label="Resultado"><input value={form.resultado} onChange={(event) => updateField('resultado', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Estado final"><input value={form.estado_final} onChange={(event) => updateField('estado_final', event.target.value)} /></FormField>
            <FormField label="Garantía hasta"><input type="date" value={form.garantia_hasta} onChange={(event) => updateField('garantia_hasta', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Coste materiales"><input type="number" min="0" step="0.01" value={form.coste_materiales} onChange={(event) => updateField('coste_materiales', event.target.value)} /></FormField>
            <FormField label="Coste mano de obra"><input type="number" min="0" step="0.01" value={form.coste_mano_obra} onChange={(event) => updateField('coste_mano_obra', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Próxima acción"><input value={form.proxima_accion} onChange={(event) => updateField('proxima_accion', event.target.value)} /></FormField>
            <FormField label="Próxima fecha"><input type="date" value={form.proxima_fecha} onChange={(event) => updateField('proxima_fecha', event.target.value)} /></FormField>
          </div>
          <FormField label="Observaciones"><textarea rows="3" value={form.observaciones} onChange={(event) => updateField('observaciones', event.target.value)} /></FormField>
          <div className="form-actions"><button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar historial</button></div>
        </form>
      </Modal>
    </>
  );
}

function csvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
