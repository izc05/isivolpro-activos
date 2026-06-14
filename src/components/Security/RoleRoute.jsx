import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { canAccessRole } from '../../utils/permissions';

function PermissionRoute({ children, allowedRoles = [], fallback = '/denegado' }) {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { activeRole, roleLoading, loading: tenantLoading } = useTenant();

  if (authLoading || tenantLoading || roleLoading) return <p className="muted">Comprobando permisos...</p>;
  if (!canAccessRole(activeRole, allowedRoles, isSuperAdmin)) return <Navigate to={fallback} replace />;
  return children;
}

export function AdminRoute({ children }) {
  return <PermissionRoute allowedRoles={['admin_cliente']} fallback="/mis-ots">{children}</PermissionRoute>;
}

export function InventoryRoute({ children }) {
  return <PermissionRoute allowedRoles={['admin_cliente', 'tecnico', 'cliente_lectura']} fallback="/scanner">{children}</PermissionRoute>;
}

export function WorkOrderManagerRoute({ children }) {
  return <PermissionRoute allowedRoles={['admin_cliente']} fallback="/mis-ots">{children}</PermissionRoute>;
}

export function TechnicianRoute({ children }) {
  return <PermissionRoute allowedRoles={['admin_cliente', 'tecnico', 'tecnico_externo']} fallback="/scanner">{children}</PermissionRoute>;
}

export function HomeRedirect() {
  const { loading: authLoading } = useAuth();
  const { isTenantAdmin, canViewInventory, canUseWorkOrders, activeTenantId, roleLoading, loading: tenantLoading } = useTenant();

  if (authLoading || tenantLoading || roleLoading) return <p className="muted">Cargando acceso...</p>;
  if (isTenantAdmin) return <Navigate to="/dashboard" replace />;
  if (canUseWorkOrders) return <Navigate to="/mis-ots" replace />;
  if (canViewInventory) return <Navigate to="/instalaciones" replace />;
  if (activeTenantId) return <Navigate to="/scanner" replace />;
  return <Navigate to="/ajustes" replace />;
}

export function SuperAdminRoute({ children }) {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) return <p className="muted">Comprobando permisos...</p>;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
