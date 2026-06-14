import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { BarChart3, Building2, ChevronDown, ClipboardCheck, FileText, Home, ListChecks, MapPin, PenLine, QrCode, Settings, ShieldCheck, Users, Wrench, AlertTriangle, Image, Video } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import OfflineBanner from './OfflineBanner';

const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, permission: 'admin' },
  { to: '/scanner', label: 'Escaner', icon: QrCode, permission: 'all' }
];

const inventoryNavItems = [
  { to: '/clientes', label: 'Clientes', icon: Building2, permission: 'super_admin' },
  { to: '/instalaciones', label: 'Instalaciones', icon: Home, permission: 'inventory' },
  { to: '/ubicaciones', label: 'Ubicaciones', icon: MapPin, permission: 'inventory' },
  { to: '/activos', label: 'Activos', icon: Wrench, permission: 'inventory' },
  { to: '/documentos', label: 'Documentos', icon: FileText, permission: 'inventory' },
  { to: '/fotos', label: 'Fotos', icon: Image, permission: 'inventory' },
  { to: '/videos', label: 'Videos', icon: Video, permission: 'inventory' },
  { to: '/qr', label: 'QR', icon: QrCode, permission: 'qr' }
];

const operationsNavItems = [
  { to: '/ots-dashboard', label: 'Dashboard OT', icon: BarChart3, permission: 'workorders_manage' },
  { to: '/ots', label: 'Todas las OT', icon: ClipboardCheck, permission: 'workorders_manage' },
  { to: '/mis-ots', label: 'OT asignadas', icon: ListChecks, permission: 'workorders' },
  { to: '/ots-creadas', label: 'Creadas por mi', icon: PenLine, permission: 'workorders_manage' },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle, permission: 'incidents' },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck, permission: 'audit' },
  { to: '/usuarios', label: 'Usuarios', icon: Users, permission: 'users' },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, permission: 'all' }
];

export default function AppLayout() {
  const { isSuperAdmin, profile } = useAuth();
  const tenant = useTenant();
  const {
    tenants,
    activeTenantId,
    activeRole,
    activeRoleLabel,
    isTenantAdmin,
    isTechnician,
    canViewInventory,
    canManageWorkOrders,
    canUseWorkOrders,
    canManageUsers,
    canViewAudit,
    canUseQrGenerator,
    canCreateIncidents,
    setActiveTenantId
  } = tenant;
  const location = useLocation();
  const [inventoryOpen, setInventoryOpen] = useState(true);

  const canSeeItem = (item) => {
    if (item.permission === 'all') return true;
    if (item.permission === 'super_admin') return isSuperAdmin;
    if (item.permission === 'admin') return isTenantAdmin;
    if (item.permission === 'inventory') return canViewInventory;
    if (item.permission === 'qr') return canUseQrGenerator;
    if (item.permission === 'workorders_manage') return canManageWorkOrders;
    if (item.permission === 'workorders') return canUseWorkOrders || canManageWorkOrders;
    if (item.permission === 'incidents') return canCreateIncidents;
    if (item.permission === 'audit') return canViewAudit;
    if (item.permission === 'users') return canManageUsers;
    return false;
  };

  const visibleMainNavItems = mainNavItems.filter(canSeeItem);
  const visibleInventoryNavItems = inventoryNavItems.filter(canSeeItem);
  const visibleOperationsNavItems = operationsNavItems.filter(canSeeItem);
  const inventoryActive = visibleInventoryNavItems.some((item) => location.pathname.startsWith(item.to));
  const showInventoryGroup = visibleInventoryNavItems.length > 0;
  const showFullNavigation = isTenantAdmin || canViewInventory || canManageWorkOrders;
  const fallbackNavItems = visibleOperationsNavItems.filter((item) => ['/mis-ots', '/incidencias', '/ajustes'].includes(item.to));
  const desktopNavItems = showFullNavigation ? null : [...visibleMainNavItems, ...fallbackNavItems];
  const mobileNavItems = showFullNavigation
    ? [...visibleMainNavItems, ...visibleInventoryNavItems, ...visibleOperationsNavItems]
    : [...visibleMainNavItems, ...fallbackNavItems];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">IV</span>
          <div>
            <strong>IsiVoltPro</strong>
            <small>Activos QR</small>
          </div>
        </div>
        <nav className="nav-list">
          {desktopNavItems ? (
            desktopNavItems.map((item) => <NavItem key={item.to} item={item} />)
          ) : (
            <>
              {visibleMainNavItems.map((item) => <NavItem key={item.to} item={item} />)}
              {showInventoryGroup && (
                <div className={`nav-group ${inventoryActive ? 'active' : ''}`}>
                  <button className="nav-group-toggle" type="button" onClick={() => setInventoryOpen((current) => !current)} aria-expanded={inventoryOpen}>
                    <span>Inventario QR</span>
                    <ChevronDown size={16} />
                  </button>
                  {inventoryOpen && (
                    <div className="nav-group-items">
                      {visibleInventoryNavItems.map((item) => <NavItem key={item.to} item={item} />)}
                    </div>
                  )}
                </div>
              )}
              {visibleOperationsNavItems.map((item) => <NavItem key={item.to} item={item} />)}
            </>
          )}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <strong>{profile?.nombre || profile?.email || 'Usuario'}</strong>
            <span>{isTechnician ? 'Trabajo tecnico y OT asignadas' : 'Documentacion tecnica y mantenimiento por QR'}{activeRole ? ` · ${activeRoleLabel}` : ''}</span>
          </div>
          {tenants.length > 1 && (
            <select value={activeTenantId || ''} onChange={(event) => setActiveTenantId(event.target.value)}>
              {tenants.map((tenantItem) => <option key={tenantItem.id} value={tenantItem.id}>{tenantItem.nombre}</option>)}
            </select>
          )}
          <button className="ghost-button" onClick={signOut}>Cerrar sesion</button>
        </header>
        <OfflineBanner />
        <main className="content"><Outlet /></main>
      </div>

      <nav className="mobile-nav">
        {mobileNavItems.map((item) => <NavItem key={item.to} item={item} compact />)}
      </nav>
    </div>
  );
}

function NavItem({ item, compact = false }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={compact ? 20 : 18} />
      <span>{item.label}</span>
    </NavLink>
  );
}
