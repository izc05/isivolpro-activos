import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck, KeyRound, ShieldCheck, UserCog, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import { useTenant } from '../hooks/useTenant';
import { formatDateTime } from '../utils/dateUtils';
import { activateTenantMember, deactivateTenantMember, setMemberMfaRequired, updateTenantMember } from '../services/permissionService';
import { loadUserManagementDetail } from '../services/userManagementService';
import '../styles/userModule.css';

const ROLE_LABELS = {
  admin_cliente: 'Administrador',
  tecnico: 'Tecnico propio',
  tecnico_externo: 'Tecnico externo',
  cliente_lectura: 'Cliente lectura'
};
const TENANT_ROLES = ['admin_cliente', 'tecnico', 'tecnico_externo', 'cliente_lectura'];

function userLabel(member) {
  return member?.profiles?.nombre || member?.profiles?.email || member?.user_id || 'Usuario';
}

function roleHelp(role) {
  if (role === 'admin_cliente') return 'Gestiona inventario, OT, usuarios, auditoria y configuracion del cliente.';
  if (role === 'tecnico') return 'Tecnico propio: puede recibir OT de cualquier instalacion del cliente activo.';
  if (role === 'tecnico_externo') return 'Tecnico externo: recomendado para trabajos puntuales y accesos concretos.';
  if (role === 'cliente_lectura') return 'Cliente lectura: consulta informacion permitida sin editar.';
  return 'Rol personalizado.';
}

function grantStatus(row) {
  if (row.estado !== 'activo') return 'revocado';
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return 'caducado';
  if (row.starts_at && new Date(row.starts_at) > new Date()) return 'programado';
  return 'activo';
}

