import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Filter, RefreshCw, ShieldCheck, Wrench, XCircle } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { formatDateTime } from '../utils/dateUtils';
import { createIncident } from '../services/entityService';
import { listTenantMembers } from '../services/tenantService';
import {
  closeIncidentWorkflow,
  convertIncidentToWorkOrder,
  discardIncident,
  INCIDENT_STATUS_LABELS,
  markIncidentInReview
} from '../services/incidentWorkflowService';
import { OFFICIAL_WORK_ORDER_TYPES, workOrderTypeLabel } from '../utils/workOrderLifecycle';

const INITIAL_FORM = { instalacion_id: '', ubicacion_id: '', activo_id: '', titulo: '', descripcion: '', prioridad: 'media' };
const INITIAL_CONVERT = {
  titulo: '',
  tipo_ot: 'aviso_cliente',
  assigned_to: '',
  prioridad: '',
  fecha_prevista: '',
  fecha_limite: '',
  instrucciones_tecnico: '',
  resultado_esperado: '',
  notas_revision: '',
  requiere_materiales: false,
  requiere_firma_cliente: false
};

const PRIORITY_LABELS = { baja: 'Baja', media: 'Media', normal: 'Normal', alta: 'Alta', urgente: 'Urgente', critica: 'Crítica' };
const PRIORITY_TONE = { urgente: 'danger', critica: 'danger', alta: 'warn', media: 'warn', normal: '', baja: '' };

function normalizePriorityForOt(priority) {
  if (priority === 'media') return 'normal';
  return priority || 'normal';
}

function externalReport(row) {
  return Array.isArray(row.external_incident_reports) ? row.external_incident_reports[0] : row.external_incident_reports || null;
}

