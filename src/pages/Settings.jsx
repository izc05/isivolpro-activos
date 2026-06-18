import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Building2, CheckCircle2, FileText, HelpCircle, KeyRound, LifeBuoy, LockKeyhole, QrCode, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';

const ROLE_LABELS = {
  admin_cliente: 'Administrador',
  tecnico: 'Tecnico propio',
  tecnico_externo: 'Tecnico externo',
  cliente_lectura: 'Cliente lectura'
};

const DOC_SECTIONS = [
  {
    title: 'Primeros pasos',
    icon: CheckCircle2,
    items: [
      'Crear o revisar el cliente activo.',
      'Dar de alta instalaciones, ubicaciones y activos.',
      'Generar QR internos o QR publicos de aviso.',
      'Crear usuarios e invitaciones segun el rol real.'
    ]
  },
  {
    title: 'Usuarios y permisos',
    icon: UserRound,
    items: [
      'Administrador: gestiona cliente, usuarios, inventario, QR, OT y auditoria.',
      'Tecnico propio: trabaja sobre OT asignadas de cualquier instalacion del cliente.',
      'Tecnico externo: se limita a OT o accesos concretos por instalacion.',
      'Cliente lectura: consulta informacion permitida sin modificar datos.'
    ]
  },
  {
    title: 'Ordenes de trabajo',
    icon: Wrench,
    items: [
      'Crear OT desde incidencias, activos o el modulo de OT.',
      'Registrar visita, checklist, fotos, materiales y firma.',
      'Generar informe PDF y validar la OT antes de cerrarla.',
      'Consultar OT realizadas desde el historial.'
    ]
  },
  {
    title: 'Documentos y QR',
    icon: QrCode,
    items: [
      'El QR interno solo contiene un token opaco.',
      'Los documentos privados se abren con URL firmada temporal.',
      'El QR publico permite reportar avisos sin mostrar datos internos.',
      'Revocar o regenerar accesos cuando cambie el personal.'
    ]
  }
];

