import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Filter, KeyRound, Mail, Search, ShieldCheck, UserPlus, Users, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import { useTenant } from '../hooks/useTenant';
import { useAuth } from '../hooks/useAuth';
import { listTenantMembers } from '../services/tenantService';
import { listInstallationsForTenant } from '../services/entityService';
import {
  activateTenantMember,
  createInstallationAccessGrant,
  createTenantInvitation,
  deactivateTenantMember,
  listInstallationAccessGrants,
  listTenantInvitations,
  revokeInstallationAccessGrant,
  revokeInvitation,
  setMemberMfaRequired,
  updateTenantMember
} from '../services/permissionService';
import '../styles/userModule.css';

const TENANT_ROLES = ['admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'];
const ROLE_LABELS = {
  admin_cliente: 'Administrador',
  tecnico: 'Tecnico propio',
  tecnico_externo: 'Tecnico externo',
  cliente_lectura: 'Cliente lectura'
};
const USER_TEMPLATES = [
  { label: 'Tecnico propio', role: 'tecnico', mfaRequired: false, help: 'Para personal interno. Se podra asignar a OT de cualquier instalacion.' },
  { label: 'Tecnico externo', role: 'tecnico_externo', mfaRequired: false, help: 'Para trabajos puntuales. Recomendado limitar por OT o instalacion.' },
  { label: 'Cliente lectura', role: 'cliente_lectura', mfaRequired: false, help: 'Para clientes que solo consultan inventario/documentos.' },
  { label: 'Administrador', role: 'admin_cliente', mfaRequired: true, help: 'Para responsable del cliente. Recomendado con MFA.' }
];
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const plusHoursLocal = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function buildInvitationUrl(invitation) {
  if (!invitation?.invitation_token) return '';
  const params = new URLSearchParams({ token: invitation.invitation_token, email: invitation.email || '' });
  return `${window.location.origin}${window.location.pathname}#/registro?${params.toString()}`;
}

function accessStatus(row) {
  if (row.estado !== 'activo') return 'revocado';
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return 'caducado';
  if (row.starts_at && new Date(row.starts_at) > new Date()) return 'programado';
  return 'activo';
}

function memberName(row) {
  return row.profiles?.nombre || row.profiles?.email || row.user_id;
}

