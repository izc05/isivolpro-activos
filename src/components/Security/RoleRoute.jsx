import { Navigate } from 'react-router-dom';
import { useTenant } from '../../hooks/useTenant';

export function AdminRoute({ children }) {
  const { isTenantAdmin, isTechnician, roleLoading } = useTenant();

  if (roleLoading) return <p className="muted">Comprobando permisos...</p>;
  if (!isTenantAdmin && isTechnician) return <Navigate to="/mis-ots" replace />;
  return children;
}

export function HomeRedirect() {
  const { isTechnician, roleLoading } = useTenant();

  if (roleLoading) return <p className="muted">Cargando acceso...</p>;
  return <Navigate to={isTechnician ? '/mis-ots' : '/dashboard'} replace />;
}
