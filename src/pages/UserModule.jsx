import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, Users, Wrench, Eye, Clock3, KeyRound, ClipboardCheck, Settings, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import { useTenant } from '../hooks/useTenant';
import { listTenantMembers } from '../services/tenantService';
import { listInstallationAccessGrants, listTenantInvitations } from '../services/permissionService';
import { listInstallationsForTenant } from '../services/entityService';

const ROLE_CARDS = [
  {
    role: 'admin_cliente',
    title: 'Administrador del cliente',
    icon: ShieldCheck,
    badge: 'Control total',
    description: 'Gestiona inventario, usuarios, permisos, invitaciones, OT, auditoria y configuracion del cliente.',
    permissions: ['Inventario completo', 'Crear y borrar OT', 'Invitar usuarios', 'Desactivar usuarios', 'Ver auditoria']
  },
  {
    role: 'tecnico',
    title: 'Tecnico propio',
    icon: Wrench,
    badge: 'Empresa',
    description: 'Tecnico interno de la empresa. Se puede asignar a cualquier OT de cualquier instalacion del cliente activo.',
    permissions: ['Mis OT asignadas', 'Visitas', 'Checklist', 'Fotos', 'Informe de OT']
  },
  {
    role: 'tecnico_externo',
    title: 'Tecnico externo',
    icon: Clock3,
    badge: 'Puntual',
    description: 'Tecnico invitado para trabajos concretos. Se recomienda limitarlo a OT asignadas y accesos por instalacion.',
    permissions: ['OT asignadas', 'Acceso temporal', 'QR limitado', 'Sin administracion']
  },
  {
    role: 'cliente_lectura',
    title: 'Cliente lectura',
    icon: Eye,
    badge: 'Consulta',
    description: 'Usuario de cliente que solo consulta informacion permitida, sin modificar datos tecnicos ni usuarios.',
    permissions: ['Ver inventario', 'Consultar documentos', 'Sin editar', 'Sin OT administrativas']
  }
];

const FLOW_STEPS = [
  ['1', 'Crear invitacion', 'Introduce nombre, email y rol. Para personal de la empresa usa Tecnico propio.'],
  ['2', 'Aceptar invitacion', 'El usuario abre el enlace, crea contrasena y queda vinculado al cliente.'],
  ['3', 'Asignar trabajo', 'El administrador crea una OT y asigna el tecnico a cualquier instalacion del cliente.'],
  ['4', 'Controlar acceso', 'Desde Usuarios y permisos puedes desactivar, reactivar, revocar invitaciones y controlar accesos por instalacion.']
];