export default function UserDetail() {
  const { memberId } = useParams();
  const { activeTenantId } = useTenant();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!activeTenantId || !memberId) return;
    setLoading(true);
    setError('');
    try {
      const data = await loadUserManagementDetail(activeTenantId, memberId);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [activeTenantId, memberId]);

  const member = detail?.member;
  const assignedOrders = useMemo(() => (detail?.workOrders || []).filter((ot) => ot.assigned_to === member?.user_id), [detail, member]);
  const createdOrders = useMemo(() => (detail?.workOrders || []).filter((ot) => ot.created_by === member?.user_id), [detail, member]);
  const activeGrants = useMemo(() => (detail?.grants || []).filter((grant) => grantStatus(grant) === 'activo'), [detail]);

  async function changeRole(role) {
    if (!member) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateTenantMember({ tenantId: member.tenant_id, memberId: member.id, role, estado: member.estado });
      setMessage('Rol actualizado correctamente.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(estado) {
    if (!member) return;
    const label = userLabel(member);
    if (estado === 'inactivo' && !window.confirm(`Desactivar ${label}? No podra acceder al cliente hasta reactivarlo.`)) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      if (estado === 'activo') await activateTenantMember(member);
      else await deactivateTenantMember(member);
      setMessage(estado === 'activo' ? 'Usuario reactivado correctamente.' : 'Usuario desactivado correctamente.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeMfa(checked) {
    if (!member) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await setMemberMfaRequired(member.user_id, checked);
      setMessage('MFA actualizado correctamente.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Ficha de usuario" subtitle="Cargando datos del usuario..." />
        <section className="card">Cargando ficha...</section>
      </>
    );
  }

  if (error && !member) {
    return (
      <>
        <PageHeader title="Ficha de usuario" subtitle="No se ha podido cargar el usuario." action={<Link className="secondary-button" to="/usuarios"><ArrowLeft size={18} /> Volver</Link>} />
        <p className="error-text">{error}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={userLabel(member)}
        subtitle="Ficha completa del usuario: rol, estado, OT, accesos por instalacion, invitaciones y auditoria."
        action={
          <div className="button-row">
            <Link className="secondary-button" to="/usuarios"><ArrowLeft size={18} /> Volver</Link>
            <Link className="primary-button" to="/usuarios-panel"><UserCog size={18} /> Panel usuarios</Link>
          </div>
        }
      />

      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="grid metrics user-module-metrics">
        <article className="metric-card">
          <span>OT asignadas</span>
          <strong>{assignedOrders.length}</strong>
        </article>
        <article className="metric-card">
          <span>OT creadas</span>
          <strong>{createdOrders.length}</strong>
        </article>
        <article className="metric-card">
          <span>Accesos activos</span>
          <strong>{activeGrants.length}</strong>
        </article>
        <article className={`metric-card ${member.estado === 'activo' ? '' : 'danger'}`}>
          <span>Estado usuario</span>
          <strong>{member.estado}</strong>
        </article>
      </section>

      <section className="grid two">
        <article className="card user-profile-card">
          <div className="user-profile-header">
            <span className="user-profile-avatar">{(member.profiles?.nombre || member.profiles?.email || 'U').slice(0, 2).toUpperCase()}</span>
            <div>
              <h2>{userLabel(member)}</h2>
              <p>{member.profiles?.email || 'Sin email'}</p>
              <span className={`badge ${member.estado === 'activo' ? 'ok' : 'danger'}`}>{member.estado}</span>
            </div>
          </div>
          <div className="user-status-list">
            <div><span>Rol actual</span><strong>{ROLE_LABELS[member.role] || member.role}</strong></div>
            <div><span>Tipo global</span><strong>{member.profiles?.global_role || 'usuario'}</strong></div>
            <div><span>MFA requerido</span><strong>{member.profiles?.mfa_required ? 'Si' : 'No'}</strong></div>
            <div><span>Alta en cliente</span><strong>{formatDateTime(member.created_at)}</strong></div>
            <div><span>ID usuario</span><strong className="user-id-short">{member.user_id}</strong></div>
          </div>
        </article>

        <article className="card user-admin-card">
          <h2 className="section-heading">Gestion rapida</h2>
          <p className="muted">Controla el rol, estado y MFA de este usuario sin borrar su historico.</p>
          <div className="form-grid">
            <label>
              <span className="muted">Rol</span>
              <select value={member.role} disabled={saving} onChange={(event) => changeRole(event.target.value)}>
                {TENANT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
              </select>
            </label>
            <p className="muted">{roleHelp(member.role)}</p>
            <label className="checkbox-row">
              <input type="checkbox" checked={Boolean(member.profiles?.mfa_required)} disabled={saving} onChange={(event) => changeMfa(event.target.checked)} />
              <span><KeyRound size={16} /> Requerir MFA a este usuario</span>
            </label>
            <div className="button-row">
              {member.estado === 'activo' ? (
                <button className="danger-button" type="button" disabled={saving} onClick={() => changeStatus('inactivo')}>Desactivar usuario</button>
              ) : (
                <button className="primary-button" type="button" disabled={saving} onClick={() => changeStatus('activo')}>Reactivar usuario</button>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="card user-security-note">
        <ShieldCheck size={22} />
        <div>
          <strong>Criterio de seguridad</strong>
          <p>El usuario se desactiva, no se borra. Asi conservas OT, visitas, fotos, informes y auditoria asociados.</p>
        </div>
      </section>

      <section className="card user-detail-section">
        <h2 className="section-heading"><ClipboardCheck size={18} /> Ordenes de trabajo asignadas</h2>
        <DataTable columns={[
          { key: 'titulo', label: 'OT', render: (row) => <Link className="table-link" to={`/ots/${row.id}`}>{row.codigo_ot || row.titulo || row.id}</Link> },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{row.estado}</span> },
          { key: 'prioridad', label: 'Prioridad', render: (row) => <span className="badge warn">{row.prioridad || '-'}</span> },
          { key: 'fecha', label: 'Fecha prevista', render: (row) => formatDateTime(row.fecha_prevista) }
        ]} rows={assignedOrders} empty="Este usuario no tiene OT asignadas." />
      </section>

      <section className="card user-detail-section">
        <h2 className="section-heading">OT creadas por este usuario</h2>
        <DataTable columns={[
          { key: 'titulo', label: 'OT', render: (row) => <Link className="table-link" to={`/ots/${row.id}`}>{row.codigo_ot || row.titulo || row.id}</Link> },
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || '-' },
          { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{row.estado}</span> },
          { key: 'created_at', label: 'Creada', render: (row) => formatDateTime(row.created_at) }
        ]} rows={createdOrders} empty="Este usuario no ha creado OT." />
      </section>

      <section className="card user-detail-section">
        <h2 className="section-heading">Accesos por instalacion</h2>
        <DataTable columns={[
          { key: 'instalacion', label: 'Instalacion', render: (row) => row.instalaciones?.nombre || row.instalacion_id },
          { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{grantStatus(row)}</span> },
          { key: 'caduca', label: 'Caduca', render: (row) => row.expires_at ? formatDateTime(row.expires_at) : 'No caduca' },
          { key: 'permisos', label: 'Permisos', render: (row) => [
            row.can_view ? 'ver' : null,
            row.can_create_incident ? 'incidencias' : null,
            row.can_upload_media ? 'subir fotos/videos' : null,
            row.can_download_files ? 'descargar' : null,
            row.can_edit_data ? 'editar' : null
          ].filter(Boolean).join(', ') }
        ]} rows={detail?.grants || []} empty="Sin accesos concretos por instalacion." />
      </section>

      <section className="grid two">
        <article className="card user-detail-section">
          <h2 className="section-heading">Invitaciones</h2>
          <DataTable columns={[
            { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) },
            { key: 'role', label: 'Rol', render: (row) => ROLE_LABELS[row.role] || row.role },
            { key: 'estado', label: 'Estado', render: (row) => <span className="badge">{row.estado}</span> }
          ]} rows={detail?.invitations || []} empty="Sin invitaciones registradas." />
        </article>
        <article className="card user-detail-section">
          <h2 className="section-heading">Auditoria reciente</h2>
          <DataTable columns={[
            { key: 'created_at', label: 'Fecha', render: (row) => formatDateTime(row.created_at) },
            { key: 'action', label: 'Accion' },
            { key: 'entity_type', label: 'Entidad' }
          ]} rows={detail?.auditLogs || []} empty="Sin auditoria reciente." />
        </article>
      </section>
    </>
  );
}
