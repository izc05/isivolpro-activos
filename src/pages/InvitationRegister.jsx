import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import FormField from '../components/Forms/FormField';
import { acceptTenantInvitation } from '../services/permissionService';
import { claimDemoAccess, signOut, signUpDemoUser, signUpWithInvitationEmail } from '../services/authService';
import { useAuth } from '../hooks/useAuth';

function invitationErrorMessage(error, sessionEmail) {
  const raw = String(error?.message || error || '').toLowerCase();

  if (raw.includes('email does not match')) {
    return `Esta invitacion pertenece a otro email. Ahora estas conectado como ${sessionEmail || 'otro usuario'}. Cierra sesion y entra con el email invitado.`;
  }

  if (raw.includes('invalid or expired')) {
    return 'La invitacion no existe, ya fue aceptada/revocada o ha caducado. Crea una invitacion nueva desde Usuarios y permisos y envia el enlace nuevo al tecnico.';
  }

  if (raw.includes('authentication required')) {
    return 'Primero crea la cuenta con el email invitado y confirma el correo. Despues vuelve a este enlace para aceptar la invitacion.';
  }

  return error?.message || 'No se ha podido aceptar la invitacion.';
}

function isPositiveInvitationMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('aceptada') || text.includes('cuenta creada') || text.includes('correo confirmado');
}

export default function InvitationRegister() {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_SIGNUP === 'true';
  const [mode, setMode] = useState(demoEnabled ? 'demo' : 'invite');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [message, setMessage] = useState('');
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
      } catch (error) {
        acceptedTokenRef.current = '';
        setMessage(invitationErrorMessage(error, user?.email));
      }
    }

    completePendingInvitation();
  }, [isAuthenticated, token, user?.email]);

  async function submitInvitation(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (!isAuthenticated) {
        sessionStorage.setItem('pendingTenantInvitation', JSON.stringify({ email, token: token.trim() }));
        const { data, error } = await signUpWithInvitationEmail(email, password, token.trim());
        if (error) throw error;
        if (!data.session) {
          setMessage('Cuenta creada. Confirma el email. Si vuelves desde este movil intentaremos completar la invitacion automaticamente.');
          return;
        }
      }
      await acceptTenantInvitation(token.trim());
      sessionStorage.removeItem('pendingTenantInvitation');
      setMessage('Invitacion aceptada. Ya puedes entrar en la aplicacion.');
    } catch (error) {
      setMessage(invitationErrorMessage(error, user?.email));
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
          {message && <p className={isPositiveInvitationMessage(message) ? 'muted' : 'error-text'}>{message}</p>}
          <button className="primary-button" type="submit">Aceptar invitacion</button>
          {isAuthenticated && (
            <div className="invitation-session-box">
              <strong>Sesion actual</strong>
              <span>{user?.email || 'Usuario conectado'}</span>
              <small>La invitacion solo se puede aceptar con el mismo email al que se envio.</small>
              <button className="ghost-button" type="button" onClick={logoutForInvitation}>Cerrar sesion y usar otro email</button>
            </div>
          )}
          </form>
        )}
        <Link className="secondary-button" to="/login">Volver al login</Link>
      </div>
    </section>
  );
}
