import PageHeader from '../components/Layout/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';

export default function Settings() {
  const { profile } = useAuth();
  const { activeTenant, activeRole, isTechnician } = useTenant();

  if (isTechnician) {
    return (
      <>
        <PageHeader title="Mi cuenta" subtitle="Datos basicos de acceso para el tecnico." />
        <section className="card">
          <h2>Cuenta</h2>
          <p><strong>Usuario:</strong> {profile?.nombre || profile?.email}</p>
          <p><strong>Email:</strong> {profile?.email || '-'}</p>
          <p><strong>Cliente:</strong> {activeTenant?.nombre || '-'}</p>
          <p><strong>Rol:</strong> {activeRole?.replaceAll('_', ' ') || 'tecnico'}</p>
          <p className="muted">Para cambios de permisos, nuevas instalaciones o problemas de acceso, contacta con el administrador.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Configuracion de cuenta, privacidad y seguridad." />
      <div className="grid two">
        <section className="card">
          <h2>Cuenta</h2>
          <p><strong>Usuario:</strong> {profile?.nombre || profile?.email}</p>
          <p><strong>Rol global:</strong> {profile?.global_role}</p>
          <p><strong>MFA admin:</strong> {profile?.mfa_required ? 'Requerido' : 'Preparado para activar'}</p>
        </section>
        <section className="card">
          <h2>Cliente activo</h2>
          <p><strong>Cliente:</strong> {activeTenant?.nombre || '-'}</p>
          <p><strong>Plan:</strong> {activeTenant?.plan || 'starter'}</p>
          <p><strong>Suscripcion:</strong> {activeTenant?.billing_status || 'trial'}</p>
          <p><strong>Limites:</strong> {activeTenant?.max_instalaciones || 5} instalaciones, {activeTenant?.max_activos || 100} activos, {activeTenant?.max_storage_mb || 1024} MB.</p>
        </section>
        <section className="card">
          <h2>Modelo de plataforma</h2>
          <p>IsiVoltPro usa un unico backend Supabase central para la aplicacion.</p>
          <p>Cada cliente se crea como tenant independiente y todos sus datos llevan tenant_id.</p>
          <p>Las politicas RLS impiden que un cliente, tecnico o usuario pueda leer datos de otro cliente.</p>
          <p>Si algun cliente grande pide aislamiento total, se podria crear un Supabase dedicado como modalidad enterprise.</p>
        </section>
        <section className="card">
          <h2>Privacidad y seguridad</h2>
          <p>Los QR no contienen datos personales ni rutas internas de documentos.</p>
          <p>El acceso requiere usuario autorizado y validacion por RLS.</p>
          <p>Los documentos privados no son publicos y se abren con URLs firmadas temporales.</p>
          <p>Las acciones importantes quedan registradas en auditoria.</p>
          <p>El cliente puede solicitar exportacion o eliminacion de datos.</p>
          <p>Arquitectura preparada para cumplimiento RGPD.</p>
        </section>
      </div>
    </>
  );
}