export default function UsersPermissions() {
  const { user } = useAuth();
  const { activeTenant, activeTenantId, activeRole } = useTenant();
  const [rows, setRows] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [accessGrants, setAccessGrants] = useState([]);
  const [open, setOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', role: 'tecnico', mfaRequired: false });
  const [accessForm, setAccessForm] = useState({
    userId: '',
    instalacionId: '',
    permanent: false,
    startsAt: nowLocal(),
    expiresAt: plusHoursLocal(8),
    canCreateIncident: true,
    canUploadMedia: false,
    canDownloadFiles: false,
    canEditData: false
  });
  const [filters, setFilters] = useState({ search: '', role: 'todos', status: 'todos', mode: 'todos' });
  const [message, setMessage] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [loadMessage, setLoadMessage] = useState('');
  const [lastInvitation, setLastInvitation] = useState(null);
  const [memberMessage, setMemberMessage] = useState('');
  const [memberError, setMemberError] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState('');

  const pendingInvitations = invitations.filter((invitation) => invitation.estado === 'pendiente');
  const activeMembers = rows.filter((member) => member.estado === 'activo');
  const ownTechnicians = rows.filter((member) => member.role === 'tecnico' && member.estado === 'activo');
  const externalTechnicians = rows.filter((member) => member.role === 'tecnico_externo' && member.estado === 'activo');
  const assignableMembers = useMemo(
    () => rows.filter((member) => member.estado === 'activo' && ['admin_cliente', 'tecnico', 'tecnico_externo'].includes(member.role)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = `${row.profiles?.nombre || ''} ${row.profiles?.email || ''} ${row.user_id || ''}`.toLowerCase();
      const matchText = !text || searchable.includes(text);
      const matchRole = filters.role === 'todos' || row.role === filters.role;
      const matchStatus = filters.status === 'todos' || row.estado === filters.status;
      const matchMode = filters.mode === 'todos'
        || (filters.mode === 'tecnicos' && ['tecnico', 'tecnico_externo'].includes(row.role))
        || (filters.mode === 'clientes' && row.role === 'cliente_lectura')
        || (filters.mode === 'admins' && row.role === 'admin_cliente');
      return matchText && matchRole && matchStatus && matchMode;
    });
  }, [rows, filters]);

  const technicianRows = useMemo(
    () => filteredRows.filter((row) => ['tecnico', 'tecnico_externo'].includes(row.role)),
    [filteredRows]
  );

  async function refresh() {
    if (!activeTenantId) return;
    setLoadMessage('');
    const results = await Promise.allSettled([
      listTenantMembers(activeTenantId),
      listTenantInvitations(activeTenantId),
      listInstallationsForTenant(activeTenantId),
      listInstallationAccessGrants(activeTenantId)
    ]);
    const [membersResult, invitationsResult, installationsResult, grantsResult] = results;
    const loadErrors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason?.message || 'Error cargando datos');
    const members = membersResult.status === 'fulfilled' ? membersResult.value : [];
    const tenantInvitations = invitationsResult.status === 'fulfilled' ? invitationsResult.value : [];
    const tenantInstallations = installationsResult.status === 'fulfilled' ? installationsResult.value : [];
    const grants = grantsResult.status === 'fulfilled' ? grantsResult.value : [];

    setRows(members);
    setInvitations(tenantInvitations);
    setInstallations(tenantInstallations);
    setAccessGrants(grants);
    if (loadErrors.length > 0) setLoadMessage(loadErrors.join(' | '));
    setAccessForm((current) => ({
      ...current,
      userId: current.userId || members.find((member) => member.role !== 'admin_cliente' && member.estado === 'activo')?.user_id || members[0]?.user_id || '',
      instalacionId: current.instalacionId || tenantInstallations[0]?.id || ''
    }));
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [activeTenantId]);

  function applyTemplate(template) {
    setForm((current) => ({ ...current, role: template.role, mfaRequired: template.mfaRequired }));
  }

  function clearFilters() {
    setFilters({ search: '', role: 'todos', status: 'todos', mode: 'todos' });
  }

  async function submitInvitation(event) {
    event.preventDefault();
    setMessage('');
    setCopyMessage('');
    setLastInvitation(null);
    try {
      const invitation = await createTenantInvitation({ tenantId: activeTenantId, ...form });
      setLastInvitation(invitation);
      setForm({ nombre: '', email: '', role: 'tecnico', mfaRequired: false });
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitAccessGrant(event) {
    event.preventDefault();
    setAccessMessage('');
    try {
      await createInstallationAccessGrant({
        tenantId: activeTenantId,
        userId: accessForm.userId,
        instalacionId: accessForm.instalacionId,
        role: accessForm.permanent ? 'tecnico_permanente' : 'tecnico_temporal',
        startsAt: accessForm.startsAt ? new Date(accessForm.startsAt).toISOString() : new Date().toISOString(),
        expiresAt: accessForm.permanent || !accessForm.expiresAt ? null : new Date(accessForm.expiresAt).toISOString(),
        canCreateIncident: accessForm.canCreateIncident,
        canUploadMedia: accessForm.canUploadMedia,
        canDownloadFiles: accessForm.canDownloadFiles,
        canEditData: accessForm.canEditData
      });
      setAccessOpen(false);
      setAccessForm((current) => ({
        ...current,
        permanent: false,
        startsAt: nowLocal(),
        expiresAt: plusHoursLocal(8),
        canCreateIncident: true,
        canUploadMedia: false,
        canDownloadFiles: false,
        canEditData: false
      }));
      await refresh();
    } catch (error) {
      setAccessMessage(error.message);
    }
  }

  async function changeMember(row, patch) {
    setMemberMessage('');
    setMemberError('');
    setUpdatingMemberId(row.id);
    try {
      await updateTenantMember({ tenantId: row.tenant_id, memberId: row.id, role: patch.role || row.role, estado: patch.estado || row.estado });
      await refresh();
      setMemberMessage('Usuario actualizado correctamente.');
    } catch (error) {
      setMemberError(error.message);
    } finally {
      setUpdatingMemberId('');
    }
  }

  async function setMemberStatus(row, estado) {
    const label = memberName(row);
    if (estado === 'inactivo' && !window.confirm(`Desactivar acceso de ${label}? No podra entrar al cliente ni ver sus OT hasta reactivarlo.`)) return;
    setMemberMessage('');
    setMemberError('');
    setUpdatingMemberId(row.id);
    try {
      if (estado === 'activo') await activateTenantMember(row);
      else await deactivateTenantMember(row);
      await refresh();
      setMemberMessage(estado === 'activo' ? 'Usuario reactivado correctamente.' : 'Usuario desactivado correctamente.');
    } catch (error) {
      setMemberError(error.message);
    } finally {
      setUpdatingMemberId('');
    }
  }

  async function toggleMfa(row, checked) {
    setMemberMessage('');
    setMemberError('');
    setUpdatingMemberId(row.id);
    try {
      await setMemberMfaRequired(row.user_id, checked);
      await refresh();
      setMemberMessage('MFA actualizado correctamente.');
    } catch (error) {
      setMemberError(error.message);
    } finally {
      setUpdatingMemberId('');
    }
  }

  async function revoke(row) {
    if (!window.confirm(`Revocar invitacion para ${row.email}?`)) return;
    await revokeInvitation(row);
    await refresh();
  }

  async function revokeAccess(row) {
    if (!window.confirm(`Revocar acceso a ${row.instalaciones?.nombre || 'esta instalacion'}?`)) return;
    await revokeInstallationAccessGrant(row);
    await refresh();
  }

  async function copyInvitation(text, label) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${label} copiado.`);
    } catch {
      setCopyMessage('No se ha podido copiar automaticamente. Selecciona el texto y copialo manualmente.');
    }
  }

  const userColumns = [
    { key: 'usuario', label: 'Usuario', render: (row) => <Link className="table-link" to={`/usuarios/${row.id}`}>{memberName(row)}</Link> },
    { key: 'role', label: 'Rol', render: (row) => <select value={row.role} disabled={updatingMemberId === row.id} onChange={(event) => changeMember(row, { role: event.target.value })}>{TENANT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}</select> },
    { key: 'alcance', label: 'Alcance', render: (row) => row.role === 'tecnico' ? <span className="badge ok">Todas las instalaciones por OT</span> : row.role === 'tecnico_externo' ? <span className="badge warn">OT asignadas / accesos concretos</span> : <span className="badge">{ROLE_LABELS[row.role] || row.role}</span> },
    { key: 'mfa', label: 'MFA', render: (row) => <input type="checkbox" checked={Boolean(row.profiles?.mfa_required)} disabled={updatingMemberId === row.id} onChange={(event) => toggleMfa(row, event.target.checked)} /> },
    { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${row.estado === 'activo' ? 'ok' : 'danger'}`}>{row.estado}</span> },
    { key: 'actions', label: 'Acciones', render: (row) => <div className="button-row"><Link className="secondary-button" to={`/usuarios/${row.id}`}>Ficha</Link>{row.estado === 'activo' ? <button className="danger-button" type="button" disabled={updatingMemberId === row.id} onClick={() => setMemberStatus(row, 'inactivo')}>Desactivar</button> : <button className="primary-button" type="button" disabled={updatingMemberId === row.id} onClick={() => setMemberStatus(row, 'activo')}>Reactivar</button>}</div> }
  ];

  return (
    <>
      <PageHeader title="Usuarios y permisos" subtitle="Roles por cliente, invitaciones, MFA, accesos por instalacion y ficha individual de usuario." action={<div className="button-row"><Link className="secondary-button" to="/usuarios-panel">Panel usuarios</Link><button className="secondary-button" onClick={() => setAccessOpen(true)}>Acceso instalacion</button><button className="primary-button" onClick={() => setOpen(true)}>Nueva invitacion</button></div>} />
      {memberMessage && <p className="success-text">{memberMessage}</p>}
      {memberError && <p className="error-text">{memberError}</p>}
      {loadMessage && <p className="warning-text">Algunos datos no se han podido cargar: {loadMessage}</p>}

      <CollapsibleSection title="Resumen" subtitle="Usuarios activos, tecnicos, instalaciones e invitaciones" icon={Users} badge={`${activeMembers.length} activos`} defaultOpen>
        <section className="card users-summary-card">
          <div><span className="muted">Usuarios activos</span><strong>{activeMembers.length}</strong></div>
          <div><span className="muted">Tecnicos propios</span><strong>{ownTechnicians.length}</strong></div>
          <div><span className="muted">Tecnicos externos</span><strong>{externalTechnicians.length}</strong></div>
          <div><span className="muted">Invitaciones pendientes</span><strong>{pendingInvitations.length}</strong></div>
          <p className="muted">Un tecnico propio con rol tecnico queda disponible para asignarse a cualquier OT de cualquier instalacion del cliente activo.</p>
        </section>
        <section className="card account-context-card">
          <span><strong>Sesion:</strong> {user?.email || 'Sin email de sesion'}</span>
          <span><strong>Cliente activo:</strong> {activeTenant?.nombre || activeTenantId || 'Sin cliente activo'}</span>
          <span><strong>Rol:</strong> {activeRole || 'Sin rol cargado'}</span>
        </section>
        <section className="card role-guide-card">
          <div>
            <strong>Rol tecnico</strong>
            <span>Para personal de la empresa. Puede trabajar sobre todas las instalaciones del cliente activo y se puede asignar a cualquier OT.</span>
          </div>
          <div>
            <strong>Rol tecnico externo</strong>
            <span>Para colaboradores puntuales. Despues de aceptar la invitacion, concede acceso solo a la instalacion necesaria.</span>
          </div>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title="Filtros y vista rapida" subtitle="Busca usuarios y cambia de vista rapidamente" icon={Filter} badge={`${filteredRows.length}/${rows.length}`} defaultOpen>
        <div className="user-filter-grid">
          <label><span>Buscar</span><div className="input-with-icon"><Search size={17} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nombre, email o ID" /></div></label>
          <label><span>Rol</span><select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}><option value="todos">Todos</option>{TENANT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="todos">Todos</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <label><span>Vista</span><select value={filters.mode} onChange={(event) => setFilters((current) => ({ ...current, mode: event.target.value }))}><option value="todos">Todos</option><option value="tecnicos">Solo tecnicos</option><option value="clientes">Solo clientes</option><option value="admins">Solo administradores</option></select></label>
        </div>
        <div className="quick-actions user-filter-actions">
          <button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, mode: 'tecnicos', role: 'todos' }))}><Wrench size={16} /> Ver tecnicos</button>
          <button className="secondary-button" type="button" onClick={() => setFilters((current) => ({ ...current, status: 'inactivo' }))}>Ver inactivos</button>
          <button className="ghost-button" type="button" onClick={clearFilters}>Limpiar filtros</button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Vista rapida de tecnicos" subtitle="Tecnicos propios y externos filtrados" icon={Wrench} badge={`${technicianRows.length}`} defaultOpen={filters.mode === 'tecnicos'}>
        <DataTable columns={userColumns} rows={technicianRows} empty="No hay tecnicos que coincidan con los filtros." />
      </CollapsibleSection>

      <CollapsibleSection title="Invitaciones pendientes" subtitle="Enlaces que aun no han sido aceptados" icon={Clock3} badge={`${pendingInvitations.length}`} defaultOpen={pendingInvitations.length > 0}>
        {pendingInvitations.length > 0 ? <div className="pending-invitation-grid">{pendingInvitations.map((invitation) => { const invitationUrl = buildInvitationUrl(invitation); return <article className="pending-invitation-card" key={invitation.id}><div className="pending-invitation-icon"><Clock3 size={22} /></div><div><strong>{invitation.nombre || invitation.email}</strong><span><Mail size={15} /> {invitation.email}</span><span>Rol: {ROLE_LABELS[invitation.role] || invitation.role}</span><span>Caduca: {new Date(invitation.expires_at).toLocaleString()}</span><small>Esperando confirmacion. Aun no es asignable.</small></div><div className="quick-actions"><button className="secondary-button" type="button" onClick={() => copyInvitation(invitationUrl, 'Enlace')}><Copy size={16} /> Copiar enlace</button><button className="danger-button" type="button" onClick={() => revoke(invitation)}>Revocar</button></div></article>; })}</div> : <p className="muted">No hay invitaciones pendientes.</p>}
      </CollapsibleSection>

      <CollapsibleSection title="Usuarios activos e inactivos" subtitle="Tabla principal con ficha, rol, MFA y estado" icon={ShieldCheck} badge={`${filteredRows.length}`} defaultOpen>
        <DataTable columns={userColumns} rows={filteredRows} empty="No hay usuarios que coincidan con los filtros." />
      </CollapsibleSection>

      <CollapsibleSection title="Accesos por instalacion" subtitle="Permisos concretos para QR o tecnicos externos" icon={KeyRound} defaultOpen={false}>
        <p className="muted">Usa estos accesos para tecnicos externos o accesos QR puntuales. Los tecnicos propios no necesitan aparecer aqui para recibir OT de cualquier instalacion.</p>
        <DataTable columns={[{ key: 'usuario', label: 'Usuario', render: (row) => row.profiles?.nombre || row.profiles?.email || row.user_id }, { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || row.instalacion_id }, { key: 'tipo', label: 'Tipo', render: (row) => <span className="badge">{row.expires_at ? 'temporal' : 'permanente'}</span> }, { key: 'expires_at', label: 'Caduca', render: (row) => row.expires_at ? new Date(row.expires_at).toLocaleString() : 'No caduca' }, { key: 'permisos', label: 'Permisos', render: (row) => [row.can_view ? 'ver' : null, row.can_create_incident ? 'incidencias' : null, row.can_upload_media ? 'subir fotos/videos' : null, row.can_download_files ? 'descargar' : null, row.can_edit_data ? 'editar' : null].filter(Boolean).join(', ') }, { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{accessStatus(row)}</span> }, { key: 'actions', label: 'Acciones', render: (row) => row.estado === 'activo' ? <button className="danger-button" onClick={() => revokeAccess(row)}>Revocar</button> : null }]} rows={accessGrants} empty="Sin accesos especificos por instalacion" />
      </CollapsibleSection>

      <CollapsibleSection title="Historial de invitaciones" subtitle="Invitaciones pendientes, aceptadas o revocadas" icon={Mail} defaultOpen={false}>
        <DataTable columns={[{ key: 'nombre', label: 'Nombre', render: (row) => row.nombre || '-' }, { key: 'email', label: 'Invitacion' }, { key: 'role', label: 'Rol', render: (row) => <span className="badge">{ROLE_LABELS[row.role] || row.role}</span> }, { key: 'estado', label: 'Estado' }, { key: 'expires_at', label: 'Caduca', render: (row) => new Date(row.expires_at).toLocaleString() }, { key: 'actions', label: 'Acciones', render: (row) => row.estado === 'pendiente' ? <button className="danger-button" onClick={() => revoke(row)}>Revocar</button> : null }]} rows={invitations} empty="Sin invitaciones pendientes o historicas" />
      </CollapsibleSection>

      <Modal title="Nueva invitacion" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submitInvitation}>
          <div className="template-grid">
            {USER_TEMPLATES.map((template) => <button key={template.role} className="template-card" type="button" onClick={() => applyTemplate(template)}><strong>{template.label}</strong><span>{template.help}</span></button>)}
          </div>
          <FormField label="Nombre"><input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} required /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></FormField>
          <FormField label="Rol"><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>{TENANT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}</select></FormField>
          <label className="checkbox-row"><input type="checkbox" checked={form.mfaRequired} onChange={(event) => setForm((current) => ({ ...current, mfaRequired: event.target.checked }))} /><span>Requerir MFA para este usuario</span></label>
          {message && <p className="error-text">{message}</p>}
          {lastInvitation && <div className="invitation-created-box"><div className="success-icon"><CheckCircle2 size={24} /></div><strong>Invitacion creada correctamente</strong><code>{buildInvitationUrl(lastInvitation)}</code><button className="primary-button" type="button" onClick={() => copyInvitation(buildInvitationUrl(lastInvitation), 'Enlace')}><Copy size={16} /> Copiar enlace</button>{copyMessage && <span>{copyMessage}</span>}</div>}
          <div className="form-actions"><button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cerrar</button><button className="primary-button" type="submit"><UserPlus size={18} /> Crear invitacion</button></div>
        </form>
      </Modal>

      <Modal title="Acceso a instalacion" open={accessOpen} onClose={() => setAccessOpen(false)}>
        <form className="form-grid" onSubmit={submitAccessGrant}>
          <p className="muted">Da acceso a una instalacion concreta para tecnicos externos o accesos QR puntuales.</p>
          <FormField label="Usuario"><select value={accessForm.userId} onChange={(event) => setAccessForm((current) => ({ ...current, userId: event.target.value }))} required><option value="">Selecciona usuario</option>{assignableMembers.map((member) => <option key={member.user_id} value={member.user_id}>{memberName(member)} · {ROLE_LABELS[member.role] || member.role}</option>)}</select></FormField>
          <FormField label="Instalacion"><select value={accessForm.instalacionId} onChange={(event) => setAccessForm((current) => ({ ...current, instalacionId: event.target.value }))} required><option value="">Selecciona instalacion</option>{installations.map((installation) => <option key={installation.id} value={installation.id}>{installation.nombre}</option>)}</select></FormField>
          <label className="checkbox-row"><input type="checkbox" checked={accessForm.permanent} onChange={(event) => setAccessForm((current) => ({ ...current, permanent: event.target.checked }))} /><span>Acceso permanente</span></label>
          <div className="form-grid two"><FormField label="Empieza"><input type="datetime-local" value={accessForm.startsAt} onChange={(event) => setAccessForm((current) => ({ ...current, startsAt: event.target.value }))} required /></FormField><FormField label="Caduca"><input type="datetime-local" value={accessForm.expiresAt} disabled={accessForm.permanent} onChange={(event) => setAccessForm((current) => ({ ...current, expiresAt: event.target.value }))} required={!accessForm.permanent} /></FormField></div>
          <div className="permission-grid"><label className="checkbox-row"><input type="checkbox" checked readOnly /><span>Ver fichas y escanear QR</span></label><label className="checkbox-row"><input type="checkbox" checked={accessForm.canCreateIncident} onChange={(event) => setAccessForm((current) => ({ ...current, canCreateIncident: event.target.checked }))} /><span>Crear incidencias</span></label><label className="checkbox-row"><input type="checkbox" checked={accessForm.canUploadMedia} onChange={(event) => setAccessForm((current) => ({ ...current, canUploadMedia: event.target.checked }))} /><span>Subir fotos/videos</span></label><label className="checkbox-row"><input type="checkbox" checked={accessForm.canDownloadFiles} onChange={(event) => setAccessForm((current) => ({ ...current, canDownloadFiles: event.target.checked }))} /><span>Descargar documentos</span></label><label className="checkbox-row"><input type="checkbox" checked={accessForm.canEditData} onChange={(event) => setAccessForm((current) => ({ ...current, canEditData: event.target.checked }))} /><span>Editar datos tecnicos</span></label></div>
          {accessMessage && <p className="error-text">{accessMessage}</p>}
          <div className="form-actions"><button className="ghost-button" type="button" onClick={() => setAccessOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar acceso</button></div>
        </form>
      </Modal>
    </>
  );
}
