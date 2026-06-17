import { useEffect, useState } from 'react';
import { useTenant } from '../hooks/useTenant';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import Modal from '../components/Layout/Modal';
import FormField from '../components/Forms/FormField';
import { archiveTenant, createTenantAsOwner, listAllTenantsForManagement, restoreTenant, updateTenant } from '../services/tenantService';
import { useAuth } from '../hooks/useAuth';

export default function Clients() {
  const { refreshTenants, setActiveTenantId } = useTenant();
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
    subscription_ends_at: ''
  };
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function refreshClients() {
    setLoading(true);
    try {
      const items = await listAllTenantsForManagement();
      setTenants(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshClients();
  }, []);

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
      subscription_ends_at: row.subscription_ends_at ? row.subscription_ends_at.slice(0, 10) : ''
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
        setMessage('Cliente actualizado correctamente.');
      } else {
        const tenantId = await createTenantAsOwner(form);
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

  return (
    <>
      <PageHeader title="Clientes" subtitle="Un cliente puede tener varias instalaciones. Dar de baja no borra historico ni datos tecnicos." action={<button className="primary-button" onClick={startCreate}>Nuevo cliente</button>} />
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
      {loading ? <p className="muted">Cargando clientes...</p> : (
        <DataTable columns={[
          { key: 'nombre', label: 'Cliente' },
          { key: 'cif', label: 'CIF' },
          { key: 'email', label: 'Email' },
          { key: 'plan', label: 'Plan', render: (row) => <span className="badge">{row.plan || 'starter'}</span> },
          { key: 'billing_status', label: 'Suscripcion', render: (row) => <span className={row.billing_status === 'active' ? 'badge ok' : row.billing_status === 'suspended' ? 'badge danger' : 'badge warn'}>{row.billing_status || 'trial'}</span> },
          { key: 'estado', label: 'Estado', render: (row) => <span className={row.estado === 'activo' ? 'badge ok' : 'badge danger'}>{row.estado}</span> },
          { key: 'actions', label: 'Acciones', render: (row) => <div className="inline-actions"><button className="secondary-button" onClick={() => startEdit(row)}>Editar</button>{row.estado === 'inactivo' ? <button className="primary-button" onClick={() => restoreClient(row)}>Reactivar</button> : <button className="danger-button" onClick={() => archiveClient(row)}>Baja</button>}</div> }
        ]} rows={tenants} />
      )}
      <Modal title={editing ? 'Editar cliente' : 'Nuevo cliente'} open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
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
