import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import FormField from '../components/Forms/FormField';
import { acceptTenantInvitation } from '../services/permissionService';
import { claimDemoAccess, signUpDemoUser, signUpWithInvitationEmail } from '../services/authService';
import { useAuth } from '../hooks/useAuth';

export default function InvitationRegister() {
  const { isAuthenticated } = useAuth();
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_SIGNUP === 'true';
  const [mode, setMode] = useState(demoEnabled ? 'demo' : 'invite');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function completePendingDemoAccess() {
      if (!demoEnabled || !isAuthenticated) return;
      const pending = sessionStorage.getItem('pendingDemoSignup');
      if (!pending) return;

      try {
        const parsed = JSON.parse(pending);
        const { error } = await claimDemoAccess(parsed.nombre || '');
        if (error) throw error;
        sessionStorage.removeItem('pendingDemoSignup');
        setMessage('Correo confirmado y acceso demo preparado. Ya puedes entrar en la aplicacion.');
      } catch (error) {
        setMessage(error.message);
      }
    }

    completePendingDemoAccess();
  }, [demoEnabled, isAuthenticated]);

  async function submitInvitation(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (!isAuthenticated) {
        const { data, error } = await signUpWithInvitationEmail(email, password);
        if (error) throw error;
        if (!data.session) {
          setMessage('Cuenta creada. Confirma el email y vuelve a aceptar la invitacion con el token.');
          return;
        }
      }
      await acceptTenantInvitation(token.trim());
      setMessage('Invitacion aceptada. Ya puedes entrar en la aplicacion.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitDemo(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (isAuthenticated) {
        const { error } = await claimDemoAccess(nombre);
        if (error) throw error;
        setMessage('Usuario demo preparado. Ya puedes entrar en la aplicacion.');
        return;
      }

      sessionStorage.setItem('pendingDemoSignup', JSON.stringify({ nombre, email }));
      const { error, pendingEmailConfirmation } = await signUpDemoUser({ nombre, email, password });
      if (error) throw error;
      if (pendingEmailConfirmation) {
        setMessage('Cuenta creada. Confirma el email y despues entra desde Login.');
        return;
      }
      sessionStorage.removeItem('pendingDemoSignup');
      setMessage('Usuario demo creado. Ya puedes entrar en la aplicacion.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function completeDemoManually() {
    setMessage('');
    try {
      const { error } = await claimDemoAccess(nombre);
      if (error) throw error;
      sessionStorage.removeItem('pendingDemoSignup');
      setMessage('Acceso demo preparado. Ya puedes entrar en la aplicacion.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="login-page">
      <div className="login-visual">
        <h1>Registro IsiVoltPro</h1>
        <p>Crea un usuario demo o acepta una invitacion temporal de un administrador.</p>
      </div>
      <div className="login-panel">
        <h2>{mode === 'demo' ? 'Nuevo usuario demo' : 'Registro por invitacion'}</h2>
        <div className="segmented">
          {demoEnabled && <button className={mode === 'demo' ? 'active' : ''} type="button" onClick={() => setMode('demo')}>Usuario demo</button>}
          <button className={mode === 'invite' ? 'active' : ''} type="button" onClick={() => setMode('invite')}>Tengo token</button>
        </div>

        {mode === 'demo' && (
          <form className="form-grid" onSubmit={submitDemo}>
            <p className="muted">Este acceso asigna tu cuenta al cliente demo Comunidad Los Olivos.</p>
            <FormField label="Nombre">
              <input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Tu nombre" />
            </FormField>
            {!isAuthenticated && (
              <>
                <FormField label="Email">
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </FormField>
                <FormField label="Contrasena">
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required />
                </FormField>
              </>
            )}
            {message && <p className={message.includes('cread') || message.includes('preparado') ? 'muted' : 'error-text'}>{message}</p>}
            <button className="primary-button" type="submit">Registrarme como usuario demo</button>
            {isAuthenticated && <button className="secondary-button" type="button" onClick={completeDemoManually}>Completar acceso demo</button>}
          </form>
        )}

        {mode === 'invite' && (
          <form className="form-grid" onSubmit={submitInvitation}>
            <p className="muted">El token se valida con hash seguro, email coincidente y caducidad temporal.</p>
          {!isAuthenticated && (
            <>
              <FormField label="Email invitado">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </FormField>
              <FormField label="Contrasena">
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required />
              </FormField>
            </>
          )}
          <FormField label="Token de invitacion">
            <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token temporal" required />
          </FormField>
          {message && <p className={message.includes('aceptada') ? 'muted' : 'error-text'}>{message}</p>}
          <button className="primary-button" type="submit">Aceptar invitacion</button>
          </form>
        )}
        <Link className="primary-button" to="/login">Volver al login</Link>
      </div>
    </section>
  );
}
