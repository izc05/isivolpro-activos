import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { formatDate } from '../utils/dateUtils';
import { createAsset, softDeleteEntity, updateAsset } from '../services/entityService';
import { usePermissions } from '../hooks/usePermissions';
import EntityIdentity from '../components/Cards/EntityIdentity';
import { FV_ASSET_TYPE_LABELS, fvAssetRisk, fvAssetType, fvAssetTypeLabel, isFvAsset, sortFvAssets, summarizeFvAssets } from '../services/assetFvService';

const QUICK_FV_ASSETS = [
  { label: 'Inversor FV', tipo: 'inversor_fotovoltaico', criticidad: 'alta' },
  { label: 'Campo FV / strings', tipo: 'campo_fotovoltaico', criticidad: 'alta' },
  { label: 'Cuadro DC FV', tipo: 'cuadro_dc_fv', criticidad: 'alta' },
  { label: 'Cuadro AC FV', tipo: 'cuadro_ac_fv', criticidad: 'alta' },
  { label: 'Contador / vertido cero', tipo: 'contador_fv', criticidad: 'media' },
  { label: 'Seccionador bomberos FV', tipo: 'seguridad_fv', criticidad: 'alta' }
];

export default function Assets() {
  const { activeInstallationId, activeInstallation } = useTenant();
  const { rows, activeTenantId, refresh } = useTenantRows('activos', '*, instalaciones(nombre), ubicaciones(nombre)', { order: 'created_at' });
  const { rows: installations } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: workOrders } = useTenantRows('ordenes_trabajo', 'id,activo_id,estado,prioridad,fecha_prevista,fecha_limite', { order: 'created_at' });
  const { rows: plans } = useTenantRows('planes_mantenimiento', 'id,activo_id,activo,fecha_proxima_realizacion', { order: 'fecha_proxima_realizacion' });
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [error, setError] = useState('');
  const emptyForm = {
    instalacion_id: activeInstallationId || '',
    ubicacion_id: '',
    nombre: '',
    tipo: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    referencia: '',
    estado: 'correcto',
    criticidad: 'media',
    fecha_instalacion: '',
    fecha_ultima_revision: '',
    fecha_proxima_revision: '',
    observaciones: '',
    image_file: null
  };
  const [form, setForm] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const permissions = usePermissions(activeTenantId);

  useEffect(() => {
    permissions.canManageTenant().then(setCanManage).catch(() => setCanManage(false));
  }, [permissions]);

  const scopedRows = useMemo(
    () => activeInstallationId ? rows.filter((row) => row.instalacion_id === activeInstallationId) : rows,
    [rows, activeInstallationId]
  );

  const visibleRows = useMemo(() => {
    const filtered = scopedRows.filter((row) => {
      if (filter === 'fv') return isFvAsset(row);
      if (filter === 'riesgo') return isFvAsset(row) && ['danger', 'warn'].includes(fvAssetRisk(row, workOrders, plans).tone);
      if (filter === 'criticos') return isFvAsset(row) && ['alta', 'critica'].includes(row.criticidad);
      if (filter.startsWith('tipo:')) return isFvAsset(row) && fvAssetType(row) === filter.replace('tipo:', '');
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (isFvAsset(a) || isFvAsset(b)) return sortFvAssets(a, b, workOrders, plans);
      return 0;
    });
  }, [scopedRows, filter, workOrders, plans]);

  const fvSummary = useMemo(() => summarizeFvAssets(scopedRows, workOrders, plans), [scopedRows, workOrders, plans]);

  const visibleInstallations = useMemo(
    () => activeInstallationId ? installations.filter((item) => item.id === activeInstallationId) : installations,
    [installations, activeInstallationId]
  );

  const filteredLocations = useMemo(
    () => locations.filter((location) => !form.instalacion_id || location.instalacion_id === form.instalacion_id),
    [locations, form.instalacion_id]
  );

  function buildEmptyForm() {
    return { ...emptyForm, instalacion_id: activeInstallationId || '' };
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'instalacion_id') next.ubicacion_id = '';
      return next;
    });
  }

  function applyQuickFvAsset(template) {
    setForm((current) => ({
      ...current,
      tipo: template.tipo,
      criticidad: template.criticidad,
      nombre: current.nombre || template.label,
      referencia: current.referencia || template.tipo.toUpperCase(),
      observaciones: current.observaciones || `Ficha técnica FV: ${template.label}. Registrar potencia, strings, protecciones, comunicaciones y próximas revisiones.`
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (editingRow) {
        await updateAsset(editingRow, form);
      } else {
        await createAsset(activeTenantId, form);
      }
      setForm(buildEmptyForm());
      setEditingRow(null);
      formElement.reset();
      setOpen(false);
      refresh();
      setSuccess(editingRow ? 'Activo actualizado correctamente.' : 'Activo creado correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja el activo "${row.nombre}"?`)) return;
    await softDeleteEntity({ table: 'activos', tenantId: row.tenant_id, id: row.id, entityType: 'activo', auditAction: 'delete_asset' });
    refresh();
  }

  function startCreate() {
    setEditingRow(null);
    setForm(buildEmptyForm());
    setError('');
    setSuccess('');
    setOpen(true);
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm({
      instalacion_id: row.instalacion_id || activeInstallationId || '',
      ubicacion_id: row.ubicacion_id || '',
      nombre: row.nombre || '',
      tipo: row.tipo || '',
      marca: row.marca || '',
      modelo: row.modelo || '',
      numero_serie: row.numero_serie || '',
      referencia: row.referencia || '',
      estado: row.estado || 'correcto',
      criticidad: row.criticidad || 'media',
      fecha_instalacion: row.fecha_instalacion || '',
      fecha_ultima_revision: row.fecha_ultima_revision || '',
      fecha_proxima_revision: row.fecha_proxima_revision || '',
      observaciones: row.observaciones || '',
      image_file: null
    });
    setError('');
    setSuccess('');
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setEditingRow(null);
    setForm(buildEmptyForm());
    setError('');
  }

  return (
    <>
      <PageHeader
        title="Activos/equipos"
        subtitle={activeInstallation ? `Mostrando solo activos de ${activeInstallation.nombre}.` : 'Ficha tecnica, estado, revisiones, documentos y QR por activo.'}
        action={canManage ? <button className="primary-button" onClick={startCreate}>Nuevo activo</button> : null}
      />
      {activeInstallation && <p className="active-filter-note">Filtro activo: {activeInstallation.nombre}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="grid metrics ot-metrics">
        <section className="metric-card"><small>Equipos FV</small><strong>{fvSummary.total}</strong></section>
        <section className="metric-card"><small>Inversores</small><strong>{fvSummary.inverters}</strong></section>
        <section className="metric-card"><small>Campos / strings</small><strong>{fvSummary.fields}</strong></section>
        <section className="metric-card"><small>Cuadros DC</small><strong>{fvSummary.dcBoards}</strong></section>
        <section className="metric-card warn"><small>FV con riesgo</small><strong>{fvSummary.risk}</strong></section>
        <section className="metric-card ok"><small>Críticos FV</small><strong>{fvSummary.critical}</strong></section>
      </div>

      <div className="quick-actions user-filter-actions">
        <button className={filter === 'todos' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('todos')}>Todos</button>
        <button className={filter === 'fv' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('fv')}>Solo FV</button>
        <button className={filter === 'riesgo' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('riesgo')}>FV con riesgo</button>
        <button className={filter === 'criticos' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('criticos')}>Críticos FV</button>
        {Object.entries(FV_ASSET_TYPE_LABELS).map(([key, label]) => <button key={key} className={filter === `tipo:${key}` ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter(`tipo:${key}`)}>{label}</button>)}
      </div>

      <DataTable columns={[
        { key: 'nombre', label: 'Activo', render: (row) => <Link to={`/activos/${row.id}`}><EntityIdentity row={row} entityType="activo" title={row.nombre} subtitle={isFvAsset(row) ? fvAssetTypeLabel(row) : row.tipo || row.modelo} /></Link> },
        { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
        { key: 'ubicacion', label: 'Ubicacion', render: (row) => row.ubicaciones?.nombre || '-' },
        { key: 'tipo', label: 'Tipo', render: (row) => isFvAsset(row) ? <span className="badge ok">{fvAssetTypeLabel(row)}</span> : row.tipo },
        { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.estado === 'correcto' ? 'ok' : 'warn'}`}>{row.estado}</span> },
        { key: 'criticidad', label: 'Criticidad' },
        { key: 'fv_riesgo', label: 'Riesgo FV', render: (row) => isFvAsset(row) ? <span className={`badge ${fvAssetRisk(row, workOrders, plans).tone}`}>{fvAssetRisk(row, workOrders, plans).label}</span> : <span className="muted">-</span> },
        { key: 'fecha_proxima_revision', label: 'Proxima revision', render: (row) => formatDate(row.fecha_proxima_revision) },
        { key: 'actions', label: 'Acciones', render: (row) => canManage ? (
          <div className="inline-actions">
            <Link className="secondary-button" to={`/activos/${row.id}`}>Abrir</Link>
            <button className="secondary-button" onClick={() => startEdit(row)}>Editar</button>
            <button className="danger-button" onClick={() => remove(row)}>Baja</button>
          </div>
        ) : <span className="muted">Solo lectura</span> }
      ]} rows={visibleRows} empty="Sin activos para la instalación activa" />
      <Modal title={editingRow ? 'Editar activo' : 'Nuevo activo'} open={open} onClose={closeModal}>
        <form className="form-grid" onSubmit={submit}>
          {!editingRow && <div className="quick-actions user-filter-actions">{QUICK_FV_ASSETS.map((template) => <button key={template.tipo} className="secondary-button" type="button" onClick={() => applyQuickFvAsset(template)}>{template.label}</button>)}</div>}
          <FormField label="Instalacion">
            <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required disabled={Boolean(activeInstallationId && !editingRow)}>
              <option value="">Seleccionar</option>
              {visibleInstallations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Ubicacion">
            <select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}>
              <option value="">Sin ubicacion</option>
              {filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Nombre"><input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required /></FormField>
          <div className="grid two">
            <FormField label="Tipo"><input value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} /></FormField>
            <FormField label="Criticidad">
              <select value={form.criticidad} onChange={(event) => updateField('criticidad', event.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Critica</option>
              </select>
            </FormField>
          </div>
          <div className="grid two">
            <FormField label="Marca"><input value={form.marca} onChange={(event) => updateField('marca', event.target.value)} /></FormField>
            <FormField label="Modelo"><input value={form.modelo} onChange={(event) => updateField('modelo', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Numero de serie"><input value={form.numero_serie} onChange={(event) => updateField('numero_serie', event.target.value)} /></FormField>
            <FormField label="Referencia"><input value={form.referencia} onChange={(event) => updateField('referencia', event.target.value)} /></FormField>
          </div>
          <div className="grid two">
            <FormField label="Estado">
              <select value={form.estado} onChange={(event) => updateField('estado', event.target.value)}>
                <option value="correcto">Correcto</option>
                <option value="pendiente">Pendiente</option>
                <option value="averiado">Averiado</option>
                <option value="fuera_servicio">Fuera de servicio</option>
              </select>
            </FormField>
            <FormField label="Proxima revision"><input type="date" value={form.fecha_proxima_revision} onChange={(event) => updateField('fecha_proxima_revision', event.target.value)} /></FormField>
          </div>
          <FormField label="Observaciones"><textarea rows="3" value={form.observaciones} onChange={(event) => updateField('observaciones', event.target.value)} placeholder="Potencia kWp/kW, nº strings, protecciones DC/AC, comunicaciones, vertido cero, estado de producción..." /></FormField>
          <FormField label="Foto del activo">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateField('image_file', event.target.files?.[0] || null)} disabled={saving} />
          </FormField>
          {saving && <p className="muted">Guardando activo y subiendo imagen. No cierres esta ventana.</p>}
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingRow ? 'Guardar cambios' : 'Crear activo'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
