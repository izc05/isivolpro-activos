import { Search, Building2, Home, Pencil, Archive, RotateCcw, Image as ImageIcon, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../hooks/useTenant';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/Layout/Modal';
import FormField from '../components/Forms/FormField';
import { archiveTenant, createTenantAsOwner, listAllTenantsForManagement, listTenantInventoryStats, restoreTenant, updateTenant } from '../services/tenantService';
import { useAuth } from '../hooks/useAuth';

export default function Clients() {
  const navigate = useNavigate();
  const { activeTenantId, installations, refreshTenants, setActiveTenantId, setActiveInstallationId } = useTenant();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.global_role === 'super_admin';
  const emptyForm = {
    id: null,
    nombre: '',
    cif: '',
    direccion: '',
    telefono: '',
    email: '',
    estado: 'activo',
    plan: 'starter',
    billing_status: 'trial',
    max_instalaciones: 5,
    max_activos: 100,
    max_storage_mb: 1024,
    subscription_ends_at: '',
    logo_data_url: ''
  };
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('activos');
  const [statsByTenant, setStatsByTenant] = useState({});

  async function refreshClients() {
    setLoading(true);
    try {
      const items = await listAllTenantsForManagement();
      setTenants(items);
      setStatsByTenant(await listTenantInventoryStats(items.map((item) => item.id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshClients();
  }, []);

  const filteredTenants = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesSearch = !search || [tenant.nombre, tenant.cif, tenant.email, tenant.telefono, tenant.direccion].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
      const matchesStatus = statusFilter === 'todos' || (statusFilter === 'activos' ? tenant.estado !== 'inactivo' : tenant.estado === 'inactivo');
      return matchesSearch && matchesStatus;
    });
  }, [tenants, query, statusFilter]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setForm(emptyForm);
    setEditing(false);
    setError('');
    setMessage('');
    setOpen(true);
  }

  function startEdit(row) {
    setForm({
      id: row.id,
      nombre: row.nombre || '',
      cif: row.cif || '',
      direccion: row.direccion || '',
      telefono: row.telefono || '',
      email: row.email || '',
      estado: row.estado || 'activo',
      plan: row.plan || 'starter',
      billing_status: row.billing_status || 'trial',
      max_instalaciones: row.max_instalaciones || 5,
      max_activos: row.max_activos || 100,
      max_storage_mb: row.max_storage_mb || 1024,
      subscription_ends_at: row.subscription_ends_at ? row.subscription_ends_at.slice(0, 10) : '',
      logo_data_url: tenantLogo(row)
    });
    setEditing(true);
    setError('');
    setMessage('');
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editing) {
        await updateTenant(form);
        saveTenantLogo(form.id, form.logo_data_url);
        setMessage('Cliente actualizado correctamente.');
      } else {
        const tenantId = await createTenantAsOwner(form);
        saveTenantLogo(tenantId, form.logo_data_url);
        setActiveTenantId(tenantId);
        setMessage('Cliente creado correctamente.');
      }
      await refreshTenants();
      await refreshClients();
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function archiveClient(row) {
    if (!window.confirm(`Dar de baja el cliente "${row.nombre}"? No se elimina su historial; dejara de aparecer como cliente activo.`)) return;
    setError('');
    setMessage('');
    try {
      await archiveTenant(row);
      await refreshTenants();
      await refreshClients();
      setMessage(`Cliente ${row.nombre} dado de baja.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function restoreClient(row) {
    setError('');
    setMessage('');
    try {
      await restoreTenant(row);
      await refreshTenants();
      await refreshClients();
      setMessage(`Cliente ${row.nombre} reactivado.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function openClient(row) {
    setActiveTenantId(row.id);
    const firstInstallation = row.id === activeTenantId ? installations[0] : null;
    if (firstInstallation) setActiveInstallationId(firstInstallation.id);
    navigate('/instalaciones');
  }

  function clientInitials(name) {
    return String(name || 'C').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function tenantLogo(row) {
    if (!row?.id) return row?.image_data_url || '';
    return localStorage.getItem(`isivoltpro-client-logo-${row.id}`) || row.image_data_url || '';
  }

  function saveTenantLogo(tenantId, dataUrl) {
    if (!tenantId) return;
    const key = `isivoltpro-client-logo-${tenantId}`;
    if (dataUrl) localStorage.setItem(key, dataUrl);
    else localStorage.removeItem(key);
  }

  function changeLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen valida para el logo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateField('logo_data_url', String(reader.result || ''));
    reader.onerror = () => setError('No se pudo leer el logo seleccionado.');
    reader.readAsDataURL(file);
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle="Crea, edita y consulta clientes con logo, contacto y resumen de instalaciones." action={<button className="primary-button" onClick={startCreate}><Plus size={18} /> Nuevo cliente</button>} />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <section className="client-search-panel">
        <div className="client-search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente por nombre, CIF, email, telefono o direccion..." />
        </div>
        <div className="client-filter-tabs">
          <button className={statusFilter === 'activos' ? 'active' : ''} type="button" onClick={() => setStatusFilter('activos')}>Activos</button>
          <button className={statusFilter === 'inactivos' ? 'active' : ''} type="button" onClick={() => setStatusFilter('inactivos')}>Baja</button>
          <button className={statusFilter === 'todos' ? 'active' : ''} type="button" onClick={() => setStatusFilter('todos')}>Todos</button>
        </div>
      </section>

      {loading ? <p className="muted">Cargando clientes...</p> : (
        <section className="clients-grid-view">
          {filteredTenants.map((tenant) => (
            <article key={tenant.id} className={`client-main-card ${tenant.id === activeTenantId ? 'active' : ''}`}>
              <button className="client-card-main" type="button" onClick={() => openClient(tenant)}>
                <span className="client-avatar">
                  {tenantLogo(tenant)
                    ? <img src={tenantLogo(tenant)} alt={`Logo ${tenant.nombre}`} />
                    : <><Building2 size={22} /><strong>{clientInitials(tenant.nombre)}</strong></>}
                </span>
                <span className="client-card-content">
                  <strong>{tenant.nombre}</strong>
                  <small>{tenant.direccion || tenant.email || 'Sin direccion registrada'}</small>
                  <span className="client-contact-line">{[tenant.cif, tenant.telefono, tenant.email].filter(Boolean).join(' · ') || 'Datos de contacto pendientes'}</span>
                  <span className="client-card-meta">
                    <em>{tenant.estado || 'activo'}</em>
                    <em>{tenant.plan || 'starter'}</em>
                    <em>{tenant.billing_status || 'trial'}</em>
                  </span>
                  <span className="client-stats-line">
                    <b>{statsByTenant[tenant.id]?.instalaciones || 0}</b> instalaciones
                    <b>{statsByTenant[tenant.id]?.activos || 0}</b> activos
                    <b>{statsByTenant[tenant.id]?.incidencias_abiertas || 0}</b> incidencias abiertas
                  </span>
                </span>
              </button>
              <div className="client-card-actions">
                <button className="primary-button" type="button" onClick={() => openClient(tenant)}><Home size={16} /> Ver instalaciones</button>
                <button className="secondary-button" type="button" onClick={() => startEdit(tenant)}><Pencil size={16} /> Editar</button>
                {tenant.estado === 'inactivo'
                  ? <button className="secondary-button" type="button" onClick={() => restoreClient(tenant)}><RotateCcw size={16} /> Reactivar</button>
                  : <button className="danger-button" type="button" onClick={() => archiveClient(tenant)}><Archive size={16} /> Baja</button>}
              </div>
            </article>
          ))}
          {filteredTenants.length === 0 && <div className="card"><p className="muted">No hay clientes que coincidan con la busqueda.</p></div>}
        </section>
      )}

      <Modal title={editing ? 'Editar cliente' : 'Nuevo cliente'} open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          <div className="client-logo-editor">
            <span className="client-avatar large">
              {form.logo_data_url ? <img src={form.logo_data_url} alt="Logo del cliente" /> : <ImageIcon size={28} />}
            </span>
            <div>
              <strong>Logo del cliente</strong>
              <p className="muted">Añade un logotipo para presentaciones y fichas internas. Se guarda en este navegador sin cambiar la base de datos.</p>
              <div className="inline-actions">
                <label className="secondary-button">
                  <ImageIcon size={16} /> Seleccionar logo
                  <input className="hidden-file-input" type="file" accept="image/*" onChange={changeLogo} />
                </label>
                {form.logo_data_url && <button className="ghost-button" type="button" onClick={() => updateField('logo_data_url', '')}>Quitar logo</button>}
              </div>
            </div>
          </div>
          <FormField label="Nombre del cliente">
            <input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required />
          </FormField>
          <div className="grid two">
            <FormField label="CIF/NIF"><input value={form.cif} onChange={(event) => updateField('cif', event.target.value)} /></FormField>
            <FormField label="Telefono"><input value={form.telefono} onChange={(event) => updateField('telefono', event.target.value)} /></FormField>
          </div>
          <FormField label="Email"><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} /></FormField>
          <FormField label="Direccion"><input value={form.direccion} onChange={(event) => updateField('direccion', event.target.value)} /></FormField>
          {editing && (
            <FormField label="Estado">
              <select value={form.estado} onChange={(event) => updateField('estado', event.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </FormField>
          )}
          <div className="card subtle-card">
            <h3>Cuenta comercial del cliente</h3>
            <p className="muted">Estos datos preparan el modelo de pago por cliente. Dar de baja el cliente lo oculta del selector superior pero conserva sus datos.</p>
            <div className="grid two">
              <FormField label="Plan"><select value={form.plan} onChange={(event) => updateField('plan', event.target.value)} disabled={!isSuperAdmin}><option value="starter">Starter</option><option value="pro">Pro</option><option value="empresa">Empresa</option></select></FormField>
              <FormField label="Estado suscripcion"><select value={form.billing_status} onChange={(event) => updateField('billing_status', event.target.value)} disabled={!isSuperAdmin}><option value="trial">Prueba</option><option value="active">Activa</option><option value="past_due">Pago pendiente</option><option value="cancelled">Cancelada</option><option value="suspended">Suspendida</option></select></FormField>
            </div>
            <div className="grid two">
              <FormField label="Max instalaciones"><input type="number" min="1" value={form.max_instalaciones} onChange={(event) => updateField('max_instalaciones', event.target.value)} disabled={!isSuperAdmin} /></FormField>
              <FormField label="Max activos"><input type="number" min="1" value={form.max_activos} onChange={(event) => updateField('max_activos', event.target.value)} disabled={!isSuperAdmin} /></FormField>
            </div>
            <div className="grid two">
              <FormField label="Storage MB"><input type="number" min="100" value={form.max_storage_mb} onChange={(event) => updateField('max_storage_mb', event.target.value)} disabled={!isSuperAdmin} /></FormField>
              <FormField label="Fin suscripcion"><input type="date" value={form.subscription_ends_at} onChange={(event) => updateField('subscription_ends_at', event.target.value)} disabled={!isSuperAdmin} /></FormField>
            </div>
          </div>
          <p className="muted">Al crear un cliente se crea un tenant dentro de IsiVoltPro. No se crea un Supabase nuevo; la separacion real la hacen tenant_id, RLS y Storage privado.</p>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">{editing ? 'Guardar cambios' : 'Crear cliente'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
