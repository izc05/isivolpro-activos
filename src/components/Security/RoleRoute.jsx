import { Navigate } from 'react-router-dom';
import { useTenant } from '../../hooks/useTenant';

export function AdminRoute({ children }) {
  const { isTenantAdmin, roleLoading } = useTenant();

  if (roleLoading) return <p className="muted">Comprobando permisos...</p>;
  if (!isTenantAdmin) return <Navigate to="/mis-ots" replace />;
  return children;
}

export function HomeRedirect() {
  const { isTenantAdmin, roleLoading } = useTenant();

  if (roleLoading) return <p className="muted">Cargando acceso...</p>;
  return <Navigate to={isTenantAdmin ? '/dashboard' : '/mis-ots'} replace />;
}
