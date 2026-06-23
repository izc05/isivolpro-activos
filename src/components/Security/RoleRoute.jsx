import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { canAccessRole } from '../../utils/permissions';

function PermissionRoute({ children, allowedRoles = [], fallback = '/denegado' }) {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { activeRole, activeTenantId, activeMember, roleLoading, loading: tenantLoading } = useTenant();

  if (authLoading || tenantLoading || roleLoading || (activeTenantId && activeMember === undefined && !isSuperAdmin)) return <p className="muted">Comprobando permisos...</p>;
  if (!canAccessRole(activeRole, allowedRoles, isSuperAdmin)) return <Navigate to={fallback} replace />;
  return children;
}

export function AdminRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador']} fallback="/denegado">{children}</PermissionRoute>;
}

export function CoordinatorRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador']} fallback="/denegado">{children}</PermissionRoute>;
}

export function InventoryRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador', 'cliente']} fallback="/denegado">{children}</PermissionRoute>;
}

export function MaintenanceRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador']} fallback="/denegado">{children}</PermissionRoute>;
}

export function OcaRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador', 'inspector_oca', 'cliente']} fallback="/denegado">{children}</PermissionRoute>;
}

export function WorkOrderManagerRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador']} fallback="/denegado">{children}</PermissionRoute>;
}

export function TechnicianRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador', 'tecnico']} fallback="/denegado">{children}</PermissionRoute>;
}

export function IncidentRoute({ children }) {
  return <PermissionRoute allowedRoles={['administrador', 'coordinador', 'tecnico']} fallback="/denegado">{children}</PermissionRoute>;
}

export function HomeRedirect() {
  const { loading: authLoading } = useAuth();
  const { isTenantAdmin, isCoordinator, isOcaInspector, canViewInventory, canUseWorkOrders, activeTenantId, roleLoading, loading: tenantLoading } = useTenant();

  if (authLoading || tenantLoading || roleLoading) return <p className="muted">Cargando acceso...</p>;
  if (isTenantAdmin || isCoordinator) return <Navigate to="/dashboard" replace />;
  if (canUseWorkOrders) return <Navigate to="/mis-ots" replace />;
  if (isOcaInspector) return <Navigate to="/oca" replace />;
  if (canViewInventory) return <Navigate to="/instalaciones" replace />;
  if (activeTenantId) return <Navigate to="/ajustes" replace />;
  return <Navigate to="/ajustes" replace />;
}

export function SuperAdminRoute({ children }) {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) return <p className="muted">Comprobando permisos...</p>;
  if (!isSuperAdmin) return <Navigate to="/denegado" replace />;
  return children;
}
