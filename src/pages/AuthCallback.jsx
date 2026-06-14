import { Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function AuthCallback() {
  const { isAuthenticated, loading } = useAuth();
  const hasAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token=');
  const hasError = window.location.hash.includes('error=');

  if (isAuthenticated) return <Navigate to="/registro" replace />;

  return (
    <section className="login-page">
      <div className="login-visual">
        <h1>IsiVoltPro</h1>
        <p>Confirmacion segura de cuenta para tecnicos y administradores.</p>
      </div>
      <div className="login-panel auth-callback-panel">
        {hasError ? (
          <>
            <h2>No se pudo confirmar</h2>
            <p className="error-text">El enlace de confirmacion no es valido o ha caducado. Solicita una nueva invitacion al administrador.</p>
            <Link className="secondary-button" to="/login">Volver al login</Link>
          </>
        ) : (
          <>
            <div className="success-icon">{loading || hasAuthHash ? <Loader2 size={26} className="spin" /> : <CheckCircle2 size={26} />}</div>
            <h2>Confirmando correo</h2>
            <p className="muted">Estamos validando tu cuenta. Si no avanza automaticamente, vuelve al registro y pega el token de invitacion.</p>
            <Link className="primary-button" to="/registro">Continuar al registro</Link>
          </>
        )}
      </div>
    </section>
  );
}
