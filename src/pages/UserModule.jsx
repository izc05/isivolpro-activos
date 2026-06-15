import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ClipboardCheck, Clock3, Eye, ShieldCheck, UserPlus, Users, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import CollapsibleSection from '../components/Layout/CollapsibleSection';
import { useTenant } from '../hooks/useTenant';
import { listTenantMembers } from '../services/tenantService';
import { listInstallationAccessGrants, listTenantInvitations } from '../services/permissionService';
import { listInstallationsForTenant } from '../services/entityService';
import '../styles/userModule.css';

const ROLE_CARDS = [
  ['admin_cliente', 'Administrador del cliente', ShieldCheck, 'Control total', 'Gestiona inventario, usuarios, permisos, invitaciones, OT, auditoria y configuracion del cliente.', ['Inventario completo', 'Crear y borrar OT', 'Invitar usuarios', 'Desactivar usuarios', 'Ver auditoria']],
  ['tecnico', 'Tecnico propio', Wrench, 'Empresa', 'Tecnico interno de la empresa. Se puede asignar a cualquier OT de cualquier instalacion del cliente activo.', ['Mis OT asignadas', 'Visitas', 'Checklist', 'Fotos', 'Informe de OT']],
  ['tecnico_externo', 'Tecnico externo', Clock3, 'Puntual', 'Tecnico invitado para trabajos concretos. Se recomienda limitarlo a OT asignadas y accesos por instalacion.', ['OT asignadas', 'Acceso temporal', 'QR limitado', 'Sin administracion']],
  ['cliente_lectura', 'Cliente lectura', Eye, 'Consulta', 'Usuario de cliente que solo consulta informacion permitida, sin modificar datos tecnicos ni usuarios.', ['Ver inventario', 'Consultar documentos', 'Sin editar', 'Sin OT administrativas']]
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
    return {
      active: active.length,
      inactive: members.filter((member) => member.estado !== 'activo').length,
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
        action={<div className="button-row"><Link className="secondary-button" to="/auditoria"><ShieldCheck size={18} /> Auditoria</Link><Link className="primary-button" to="/usuarios"><UserPlus size={18} /> Gestionar usuarios</Link></div>}
      />
      {error && <p className="error-text">{error}</p>}

      <CollapsibleSection title="Resumen general" subtitle="Estado rapido del bloque de usuarios" icon={BarChart3} badge={`${stats.active} activos`} defaultOpen>
        <section className="grid metrics user-module-metrics">
          <article className="metric-card"><span>Usuarios activos</span><strong>{stats.active}</strong></article>
          <article className="metric-card warn"><span>Usuarios inactivos</span><strong>{stats.inactive}</strong></article>
          <article className="metric-card"><span>Tecnicos propios</span><strong>{stats.ownTechnicians}</strong></article>
          <article className="metric-card"><span>Invitaciones pendientes</span><strong>{stats.pendingInvitations}</strong></article>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title="Acciones rapidas" subtitle="Entradas principales para usuarios y OT" icon={Users} defaultOpen>
        <section className="grid two user-module-overview">
          <article className="card user-command-card"><div className="user-command-icon"><Users size={26} /></div><div><h2>Gestion diaria de usuarios</h2><p>Controla quien puede entrar, que rol tiene, si sigue activo y si necesita permisos especiales por instalacion.</p></div><div className="user-command-actions"><Link className="primary-button" to="/usuarios">Abrir usuarios y permisos</Link></div></article>
          <article className="card user-command-card"><div className="user-command-icon"><ClipboardCheck size={26} /></div><div><h2>Tecnicos y OT</h2><p>El tecnico propio no necesita permiso instalacion por instalacion: basta con asignarle una OT de cualquier instalacion del cliente.</p></div><div className="user-command-actions"><Link className="secondary-button" to="/ots">Gestionar OT</Link></div></article>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title="Roles y permisos" subtitle="Matriz de perfiles recomendados" icon={ShieldCheck} defaultOpen={false}>
        <div className="role-card-grid">
          {ROLE_CARDS.map(([role, title, Icon, badge, description, permissions]) => (
            <article className="role-card" key={role}><div className="role-card-header"><span className="role-card-icon"><Icon size={22} /></span><span className="badge">{badge}</span></div><h3>{title}</h3><p>{description}</p><div className="role-permission-list">{permissions.map((permission) => <span key={permission}>{permission}</span>)}</div></article>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Estado actual" subtitle="Administradores, tecnicos, clientes e instalaciones" icon={Users} defaultOpen={false}>
        <div className="user-status-list">
          <div><span>Administradores activos</span><strong>{stats.admins}</strong></div>
          <div><span>Tecnicos externos activos</span><strong>{stats.externalTechnicians}</strong></div>
          <div><span>Clientes lectura activos</span><strong>{stats.readOnlyClients}</strong></div>
          <div><span>Instalaciones del cliente</span><strong>{installations.length}</strong></div>
          <div><span>Accesos por instalacion activos</span><strong>{stats.activeGrants}</strong></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Flujo recomendado" subtitle="Como trabajar con usuarios y tecnicos" icon={ClipboardCheck} defaultOpen={false}>
        <div className="user-flow-list">
          {FLOW_STEPS.map(([number, title, text]) => <div className="user-flow-step" key={number}><strong>{number}</strong><div><span>{title}</span><p>{text}</p></div></div>)}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Regla de seguridad" subtitle="Por que no borramos usuarios desde la app" icon={AlertTriangle} defaultOpen={false} className="security-collapsible">
        <div className="user-security-note"><AlertTriangle size={22} /><div><strong>Regla de seguridad</strong><p>No se borran usuarios de Auth desde la app. Se desactivan para conservar historico, auditoria, OT, fotos e informes. Solo debe existir borrado tecnico en Supabase para casos muy concretos.</p></div></div>
      </CollapsibleSection>
    </>
  );
}
