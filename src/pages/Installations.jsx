import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenantRows } from '../hooks/useTenantRows';
import { useTenant } from '../hooks/useTenant';
import { createInstallation, softDeleteEntity, updateInstallation } from '../services/entityService';
import EntityImageViewer from '../components/Media/EntityImageViewer';
import { buildMapsUrl } from '../utils/mapUtils';
import { fvInstallationRisk, isFvInstallation, sortFvInstallations, summarizeFvInstallation } from '../services/installationFvService';

export default function Installations() {
  const { tenants, activeTenantId, setActiveTenantId } = useTenant();
  const { rows, refresh } = useTenantRows('instalaciones', '*, tenants(nombre)', { order: 'created_at' });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,instalacion_id,nombre,tipo,planta,zona', { order: 'created_at' });
  const { rows: assets } = useTenantRows('activos', 'id,instalacion_id,nombre,tipo,marca,modelo,referencia,estado,criticidad,fecha_proxima_revision,observaciones', { order: 'created_at' });
  const { rows: workOrders } = useTenantRows('ordenes_trabajo', 'id,instalacion_id,titulo,estado,prioridad,fecha_prevista,fecha_limite', { order: 'created_at' });
  const { rows: plans } = useTenantRows('planes_mantenimiento', 'id,instalacion_id,nombre,activo,fecha_proxima_realizacion', { order: 'fecha_proxima_realizacion' });
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('todas');
  const emptyForm = { tenant_id: activeTenantId || '', nombre: '', codigo: '', tipo: '', direccion: '', latitud: '', longitud: '', maps_url: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', descripcion: '', image_file: null };
  const [form, setForm] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);
  const [error, setError] = useState('');

  const enrichedRows = useMemo(() => rows.map((row) => {
    const fvSummary = summarizeFvInstallation(row, assets, locations, workOrders, plans);
    return { ...row, fvSummary };
  }), [rows, assets, locations, workOrders, plans]);

  const visibleRows = useMemo(() => {
    const filtered = enrichedRows.filter((row) => {
      if (filter === 'fv') return row.fvSummary.isFv;
      if (filter === 'fv_riesgo') return row.fvSummary.isFv && (row.fvSummary.duePlans > 0 || row.fvSummary.pendingAssets > 0 || row.fvSummary.validationOrders > 0);
      if (filter === 'fv_ot') return row.fvSummary.isFv && row.fvSummary.openOrders > 0;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.fvSummary.isFv || b.fvSummary.isFv) return sortFvInstallations(a, b);
      return 0;
    });
  }, [enrichedRows, filter]);

  const fvSummary = useMemo(() => {
    const fvRows = enrichedRows.filter((row) => row.fvSummary.isFv);
    return {
      installations: fvRows.length,
      assets: fvRows.reduce((sum, row) => sum + row.fvSummary.fvAssets, 0),
      openOrders: fvRows.reduce((sum, row) => sum + row.fvSummary.openOrders, 0),
      validationOrders: fvRows.reduce((sum, row) => sum + row.fvSummary.validationOrders, 0),
      duePlans: fvRows.reduce((sum, row) => sum + row.fvSummary.duePlans, 0),
      criticalAssets: fvRows.reduce((sum, row) => sum + row.fvSummary.criticalAssets, 0)
    };
  }, [enrichedRows]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    try {
      if (editingRow) {
        await updateInstallation(editingRow, form);
      } else {
        await createInstallation(form.tenant_id || activeTenantId, form);
        if (form.tenant_id && form.tenant_id !== activeTenantId) {
          setActiveTenantId(form.tenant_id);
        }
      }
      setForm(emptyForm);
      setEditingRow(null);
      formElement.reset();
      setOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Dar de baja la instalacion "${row.nombre}"?`)) return;
    await softDeleteEntity({ table: 'instalaciones', tenantId: row.tenant_id, id: row.id, entityType: 'instalacion', auditAction: 'delete_installation' });
    refresh();
  }

  function startCreate() {
    setEditingRow(null);
    setForm({ ...emptyForm, tenant_id: activeTenantId || tenants[0]?.id || '' });
    setError('');
    setOpen(true);
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm({
      nombre: row.nombre || '',
      tenant_id: row.tenant_id || activeTenantId || '',
      codigo: row.codigo || '',
      tipo: row.tipo || '',
      direccion: row.direccion || '',
      latitud: row.latitud || '',
      longitud: row.longitud || '',
      maps_url: row.maps_url || '',
      contacto_nombre: row.contacto_nombre || '',
      contacto_telefono: row.contacto_telefono || '',
      contacto_email: row.contacto_email || '',
      descripcion: row.descripcion || '',
      image_file: null
    });
    setError('');
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingRow(null);
    setForm(emptyForm);
    setError('');
  }

  function installationName(row) {
    const risk = fvInstallationRisk(row.fvSummary);
    return (
      <div className="installation-text-cell">
        <Link to={`/instalaciones/${row.id}`}><strong>{row.nombre}</strong></Link>
        <span>{row.direccion || row.tipo || 'Sin direccion'}</span>
        {row.fvSummary.isFv && <small className={`badge ${risk.tone}`}>FV · {risk.label}</small>}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Instalaciones" subtitle="Cada instalacion queda vinculada obligatoriamente a un cliente." action={<button className="primary-button" onClick={startCreate}>Nueva instalacion</button>} />

      <div className="grid metrics ot-metrics">
        <section className="metric-card"><small>Instalaciones FV</small><strong>{fvSummary.installations}</strong></section>
        <section className="metric-card"><small>Activos FV</small><strong>{fvSummary.assets}</strong></section>
        <section className="metric-card warn"><small>OT FV abiertas</small><strong>{fvSummary.openOrders}</strong></section>
        <section className="metric-card warn"><small>Pendiente validar</small><strong>{fvSummary.validationOrders}</strong></section>
        <section className="metric-card danger"><small>Preventivos vencidos</small><strong>{fvSummary.duePlans}</strong></section>
        <section className="metric-card ok"><small>Activos criticos FV</small><strong>{fvSummary.criticalAssets}</strong></section>
      </div>

      <div className="quick-actions user-filter-actions">
        <button className={filter === 'todas' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('todas')}>Todas</button>
        <button className={filter === 'fv' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('fv')}>Solo FV</button>
        <button className={filter === 'fv_riesgo' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('fv_riesgo')}>FV con riesgo</button>
        <button className={filter === 'fv_ot' ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setFilter('fv_ot')}>FV con OT abiertas</button>
      </div>

      <DataTable columns={[
        { key: 'foto', label: 'Foto', render: (row) => <EntityImageViewer row={row} entityType="instalacion" title={row.nombre} className="installation-main-photo" /> },
        { key: 'nombre', label: 'Nombre', render: installationName },
        { key: 'cliente', label: 'Cliente', render: (row) => row.tenants?.nombre || tenants.find((tenant) => tenant.id === row.tenant_id)?.nombre || row.tenant_id },
        { key: 'codigo', label: 'Codigo' },
        { key: 'tipo', label: 'Tipo', render: (row) => <span className={`badge ${isFvInstallation(row) ? 'ok' : ''}`}>{row.tipo || '-'}</span> },
        { key: 'fv', label: 'FV', render: (row) => row.fvSummary.isFv ? <span className="badge ok">{row.fvSummary.fvAssets} activos · {row.fvSummary.openOrders} OT</span> : <span className="muted">-</span> },
        { key: 'mapa', label: 'Mapa', render: (row) => buildMapsUrl(row) ? <a className="secondary-button table-action action-map" href={buildMapsUrl(row)} target="_blank" rel="noreferrer">Abrir mapa</a> : <span className="muted">Sin mapa</span> },
        { key: 'estado', label: 'Estado', render: (row) => <span className="badge ok">{row.estado}</span> },
        {
          key: 'actions',
          label: 'Acciones',
          render: (row) => (
            <div className="inline-actions">
              <Link className="secondary-button table-action" to={`/instalaciones/${row.id}`}>Abrir</Link>
              <button className="secondary-button table-action action-edit" onClick={() => startEdit(row)}>Editar</button>
              <button className="danger-button table-action action-delete" onClick={() => remove(row)}>Baja</button>
            </div>
          )
        }
      ]} rows={visibleRows} />
      <Modal title={editingRow ? 'Editar instalacion' : 'Nueva instalacion'} open={open} onClose={closeModal}>
        <form className="form-grid" onSubmit={submit}>
          <FormField label="Cliente">
            <select value={form.tenant_id} onChange={(event) => updateField('tenant_id', event.target.value)} required disabled={Boolean(editingRow)}>
              <option value="">Selecciona cliente</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nombre}</option>)}
            </select>
          </FormField>
          {editingRow && <p className="muted">Para mover una instalacion a otro cliente conviene hacerlo como accion administrativa separada para no mezclar ubicaciones, activos, documentos y auditoria.</p>}
          <FormField label="Nombre"><input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required /></FormField>
          <FormField label="Codigo"><input value={form.codigo} onChange={(event) => updateField('codigo', event.target.value)} /></FormField>
          <FormField label="Tipo"><input value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)} placeholder="Garaje, sala tecnica, fotovoltaica..." /></FormField>
          <FormField label="Direccion"><input value={form.direccion} onChange={(event) => updateField('direccion', event.target.value)} /></FormField>
          <div className="grid two">
            <FormField label="Latitud"><input type="number" step="any" value={form.latitud} onChange={(event) => updateField('latitud', event.target.value)} placeholder="40.416775" /></FormField>
            <FormField label="Longitud"><input type="number" step="any" value={form.longitud} onChange={(event) => updateField('longitud', event.target.value)} placeholder="-3.703790" /></FormField>
          </div>
          <FormField label="Enlace Google Maps opcional"><input value={form.maps_url} onChange={(event) => updateField('maps_url', event.target.value)} placeholder="https://maps.google.com/..." /></FormField>
          <div className="grid two">
            <FormField label="Contacto"><input value={form.contacto_nombre} onChange={(event) => updateField('contacto_nombre', event.target.value)} /></FormField>
            <FormField label="Telefono"><input value={form.contacto_telefono} onChange={(event) => updateField('contacto_telefono', event.target.value)} /></FormField>
          </div>
          <FormField label="Email contacto"><input type="email" value={form.contacto_email} onChange={(event) => updateField('contacto_email', event.target.value)} /></FormField>
          <FormField label="Descripcion"><textarea rows="3" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
          <FormField label="Logo o imagen de la instalacion">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateField('image_file', event.target.files?.[0] || null)} />
          </FormField>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={closeModal}>Cancelar</button>
            <button className="primary-button" type="submit">{editingRow ? 'Guardar cambios' : 'Crear instalacion'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
