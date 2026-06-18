import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import FormField from '../components/Forms/FormField';
import { resetPassword, signIn } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import homeserveLogo from '../assets/homeserve/homeserve-logo-rojo-horizontal.png';
import homeserveHero from '../assets/homeserve/homeserve-luz-agua.jpg';

export default function Login() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const { error } = await signIn(email, password);
    if (error) setMessage(error.message);
  }

  async function handleReset() {
    if (!email) return setMessage('Introduce tu email para recuperar la contrasena.');
    const { error } = await resetPassword(email);
    setMessage(error ? error.message : 'Revisa tu correo para continuar.');
  }

  return (
    <section className="login-page">
      <div className="login-visual branded-login-visual" style={{ '--login-hero-image': `url(${homeserveHero})` }}>
        <img className="presentation-logo light-surface" src={homeserveLogo} alt="HomeServe" />
        <h1>Plataforma QR de activos e instalaciones</h1>
        <p>Demo de mantenimiento, reparaciones y seguimiento tecnico para HomeServe. Creado por IsiVoltPro.</p>
      </div>
      <form className="login-panel" onSubmit={handleSubmit}>
        <div>
          <img className="login-panel-logo" src={homeserveLogo} alt="HomeServe" />
          <h2>Acceso seguro</h2>
          <p className="muted">Entra con el email y la contrasena de tu cuenta. Si eres tecnico nuevo, primero necesitas una invitacion del administrador.</p>
        </div>
        <FormField label="Email"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></FormField>
        <FormField label="Contrasena"><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></FormField>
        {message && <p className="error-text">{message}</p>}
        <div className="login-actions">
          <button className="primary-button" type="submit">Entrar</button>
          <button className="ghost-button" type="button" onClick={handleReset}>Recuperar contrasena</button>
          <Link className="ghost-button" to="/registro">Tengo una invitacion</Link>
        </div>
      </form>
    </section>
  );
}