export default function Incidents() {
  const { rows, activeTenantId, refresh } = useTenantRows('incidencias', '*, instalaciones(nombre), ubicaciones(nombre), activos(nombre), external_incident_reports(id,reporter_name,reporter_contact,created_at)', { order: 'fecha_apertura' });
  const { canManageWorkOrders } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id', { order: 'nombre', ascending: true });
  const [technicians, setTechnicians] = useState([]);
  const [open, setOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [convertForm, setConvertForm] = useState(INITIAL_CONVERT);
  const [filters, setFilters] = useState({ search: '', estado: 'abiertas', prioridad: 'todas' });

  useEffect(() => {
    if (!activeTenantId) return;
    listTenantMembers(activeTenantId)
      .then((members) => setTechnicians(members.filter((member) => member.estado === 'activo' && ['admin_cliente', 'tecnico', 'tecnico_externo'].includes(member.role))))
      .catch((err) => console.warn('No se pudieron cargar tecnicos', err));
  }, [activeTenantId]);

  const filteredLocations = useMemo(() => locations.filter((location) => !form.instalacion_id || location.instalacion_id === form.instalacion_id), [locations, form.instalacion_id]);
  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (form.ubicacion_id) return asset.ubicacion_id === form.ubicacion_id;
    if (form.instalacion_id) return asset.instalacion_id === form.instalacion_id;
    return true;
  }), [assets, form.instalacion_id, form.ubicacion_id]);

  const stats = useMemo(() => ({
    abiertas: rows.filter((row) => ['abierta', 'en_revision'].includes(row.estado)).length,
    revision: rows.filter((row) => row.estado === 'en_revision').length,
    externas: rows.filter((row) => externalReport(row)).length,
    convertidas: rows.filter((row) => row.estado === 'convertida_en_ot').length,
    urgentes: rows.filter((row) => ['urgente', 'critica'].includes(row.prioridad) && !['cerrada', 'descartada', 'convertida_en_ot'].includes(row.estado)).length
  }), [rows]);

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      const report = externalReport(row);
      const searchable = `${row.titulo || ''} ${row.descripcion || ''} ${row.instalaciones?.nombre || ''} ${row.ubicaciones?.nombre || ''} ${row.activos?.nombre || ''} ${report?.reporter_name || ''} ${report?.reporter_contact || ''}`.toLowerCase();
      const matchText = !text || searchable.includes(text);
      const matchPriority = filters.prioridad === 'todas' || row.prioridad === filters.prioridad;
      const matchStatus = filters.estado === 'todas'
        || (filters.estado === 'abiertas' && ['abierta', 'en_revision'].includes(row.estado))
        || row.estado === filters.estado;
      return matchText && matchPriority && matchStatus;
    });
  }, [rows, filters]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateConvertField(field, value) {
    setConvertForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await createIncident(activeTenantId, form);
      setForm(INITIAL_FORM);
      setOpen(false);
      setMessage('Incidencia creada correctamente.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markReview(row) {
    setError('');
    setMessage('');
    try {
      await markIncidentInReview(row, row.notas_revision || 'Incidencia marcada para revisión.');
      setMessage('Incidencia marcada en revisión.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function openConvert(row) {
    setSelectedIncident(row);
    setConvertForm({
      ...INITIAL_CONVERT,
      titulo: `Incidencia: ${row.titulo}`,
      prioridad: normalizePriorityForOt(row.prioridad),
      resultado_esperado: 'Resolver incidencia comunicada y dejar constancia de la actuación realizada.'
    });
    setConvertOpen(true);
  }

  async function submitConvert(event) {
    event.preventDefault();
    if (!selectedIncident) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const { workOrder } = await convertIncidentToWorkOrder(selectedIncident, {
        ...convertForm,
        configuracion: {
          requiere_checklist: true,
          requiere_fotos_iniciales: true,
          requiere_fotos_finales: true,
          requiere_materiales: Boolean(convertForm.requiere_materiales),
          requiere_firma_cliente: Boolean(convertForm.requiere_firma_cliente),
          requiere_informe: true,
          requiere_revision_admin: true,
          requiere_prueba_funcional_final: true
        }
      });
      setConvertOpen(false);
      setSelectedIncident(null);
      setMessage(`Incidencia convertida en OT ${workOrder.codigo_ot || workOrder.id.slice(0, 8)}.`);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function closeIncident(row) {
    setError('');
    setMessage('');
    try {
      await closeIncidentWorkflow(row);
      setMessage('Incidencia cerrada correctamente.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function discard(row) {
    const reason = window.prompt('Motivo para descartar la incidencia');
    if (!reason) return;
    setError('');
    setMessage('');
    try {
      await discardIncident(row, reason);
      setMessage('Incidencia descartada correctamente.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader title="Incidencias" subtitle="Entrada de avisos desde QR, revisión y conversión controlada en OT." action={<button className="primary-button" onClick={() => setOpen(true)}>Nueva incidencia</button>} />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <CollapsibleSection title="Resumen incidencias" subtitle="Avisos abiertos, externos, en revisión y convertidos en OT" icon={ClipboardCheck} badge={`${stats.abiertas} abiertas`} defaultOpen>
        <section className="grid metrics user-module-metrics">
          <article className="metric-card"><span>Abiertas</span><strong>{stats.abiertas}</strong></article>
          <article className="metric-card warn"><span>En revisión</span><strong>{stats.revision}</strong></article>
          <article className="metric-card"><span>Externas QR</span><strong>{stats.externas}</strong></article>
          <article className="metric-card danger"><span>Urgentes/críticas</span><strong>{stats.urgentes}</strong></article>
          <article className="metric-card"><span>Convertidas en OT</span><strong>{stats.convertidas}</strong></article>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title="Filtros" subtitle="Busca por aviso, instalación, ubicación, activo o contacto" icon={Filter} badge={`${filteredRows.length}/${rows.length}`} defaultOpen>
        <div className="user-filter-grid">
          <label><span>Buscar</span><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Título, descripción, instalación, activo o contacto" /></label>
          <label><span>Estado</span><select value={filters.estado} onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}><option value="abiertas">Abiertas y en revisión</option><option value="todas">Todas</option><option value="abierta">Abierta</option><option value="en_revision">En revisión</option><option value="convertida_en_ot">Convertida en OT</option><option value="descartada">Descartada</option><option value="cerrada">Cerrada</option></select></label>
          <label><span>Prioridad</span><select value={filters.prioridad} onChange={(event) => setFilters((current) => ({ ...current, prioridad: event.target.value }))}><option value="todas">Todas</option><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="critica">Crítica</option></select></label>
          <label><span>Vista rápida</span><select value={filters.estado} onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}><option value="abiertas">Pendientes</option><option value="convertida_en_ot">Convertidas</option><option value="descartada">Descartadas</option></select></label>
        </div>
        <div className="quick-actions user-filter-actions"><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, estado: 'en_revision' }))}>En revisión</button><button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, prioridad: 'urgente', estado: 'abiertas' }))}>Urgentes</button><button className="ghost-button" type="button" onClick={() => setFilters({ search: '', estado: 'abiertas', prioridad: 'todas' })}>Limpiar</button></div>
      </CollapsibleSection>

      <CollapsibleSection title="Listado de incidencias" subtitle="Revisa, convierte en OT, descarta o cierra avisos" icon={ShieldCheck} defaultOpen>
        <DataTable columns={[
          { key: 'titulo', label: 'Título', render: (row) => <div><strong>{row.titulo}</strong><small className="muted" style={{ display: 'block' }}>{row.descripcion || '-'}</small></div> },
          { key: 'origen', label: 'Origen / contacto', render: (row) => { const report = externalReport(row); return report ? <div><span className="badge">QR público</span><small className="muted" style={{ display: 'block', marginTop: 4 }}>{report.reporter_name} · {report.reporter_contact}</small></div> : <span className="badge">Interna</span>; } },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className={`badge ${PRIORITY_TONE[row.prioridad] || ''}`}>{PRIORITY_LABELS[row.prioridad] || row.prioridad}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.estado === 'convertida_en_ot' || row.estado === 'cerrada' ? 'ok' : row.estado === 'descartada' ? 'danger' : 'warn'}`}>{INCIDENT_STATUS_LABELS[row.estado] || row.estado}</span> },
          { key: 'instalacion', label: 'Instalación', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre || '-' },
          { key: 'fecha_apertura', label: 'Apertura', render: (row) => formatDateTime(row.fecha_apertura) },
          { key: 'ot', label: 'OT', render: (row) => row.ot_id ? <Link className="table-link" to={`/ots/${row.ot_id}`}>Ver OT</Link> : '-' },
          { key: 'actions', label: 'Acciones', render: (row) => <IncidentActions row={row} canManageWorkOrders={canManageWorkOrders} onReview={markReview} onConvert={openConvert} onClose={closeIncident} onDiscard={discard} /> }
        ]} rows={filteredRows} empty="Sin incidencias con los filtros actuales" />
      </CollapsibleSection>

      <Modal title="Nueva incidencia" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Instalación"><select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required><option value="">Seleccionar</option>{installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
          <FormField label="Ubicación"><select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}><option value="">Sin ubicación</option>{filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
          <FormField label="Activo"><select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)}><option value="">Sin activo concreto</option>{filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
          <FormField label="Título"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
          <FormField label="Prioridad"><select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="critica">Crítica</option></select></FormField>
          <FormField label="Descripción"><textarea rows="4" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <div className="form-actions"><button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Crear incidencia</button></div>
        </form>
      </Modal>

      <Modal title="Convertir incidencia en OT" open={convertOpen} onClose={() => setConvertOpen(false)}>
        <form className="form-grid" onSubmit={submitConvert}>
          {selectedIncident && <p className="muted">Se creará una OT vinculada a: <strong>{selectedIncident.titulo}</strong></p>}
          <div className="grid two">
            <FormField label="Título OT"><input value={convertForm.titulo} onChange={(event) => updateConvertField('titulo', event.target.value)} required /></FormField>
            <FormField label="Tipo OT"><select value={convertForm.tipo_ot} onChange={(event) => updateConvertField('tipo_ot', event.target.value)}>{OFFICIAL_WORK_ORDER_TYPES.map((type) => <option key={type} value={type}>{workOrderTypeLabel(type)}</option>)}</select></FormField>
            <FormField label="Prioridad OT"><select value={convertForm.prioridad} onChange={(event) => updateConvertField('prioridad', event.target.value)}><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="critica">Crítica</option></select></FormField>
            <FormField label="Técnico"><select value={convertForm.assigned_to} onChange={(event) => updateConvertField('assigned_to', event.target.value)}><option value="">Sin asignar</option>{technicians.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.nombre || member.profiles?.email || member.user_id}</option>)}</select></FormField>
            <FormField label="Fecha prevista"><input type="datetime-local" value={convertForm.fecha_prevista} onChange={(event) => updateConvertField('fecha_prevista', event.target.value)} /></FormField>
            <FormField label="Fecha límite"><input type="datetime-local" value={convertForm.fecha_limite} onChange={(event) => updateConvertField('fecha_limite', event.target.value)} /></FormField>
          </div>
          <FormField label="Instrucciones para técnico"><textarea rows="3" value={convertForm.instrucciones_tecnico} onChange={(event) => updateConvertField('instrucciones_tecnico', event.target.value)} /></FormField>
          <FormField label="Resultado esperado"><textarea rows="2" value={convertForm.resultado_esperado} onChange={(event) => updateConvertField('resultado_esperado', event.target.value)} /></FormField>
          <FormField label="Notas de revisión"><textarea rows="2" value={convertForm.notas_revision} onChange={(event) => updateConvertField('notas_revision', event.target.value)} /></FormField>
          <div className="permission-grid"><label className="checkbox-row"><input type="checkbox" checked={convertForm.requiere_materiales} onChange={(event) => updateConvertField('requiere_materiales', event.target.checked)} /><span>Requiere materiales</span></label><label className="checkbox-row"><input type="checkbox" checked={convertForm.requiere_firma_cliente} onChange={(event) => updateConvertField('requiere_firma_cliente', event.target.checked)} /><span>Requiere firma cliente</span></label></div>
          <div className="form-actions"><button className="ghost-button" type="button" onClick={() => setConvertOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Convirtiendo...' : 'Crear OT vinculada'}</button></div>
        </form>
      </Modal>
    </>
  );
}

function IncidentActions({ row, canManageWorkOrders, onReview, onConvert, onClose, onDiscard }) {
  if (row.estado === 'convertida_en_ot') return <Link className="secondary-button" to={`/ots/${row.ot_id}`}>Abrir OT</Link>;
  if (['cerrada', 'descartada'].includes(row.estado)) return <span className={`badge ${row.estado === 'cerrada' ? 'ok' : 'danger'}`}>{INCIDENT_STATUS_LABELS[row.estado]}</span>;
  return (
    <div className="quick-actions">
      {row.estado === 'abierta' && <button className="secondary-button" type="button" onClick={() => onReview(row)}><RefreshCw size={16} /> Revisar</button>}
      {canManageWorkOrders && <button className="primary-button" type="button" onClick={() => onConvert(row)}><Wrench size={16} /> Convertir en OT</button>}
      <button className="ghost-button" type="button" onClick={() => onClose(row)}><ClipboardCheck size={16} /> Cerrar</button>
      <button className="danger-button" type="button" onClick={() => onDiscard(row)}><XCircle size={16} /> Descartar</button>
    </div>
  );
}