function InfoRow({ label, value }) {
  return (
    <div className="settings-info-row">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function DocumentationSection({ section }) {
  const Icon = section.icon;
  return (
    <article className="settings-doc-card">
      <span className="settings-card-icon"><Icon size={20} /></span>
      <div>
        <h3>{section.title}</h3>
        <ul>
          {section.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </article>
  );
}

export default function Settings() {
  const { profile } = useAuth();
  const { activeTenant, activeRole, isTechnician } = useTenant();
  const [activeTab, setActiveTab] = useState('resumen');

  if (!activeTenant) {
    return (
      <>
        <PageHeader title="Cuenta sin empresa activa" subtitle="Tu usuario existe, pero aun no esta unido a una empresa de IsiVoltPro." />
        <section className="card account-warning-card">
          <h2>Falta aceptar la invitacion</h2>
          <p><strong>Usuario:</strong> {profile?.nombre || profile?.email || '-'}</p>
          <p><strong>Email:</strong> {profile?.email || '-'}</p>
          <p className="warning-text">Esta cuenta no tiene cliente activo. Por eso no puedes administrar usuarios ni ver las instalaciones de la empresa.</p>
          <div className="access-help">
            <strong>Que hacer ahora</strong>
            <span>Si eres tecnico: vuelve a abrir el enlace de invitacion o pulsa aceptar invitacion y pega el token que recibiste.</span>
            <span>Si eres administrador: cierra sesion y entra con la cuenta admin de la empresa.</span>
            <span>Si el token ha caducado, el administrador debe crear una invitacion nueva.</span>
          </div>
          <div className="quick-actions">
            <Link className="primary-button" to="/registro">Aceptar invitacion</Link>
            <Link className="secondary-button" to="/login">Volver al login</Link>
          </div>
        </section>
      </>
    );
  }

  if (isTechnician) {
    return (
      <>
        <PageHeader title="Mi cuenta" subtitle="Datos basicos de acceso y guia rapida para el tecnico." />
        <div className="settings-tech-layout">
          <section className="card">
            <h2>Cuenta</h2>
            <InfoRow label="Usuario" value={profile?.nombre || profile?.email} />
            <InfoRow label="Email" value={profile?.email} />
            <InfoRow label="Cliente" value={activeTenant?.nombre} />
            <InfoRow label="Rol" value={ROLE_LABELS[activeRole] || activeRole || 'Tecnico'} />
          </section>
          <section className="card">
            <h2>Guia de trabajo</h2>
            <div className="settings-steps">
              <span>1. Abre tus OT asignadas desde Mis OT.</span>
              <span>2. Registra visita, checklist, fotos y materiales.</span>
              <span>3. Recoge firma cuando corresponda.</span>
              <span>4. Finaliza para que el administrador valide el informe.</span>
            </div>
            <div className="quick-actions">
              <Link className="primary-button" to="/mis-ots"><Wrench size={18} /> Mis OT</Link>
              <Link className="secondary-button" to="/scanner"><QrCode size={18} /> Escanear QR</Link>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Configuracion, documentacion y seguridad operativa del cliente activo."
        action={<Link className="secondary-button" to="/privacidad"><FileText size={18} /> Privacidad</Link>}
      />

      <div className="settings-tabs" role="tablist" aria-label="Secciones de ajustes">
        <button className={activeTab === 'resumen' ? 'active' : ''} type="button" onClick={() => setActiveTab('resumen')}><Building2 size={18} /> Resumen</button>
        <button className={activeTab === 'documentacion' ? 'active' : ''} type="button" onClick={() => setActiveTab('documentacion')}><BookOpen size={18} /> Documentacion</button>
        <button className={activeTab === 'seguridad' ? 'active' : ''} type="button" onClick={() => setActiveTab('seguridad')}><ShieldCheck size={18} /> Seguridad</button>
        <button className={activeTab === 'soporte' ? 'active' : ''} type="button" onClick={() => setActiveTab('soporte')}><LifeBuoy size={18} /> Soporte</button>
      </div>

      {activeTab === 'resumen' && (
        <div className="settings-grid">
          <section className="card settings-panel">
            <span className="settings-card-icon"><UserRound size={20} /></span>
            <h2>Cuenta</h2>
            <InfoRow label="Usuario" value={profile?.nombre || profile?.email} />
            <InfoRow label="Email" value={profile?.email} />
            <InfoRow label="Rol global" value={profile?.global_role || 'usuario'} />
            <InfoRow label="MFA admin" value={profile?.mfa_required ? 'Requerido' : 'Preparado para activar'} />
          </section>
          <section className="card settings-panel">
            <span className="settings-card-icon"><Building2 size={20} /></span>
            <h2>Cliente activo</h2>
            <InfoRow label="Cliente" value={activeTenant?.nombre} />
            <InfoRow label="Plan" value={activeTenant?.plan || 'starter'} />
            <InfoRow label="Suscripcion" value={activeTenant?.billing_status || 'trial'} />
            <InfoRow label="Limites" value={`${activeTenant?.max_instalaciones || 5} instalaciones, ${activeTenant?.max_activos || 100} activos, ${activeTenant?.max_storage_mb || 1024} MB`} />
          </section>
          <section className="card settings-panel settings-wide">
            <span className="settings-card-icon"><HelpCircle size={20} /></span>
            <h2>Accesos rapidos</h2>
            <div className="settings-action-grid">
              <Link className="secondary-button" to="/usuarios"><UserRound size={18} /> Usuarios y permisos</Link>
              <Link className="secondary-button" to="/qr"><QrCode size={18} /> Generar QR</Link>
              <Link className="secondary-button" to="/ots"><Wrench size={18} /> Ordenes de trabajo</Link>
              <Link className="secondary-button" to="/auditoria"><ShieldCheck size={18} /> Auditoria</Link>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'documentacion' && (
        <div className="settings-doc-grid">
          {DOC_SECTIONS.map((section) => <DocumentationSection key={section.title} section={section} />)}
        </div>
      )}

      {activeTab === 'seguridad' && (
        <div className="settings-grid">
          <section className="card settings-panel">
            <span className="settings-card-icon"><LockKeyhole size={20} /></span>
            <h2>Modelo de plataforma</h2>
            <p>IsiVoltPro usa un backend Supabase central con separacion por cliente mediante tenant_id.</p>
            <p>Las politicas RLS validan que cada usuario lea y modifique solo datos permitidos del cliente activo.</p>
            <p>Para clientes enterprise se puede estudiar aislamiento dedicado por proyecto.</p>
          </section>
          <section className="card settings-panel">
            <span className="settings-card-icon"><KeyRound size={20} /></span>
            <h2>Privacidad y trazabilidad</h2>
            <p>Los QR no contienen datos personales ni rutas internas.</p>
            <p>Los documentos privados se abren con URLs firmadas temporales.</p>
            <p>Las acciones relevantes quedan registradas en auditoria.</p>
            <p>Arquitectura preparada para exportacion o eliminacion de datos bajo solicitud.</p>
          </section>
        </div>
      )}

      {activeTab === 'soporte' && (
        <div className="settings-grid">
          <section className="card settings-panel">
            <span className="settings-card-icon"><LifeBuoy size={20} /></span>
            <h2>Checklist de soporte</h2>
            <div className="settings-steps">
              <span>1. Confirma cliente activo y rol del usuario.</span>
              <span>2. Revisa invitaciones pendientes o caducadas.</span>
              <span>3. Comprueba que la instalacion y la OT pertenecen al mismo cliente.</span>
              <span>4. Consulta auditoria si hay dudas sobre accesos, descargas o cambios.</span>
            </div>
          </section>
          <section className="card settings-panel">
            <span className="settings-card-icon"><BookOpen size={20} /></span>
            <h2>Documentacion pendiente</h2>
            <p>Revisar el texto legal final de privacidad con asesoramiento externo.</p>
            <p>Preparar una guia PDF para administradores y una guia corta para tecnicos.</p>
            <p>Definir procedimiento de baja de cliente y exportacion de datos.</p>
            <div className="quick-actions">
              <Link className="primary-button" to="/privacidad">Abrir privacidad</Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
