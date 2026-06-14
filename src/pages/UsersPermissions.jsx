import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Mail, UserPlus } from 'lucide-react';
import { useTenant } from '../hooks/useTenant';
import { listTenantMembers } from '../services/tenantService';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { listInstallationsForTenant } from '../services/entityService';
import {
  createInstallationAccessGrant,
  createTenantInvitation,
  listInstallationAccessGrants,
  listTenantInvitations,
  revokeInstallationAccessGrant,
  revokeInvitation,
  setMemberMfaRequired,
  updateTenantMember
} from '../services/permissionService';

const TENANT_ROLES = ['admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'];
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const plusHoursLocal = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const buildInvitationUrl = (invitation) => {
  if (!invitation?.invitation_token) return '';
  const params = new URLSearchParams({
    token: invitation.invitation_token,
    email: invitation.email || ''
  });
  return `${window.location.origin}${window.location.pathname}#/registro?${params.toString()}`;
};

export default function UsersPermissions() {
  const { activeTenantId } = useTenant();
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
  const [message, setMessage] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [lastInvitation, setLastInvitation] = useState(null);
  const pendingInvitations = invitations.filter((invitation) => invitation.estado === 'pendiente');
  const externalTechnicians = rows.filter((member) => member.role === 'tecnico_externo' && member.estado === 'activo');

  async function refresh() {
    if (!activeTenantId) return;
    const [members, pendingInvitations, tenantInstallations, grants] = await Promise.all([
      listTenantMembers(activeTenantId),
      listTenantInvitations(activeTenantId),
      listInstallationsForTenant(activeTenantId),
      listInstallationAccessGrants(activeTenantId)
    ]);
    setRows(members);
    setInvitations(pendingInvitations);
    setInstallations(tenantInstallations);
    setAccessGrants(grants);
    setAccessForm((current) => ({
      ...current,
      userId: current.userId || members.find((member) => member.role === 'tecnico_externo' && member.estado === 'activo')?.user_id || '',
      instalacionId: current.instalacionId || tenantInstallations[0]?.id || ''
    }));
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [activeTenantId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitInvitation(event) {
    event.preventDefault();
    setMessage('');
    setCopyMessage('');
    setLastInvitation(null);
    try {
      const invitation = await createTenantInvitation({
        tenantId: activeTenantId,
        nombre: form.nombre,
        email: form.email,
        role: form.role,
        mfaRequired: form.mfaRequired
      });
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
    await updateTenantMember({
      tenantId: row.tenant_id,
      memberId: row.id,
      role: patch.role || row.role,
      estado: patch.estado || row.estado
    });
    await refresh();
  }

  async function toggleMfa(row, checked) {
    await setMemberMfaRequired(row.user_id, checked);
    await refresh();
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

  const accessStatus = (row) => {
    if (row.estado !== 'activo') return 'revocado';
    if (row.expires_at && new Date(row.expires_at) <= new Date()) return 'caducado';
    if (new Date(row.starts_at) > new Date()) return 'programado';
    return 'activo';
  };

  return (
    <>
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Roles por cliente, invitaciones, MFA y accesos temporales por instalacion."
        action={
          <div className="button-row">
            <button className="secondary-button" onClick={() => setAccessOpen(true)}>Acceso instalacion</button>
            <button className="primary-button" onClick={() => setOpen(true)}>Nueva invitacion</button>
          </div>
        }
      />
      <section className="card users-summary-card">
        <div>
          <span className="muted">Usuarios activos</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span className="muted">Invitaciones pendientes</span>
          <strong>{pendingInvitations.length}</strong>
        </div>
        <p className="muted">Los tecnicos de empresa tienen acceso a todas las instalaciones. Los tecnicos externos solo ven las instalaciones que les concedas en Acceso instalacion.</p>
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
      {pendingInvitations.length > 0 && (
        <section className="pending-invitations">
          <h2 className="section-heading">Pendientes de aceptar</h2>
          <div className="pending-invitation-grid">
            {pendingInvitations.map((invitation) => {
              const invitationUrl = buildInvitationUrl(invitation);
              return (
                <article className="pending-invitation-card" key={invitation.id}>
                  <div className="pending-invitation-icon"><Clock3 size={22} /></div>
                  <div>
                    <strong>{invitation.nombre || invitation.email}</strong>
                    <span><Mail size={15} /> {invitation.email}</span>
                    <span>Rol: {invitation.role.replaceAll('_', ' ')}</span>
                    <span>Caduca: {new Date(invitation.expires_at).toLocaleString()}</span>
                    <small>Estado: esperando confirmacion del tecnico. Aun no es asignable.</small>
                  </div>
                  <div className="quick-actions">
                    <button className="secondary-button" type="button" onClick={() => copyInvitation(invitationUrl, 'Enlace')}>
                      <Copy size={16} /> Copiar enlace
                    </button>
                    <button className="danger-button" type="button" onClick={() => revoke(invitation)}>Revocar</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <DataTable columns={[
        { key: 'usuario', label: 'Usuario', render: (row) => row.profiles?.nombre || row.profiles?.email },
        {
          key: 'role',
          label: 'Rol',
          render: (row) => (
            <select value={row.role} onChange={(event) => changeMember(row, { role: event.target.value })}>
              {TENANT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          )
        },
        {
          key: 'mfa',
          label: 'MFA requerido',
          render: (row) => <input type="checkbox" checked={Boolean(row.profiles?.mfa_required)} onChange={(event) => toggleMfa(row, event.target.checked)} />
        },
        {
          key: 'estado',
          label: 'Estado',
          render: (row) => (
            <select value={row.estado} onChange={(event) => changeMember(row, { estado: event.target.value })}>
              <option value="activo">activo</option>
              <option value="inactivo">inactivo</option>
            </select>
          )
        }
      ]} rows={rows} empty="Todavia no hay usuarios activos. Crea una invitacion y espera a que el tecnico la acepte." />
      <div style={{ marginTop: 16 }}>
        <h2 className="section-heading">Accesos por instalacion</h2>
        <DataTable columns={[
          { key: 'usuario', label: 'Usuario', render: (row) => row.profiles?.nombre || row.profiles?.email || row.user_id },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || row.instalacion_id },
          { key: 'tipo', label: 'Tipo', render: (row) => <span className="badge">{row.expires_at ? 'temporal' : 'permanente'}</span> },
          { key: 'expires_at', label: 'Caduca', render: (row) => row.expires_at ? new Date(row.expires_at).toLocaleString() : 'No caduca' },
          { key: 'permisos', label: 'Permisos', render: (row) => [
            row.can_view ? 'ver' : null,
            row.can_create_incident ? 'incidencias' : null,
            row.can_upload_media ? 'subir fotos/videos' : null,
            row.can_download_files ? 'descargar' : null,
            row.can_edit_data ? 'editar' : null
          ].filter(Boolean).join(', ') },
          { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{accessStatus(row)}</span> },
          { key: 'actions', label: 'Acciones', render: (row) => row.estado === 'activo' ? <button className="danger-button" onClick={() => revokeAccess(row)}>Revocar</button> : null }
        ]} rows={accessGrants} empty="Sin accesos especificos por instalacion" />
      </div>
      <div style={{ marginTop: 16 }}>
        <DataTable columns={[
          { key: 'nombre', label: 'Nombre', render: (row) => row.nombre || '-' },
          { key: 'email', label: 'Invitacion' },
          { key: 'role', label: 'Rol', render: (row) => <span className="badge">{row.role}</span> },
          { key: 'estado', label: 'Estado' },
          { key: 'expires_at', label: 'Caduca', render: (row) => new Date(row.expires_at).toLocaleString() },
          { key: 'actions', label: 'Acciones', render: (row) => row.estado === 'pendiente' ? <button className="danger-button" onClick={() => revoke(row)}>Revocar</button> : null }
        ]} rows={invitations} empty="Sin invitaciones pendientes o historicas" />
      </div>
      <Modal title="Nueva invitacion" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submitInvitation}>
          <FormField label="Nombre">
            <input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} placeholder="Nombre del tecnico o usuario" required />
          </FormField>
          <FormField label="Email">
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
          </FormField>
          <FormField label="Rol">
            <select value={form.role} onChange={(event) => updateField('role', event.target.value)}>
              {TENANT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </FormField>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.mfaRequired} onChange={(event) => updateField('mfaRequired', event.target.checked)} />
            <span>Requerir MFA para este usuario</span>
          </label>
          <p className="muted">Para tecnicos de la empresa usa el rol tecnico. Para visitas puntuales usa tecnico_externo y despues concede acceso solo a la instalacion necesaria. El token se muestra una sola vez y no se guarda en claro.</p>
          {message && <p className="error-text">{message}</p>}
          {lastInvitation && (
            <div className="invitation-created-box">
              <div className="success-icon"><CheckCircle2 size={24} /></div>
              <strong>Invitacion creada correctamente</strong>
              <span>Envia este enlace al tecnico. Hasta que lo acepte aparecera como pendiente y no sera asignable en una OT.</span>
              <code>{buildInvitationUrl(lastInvitation)}</code>
              <div className="quick-actions">
                <button className="primary-button" type="button" onClick={() => copyInvitation(buildInvitationUrl(lastInvitation), 'Enlace')}><Copy size={16} /> Copiar enlace</button>
              </div>
              <strong>Token temporal</strong>
              <code>{lastInvitation.invitation_token}</code>
              <span>Caduca: {new Date(lastInvitation.expires_at).toLocaleString()}</span>
              <div className="quick-actions">
                <button className="ghost-button" type="button" onClick={() => copyInvitation(lastInvitation.invitation_token, 'Token')}>Copiar solo token</button>
              </div>
              {copyMessage && <span>{copyMessage}</span>}
            </div>
          )}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Cerrar</button>
            <button className="primary-button" type="submit"><UserPlus size={18} /> Crear invitacion</button>
          </div>
        </form>
      </Modal>
      <Modal title="Acceso a instalacion" open={accessOpen} onClose={() => setAccessOpen(false)}>
        <form className="form-grid" onSubmit={submitAccessGrant}>
          <p className="muted">Este formulario es solo para tecnicos externos. Los tecnicos de empresa ya tienen acceso a todas las instalaciones del cliente.</p>
          <FormField label="Usuario">
            <select value={accessForm.userId} onChange={(event) => setAccessForm((current) => ({ ...current, userId: event.target.value }))} required>
              <option value="">Selecciona tecnico externo</option>
              {externalTechnicians.map((member) => (
                <option key={member.user_id} value={member.user_id}>{member.profiles?.nombre || member.profiles?.email || member.user_id}</option>
              ))}
            </select>
          </FormField>
          {externalTechnicians.length === 0 && (
            <p className="warning-text">No hay tecnicos externos activos. Invita primero con rol tecnico_externo y espera a que acepte la invitacion.</p>
          )}
          <FormField label="Instalacion">
            <select value={accessForm.instalacionId} onChange={(event) => setAccessForm((current) => ({ ...current, instalacionId: event.target.value }))} required>
              <option value="">Selecciona instalacion</option>
              {installations.map((installation) => (
                <option key={installation.id} value={installation.id}>{installation.nombre}</option>
              ))}
            </select>
          </FormField>
          <label className="checkbox-row">
            <input type="checkbox" checked={accessForm.permanent} onChange={(event) => setAccessForm((current) => ({ ...current, permanent: event.target.checked }))} />
            <span>Acceso permanente</span>
          </label>
          <div className="form-grid two">
            <FormField label="Empieza">
              <input type="datetime-local" value={accessForm.startsAt} onChange={(event) => setAccessForm((current) => ({ ...current, startsAt: event.target.value }))} required />
            </FormField>
            <FormField label="Caduca">
              <input type="datetime-local" value={accessForm.expiresAt} disabled={accessForm.permanent} onChange={(event) => setAccessForm((current) => ({ ...current, expiresAt: event.target.value }))} required={!accessForm.permanent} />
            </FormField>
          </div>
          <div className="permission-grid">
            <label className="checkbox-row">
              <input type="checkbox" checked readOnly />
              <span>Ver fichas y escanear QR</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={accessForm.canCreateIncident} onChange={(event) => setAccessForm((current) => ({ ...current, canCreateIncident: event.target.checked }))} />
              <span>Crear incidencias</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={accessForm.canUploadMedia} onChange={(event) => setAccessForm((current) => ({ ...current, canUploadMedia: event.target.checked }))} />
              <span>Subir fotos/videos</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={accessForm.canDownloadFiles} onChange={(event) => setAccessForm((current) => ({ ...current, canDownloadFiles: event.target.checked }))} />
              <span>Descargar documentos</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={accessForm.canEditData} onChange={(event) => setAccessForm((current) => ({ ...current, canEditData: event.target.checked }))} />
              <span>Editar datos tecnicos</span>
            </label>
          </div>
          <p className="muted">Recomendado: dejar descarga y edicion desactivadas para visitas puntuales.</p>
          {accessMessage && <p className="error-text">{accessMessage}</p>}
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setAccessOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit">Guardar acceso</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