export default function UserModule() {
  const { activeTenantId } = useTenant();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeTenantId) return;
    Promise.all([
      listTenantMembers(activeTenantId),
      listTenantInvitations(activeTenantId),
      listInstallationsForTenant(activeTenantId),
      listInstallationAccessGrants(activeTenantId)
    ])
      .then(([tenantMembers, tenantInvitations, tenantInstallations, accessGrants]) => {
        setMembers(tenantMembers || []);
        setInvitations(tenantInvitations || []);
        setInstallations(tenantInstallations || []);
        setGrants(accessGrants || []);
      })
      .catch((err) => setError(err.message));
  }, [activeTenantId]);

  const stats = useMemo(() => {
    const active = members.filter((member) => member.estado === 'activo');
    const inactive = members.filter((member) => member.estado !== 'activo');
    return {
      active: active.length,
      inactive: inactive.length,
      admins: active.filter((member) => member.role === 'admin_cliente').length,
      ownTechnicians: active.filter((member) => member.role === 'tecnico').length,
      externalTechnicians: active.filter((member) => member.role === 'tecnico_externo').length,
      readOnlyClients: active.filter((member) => member.role === 'cliente_lectura').length,
      pendingInvitations: invitations.filter((invitation) => invitation.estado === 'pendiente').length,
      activeGrants: grants.filter((grant) => grant.estado === 'activo').length
    };
  }, [members, invitations, grants]);

  return (
    <>
      <PageHeader
        title="Bloque Usuarios"
        subtitle="Gestion completa de administradores, tecnicos propios, tecnicos externos, clientes de lectura, invitaciones y accesos por instalacion."
        action={
          <div className="button-row">
            <Link className="secondary-button" to="/auditoria"><ShieldCheck size={18} /> Auditoria</Link>
            <Link className="primary-button" to="/usuarios"><UserPlus size={18} /> Gestionar usuarios</Link>
          </div>
        }
      />

      {error && <p className="error-text">{error}</p>}

      <section className="grid metrics user-module-metrics">
        <article className="metric-card">
          <span>Usuarios activos</span>
          <strong>{stats.active}</strong>
        </article>
        <article className="metric-card warn">
          <span>Usuarios inactivos</span>
          <strong>{stats.inactive}</strong>
        </article>
        <article className="metric-card">
          <span>Tecnicos propios</span>
          <strong>{stats.ownTechnicians}</strong>
        </article>
        <article className="metric-card">
          <span>Invitaciones pendientes</span>
          <strong>{stats.pendingInvitations}</strong>
        </article>
      </section>

      <section className="grid two user-module-overview">
        <article className="card user-command-card">
          <div className="user-command-icon"><Users size={26} /></div>
          <div>
            <h2>Gestion diaria de usuarios</h2>
            <p>Desde aqui controlas quien puede entrar, que rol tiene, si sigue activo y si necesita permisos especiales por instalacion.</p>
          </div>
          <div className="user-command-actions">
            <Link className="primary-button" to="/usuarios">Abrir usuarios y permisos</Link>
          </div>
        </article>
        <article className="card user-command-card">
          <div className="user-command-icon"><ClipboardCheck size={26} /></div>
          <div>
            <h2>Tecnicos y OT</h2>
            <p>El tecnico propio no necesita permiso instalacion por instalacion: basta con asignarle una OT de cualquier instalacion del cliente.</p>
          </div>
          <div className="user-command-actions">
            <Link className="secondary-button" to="/ots">Gestionar OT</Link>
          </div>
        </article>
      </section>

      <section className="card user-permission-matrix">
        <div className="section-title-row">
          <div>
            <h2 className="section-heading">Roles principales</h2>
            <p className="muted">Estos son los perfiles que deben usarse en la aplicacion.</p>
          </div>
        </div>
        <div className="role-card-grid">
          {ROLE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article className="role-card" key={card.role}>
                <div className="role-card-header">
                  <span className="role-card-icon"><Icon size={22} /></span>
                  <span className="badge">{card.badge}</span>
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <div className="role-permission-list">
                  {card.permissions.map((permission) => <span key={permission}>{permission}</span>)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid two">
        <article className="card">
          <h2 className="section-heading">Estado actual</h2>
          <div className="user-status-list">
            <div><span>Administradores activos</span><strong>{stats.admins}</strong></div>
            <div><span>Tecnicos externos activos</span><strong>{stats.externalTechnicians}</strong></div>
            <div><span>Clientes lectura activos</span><strong>{stats.readOnlyClients}</strong></div>
            <div><span>Instalaciones del cliente</span><strong>{installations.length}</strong></div>
            <div><span>Accesos por instalacion activos</span><strong>{stats.activeGrants}</strong></div>
          </div>
        </article>

        <article className="card">
          <h2 className="section-heading">Flujo recomendado</h2>
          <div className="user-flow-list">
            {FLOW_STEPS.map(([number, title, text]) => (
              <div className="user-flow-step" key={number}>
                <strong>{number}</strong>
                <div>
                  <span>{title}</span>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card user-security-note">
        <AlertTriangle size={22} />
        <div>
          <strong>Regla de seguridad</strong>
          <p>No se borran usuarios de Auth desde la app. Se desactivan para conservar historico, auditoria, OT, fotos e informes. Solo debe existir borrado tecnico en Supabase para casos muy concretos.</p>
        </div>
      </section>
    </>
  );
}
