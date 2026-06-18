import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import FormField from '../components/Forms/FormField';
import { acceptTenantInvitation } from '../services/permissionService';
import { claimDemoAccess, resendInvitationConfirmationEmail, signOut, signUpDemoUser, signUpWithInvitationEmail } from '../services/authService';
import { useAuth } from '../hooks/useAuth';

function isPositiveInvitationMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('aceptada') || text.includes('cuenta creada') || text.includes('correo confirmado');
}

export default function InvitationRegister() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_SIGNUP === 'true';
  const [mode, setMode] = useState(demoEnabled ? 'demo' : 'invite');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [message, setMessage] = useState('');
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const acceptedTokenRef = useRef('');

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
        setNeedsEmailConfirmation(false);
      } catch (error) {
        setMessage(error.message);
      }
    }

    completePendingDemoAccess();
  }, [demoEnabled, isAuthenticated]);

  useEffect(() => {
    async function completePendingInvitation() {
      if (!isAuthenticated) return;
      const pending = sessionStorage.getItem('pendingTenantInvitation');

      try {
        const pendingData = pending ? JSON.parse(pending) : {};
        const tokenToAccept = token || pendingData.token || '';
        if (!tokenToAccept || acceptedTokenRef.current === tokenToAccept) return;
        acceptedTokenRef.current = tokenToAccept;
        if (pendingData.email) setEmail(pendingData.email);
        if (!token) setToken(tokenToAccept);
        await acceptTenantInvitation(tokenToAccept);
        sessionStorage.removeItem('pendingTenantInvitation');
        setMessage('Correo confirmado e invitacion aceptada. Ya puedes entrar en la aplicacion.');
        setNeedsEmailConfirmation(false);
      } catch (error) {
        acceptedTokenRef.current = '';
        setMessage(error.message);
      }
    }

    completePendingInvitation();
  }, [isAuthenticated, token]);

  async function submitInvitation(event) {
    event.preventDefault();
    setMessage('');
    setNeedsEmailConfirmation(false);
    try {
      if (!isAuthenticated) {
        sessionStorage.setItem('pendingTenantInvitation', JSON.stringify({ email, token: token.trim() }));
        const { data, error } = await signUpWithInvitationEmail(email, password, token.trim());
        if (error) throw error;
        if (!data.session) {
          setNeedsEmailConfirmation(true);
          setMessage('Cuenta creada. Falta confirmar el email. Revisa la bandeja de entrada y spam. Si no llega, pulsa Reenviar correo de confirmacion.');
          return;
        }
      }
      await acceptTenantInvitation(token.trim());
      sessionStorage.removeItem('pendingTenantInvitation');
      setMessage('Invitacion aceptada. Ya puedes entrar en la aplicacion.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resendConfirmation() {
    setMessage('');
    setResending(true);
    try {
      const { error } = await resendInvitationConfirmationEmail(email, token.trim());
      if (error) throw error;
      setNeedsEmailConfirmation(true);
      setMessage('Correo de confirmacion reenviado. Revisa Recibidos, Spam, Promociones o Todos.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setResending(false);
    }
  }

  async function logoutForInvitation() {
    await signOut();
    window.location.reload();
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
        <h1>Alta de usuario</h1>
        <p>El administrador crea la invitacion. El tecnico define su propia contrasena y queda unido al cliente correcto.</p>
      </div>
      <div className="login-panel">
        <h2>{mode === 'demo' ? 'Nuevo usuario demo' : 'Aceptar invitacion'}</h2>
        <div className="segmented">
          {demoEnabled && <button className={mode === 'demo' ? 'active' : ''} type="button" onClick={() => setMode('demo')}>Usuario demo</button>}
          <button className={mode === 'invite' ? 'active' : ''} type="button" onClick={() => setMode('invite')}>Invitacion admin</button>
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
            <div className="access-help">
              <strong>Como debe entrar un tecnico</strong>
              <span>1. El administrador crea la invitacion desde Usuarios y permisos.</span>
              <span>2. El tecnico abre el enlace recibido o pega el token.</span>
              <span>3. El tecnico escribe su propia contrasena. No hace falta que el admin la conozca.</span>
            </div>
          {!isAuthenticated && (
            <>
              <FormField label="Email invitado">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </FormField>
              <FormField label="Contrasena">
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" autoComplete="new-password" required />
              </FormField>
            </>
          )}
          <FormField label="Token de invitacion">
            <input value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="Token temporal" autoComplete="one-time-code" required />
          </FormField>
          {message && <p className={isPositiveInvitationMessage(message) || message.includes('reenviado') ? 'muted' : 'error-text'}>{message}</p>}
          {needsEmailConfirmation && !isAuthenticated && (
            <div className="access-help">
              <strong>No me llega el correo</strong>
              <span>Revisa Spam, Promociones y Todos. En Gmail a veces tarda unos minutos.</span>
              <span>Si sigue sin llegar, el administrador debe revisar en Supabase: Auth &gt; URL Configuration y Auth &gt; Email Templates.</span>
              <button className="secondary-button" type="button" disabled={resending || !email} onClick={resendConfirmation}>
                {resending ? 'Reenviando...' : 'Reenviar correo de confirmacion'}
              </button>
            </div>
          )}
          <button className="primary-button" type="submit">Aceptar invitacion</button>
          {isAuthenticated && <p className="muted">Ya has iniciado sesion. Solo falta aceptar el token para unir esta cuenta al cliente.</p>}
          </form>
        )}
        <Link className="secondary-button" to="/login">Volver al login</Link>
      </div>
    </section>
  );
}
