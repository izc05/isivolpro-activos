import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BarChart3, Building2, CalendarClock, ChevronDown, ClipboardCheck, FileText, History, Home, ListChecks, MapPin, PanelLeftClose, PanelLeftOpen, PenLine, QrCode, Settings, ShieldCheck, Users, Wrench, AlertTriangle, Image, Video, UserCircle } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import OfflineBanner from './OfflineBanner';
import InstallAppButton from './InstallAppButton';
import homeserveLogo from '../../assets/homeserve/homeserve-logo-rojo-horizontal.png';

const mainNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: BarChart3, permission: 'admin' },
  { to: '/scanner', label: 'Escanear QR', icon: QrCode, permission: 'all' }
];

const inventoryNavItems = [
  { to: '/clientes', label: 'Clientes', icon: Building2, permission: 'admin' },
  { to: '/instalaciones', label: 'Instalaciones', icon: Home, permission: 'inventory' },
  { to: '/ubicaciones', label: 'Ubicaciones', icon: MapPin, permission: 'inventory' },
  { to: '/activos', label: 'Activos', icon: Wrench, permission: 'inventory' },
  { to: '/documentos', label: 'Documentos', icon: FileText, permission: 'inventory' },
  { to: '/fotos', label: 'Fotos', icon: Image, permission: 'inventory' },
  { to: '/videos', label: 'Videos', icon: Video, permission: 'inventory' },
  { to: '/qr', label: 'Generador QR', icon: QrCode, permission: 'qr' }
];

const workOrderNavItems = [
  { to: '/ots-dashboard', label: 'Panel OT', icon: BarChart3, permission: 'workorders_manage' },
  { to: '/ots-control', label: 'Control OT', icon: ClipboardCheck, permission: 'workorders_manage' },
  { to: '/ots', label: 'Todas las OT', icon: ClipboardCheck, permission: 'workorders_manage' },
  { to: '/ots-realizadas', label: 'OT realizadas', icon: CheckIcon, permission: 'workorders_manage' },
  { to: '/mis-ots', label: 'Mis OT asignadas', icon: ListChecks, permission: 'workorders' },
  { to: '/ots-creadas', label: 'OT creadas por mi', icon: PenLine, permission: 'workorders_manage' },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle, permission: 'incidents' }
];

const maintenanceNavItems = [
  { to: '/mantenimiento', label: 'Panel mantenimiento', icon: BarChart3, permission: 'inventory' },
  { to: '/mantenimiento/planes', label: 'Planes preventivos', icon: ClipboardCheck, permission: 'inventory' },
  { to: '/mantenimiento/calendario', label: 'Calendario', icon: CalendarClock, permission: 'inventory' },
  { to: '/mantenimiento/pendientes', label: 'Trabajos pendientes', icon: ListChecks, permission: 'inventory' },
  { to: '/mantenimiento/correctivos', label: 'Correctivos', icon: AlertTriangle, permission: 'inventory' },
  { to: '/mantenimiento/historial', label: 'Historial', icon: History, permission: 'inventory' }
];

const userNavItems = [
  { to: '/usuarios-panel', label: 'Panel usuarios', icon: Users, permission: 'users' },
  { to: '/usuarios', label: 'Gestion usuarios', icon: UserIcon, permission: 'users' },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck, permission: 'audit' },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, permission: 'all' }
];

function UserIcon(props) {
  return <Users {...props} />;
}

function CheckIcon(props) {
  return <ClipboardCheck {...props} />;
}

export default function AppLayout() {
  const { isSuperAdmin } = useAuth();
  const tenant = useTenant();
  const {
    tenants,
    activeTenantId,
    activeTenant,
    installations,
    activeInstallationId,
    activeInstallation,
    isTenantAdmin,
    canViewInventory,
    canManageWorkOrders,
    canUseWorkOrders,
    canManageUsers,
    canViewAudit,
    canUseQrGenerator,
    canCreateIncidents,
    setActiveTenantId,
    setActiveInstallationId
  } = tenant;
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({ inventory: true, maintenance: true, workorders: true, users: true });
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('isivoltpro-sidebar-hidden') === 'true');
  const isGlobalWorkOrderControl = location.pathname.startsWith('/ots-control');

  useEffect(() => {
    localStorage.setItem('isivoltpro-sidebar-hidden', sidebarHidden ? 'true' : 'false');
  }, [sidebarHidden]);

  const canSeeItem = (item) => {
    if (item.permission === 'all') return true;
    if (item.permission === 'super_admin') return isSuperAdmin;
    if (item.permission === 'admin') return isTenantAdmin || isSuperAdmin;
    if (item.permission === 'inventory') return canViewInventory;
    if (item.permission === 'qr') return canUseQrGenerator;
    if (item.permission === 'workorders_manage') return canManageWorkOrders;
    if (item.permission === 'workorders') return canUseWorkOrders || canManageWorkOrders;
    if (item.permission === 'incidents') return canCreateIncidents;
    if (item.permission === 'audit') return canViewAudit;
    if (item.permission === 'users') return canManageUsers;
    return false;
  };

  const toggleGroup = (group) => setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  const groupActive = (items) => items.some((item) => location.pathname.startsWith(item.to));

  const visibleMainNavItems = mainNavItems.filter(canSeeItem);
  const visibleInventoryNavItems = inventoryNavItems.filter(canSeeItem);
  const visibleMaintenanceNavItems = maintenanceNavItems.filter(canSeeItem);
  const visibleWorkOrderNavItems = workOrderNavItems.filter(canSeeItem);
  const visibleUserNavItems = userNavItems.filter(canSeeItem);

  const showFullNavigation = isTenantAdmin || canViewInventory || canManageWorkOrders || canManageUsers;
  const fallbackNavItems = [...visibleWorkOrderNavItems, ...visibleUserNavItems].filter((item) => ['/mis-ots', '/incidencias', '/ajustes'].includes(item.to));
  const desktopNavItems = showFullNavigation ? null : [...visibleMainNavItems, ...fallbackNavItems];
  const allMobileNavItems = showFullNavigation
    ? [...visibleMainNavItems, ...visibleInventoryNavItems, ...visibleMaintenanceNavItems, ...visibleWorkOrderNavItems, ...visibleUserNavItems]
    : [...visibleMainNavItems, ...fallbackNavItems];
  const preferredMobileRoutes = ['/dashboard', '/activos', '/mantenimiento', '/incidencias', '/ajustes'];
  const mobileNavItems = preferredMobileRoutes
    .map((route) => allMobileNavItems.find((item) => item.to === route))
    .filter(Boolean);

  return (
    <div className={`app-shell ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <div className="brand-lockup">
            <img className="brand-logo-img" src={homeserveLogo} alt="HomeServe" />
            <div>
              <strong>HomeServe</strong>
              <small>Activos QR por IsiVoltPro</small>
            </div>
          </div>
          <button className="sidebar-icon-button" type="button" onClick={() => setSidebarHidden(true)} title="Ocultar menu lateral" aria-label="Ocultar menu lateral">
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav className="nav-list">
          {desktopNavItems ? (
            desktopNavItems.map((item) => <NavItem key={item.to} item={item} />)
          ) : (
            <>
              {visibleMainNavItems.map((item) => <NavItem key={item.to} item={item} />)}
              <NavGroup title="Bloque Inventario" items={visibleInventoryNavItems} open={openGroups.inventory} active={groupActive(visibleInventoryNavItems)} onToggle={() => toggleGroup('inventory')} />
              <NavGroup title="Bloque Mantenimiento" items={visibleMaintenanceNavItems} open={openGroups.maintenance} active={groupActive(visibleMaintenanceNavItems)} onToggle={() => toggleGroup('maintenance')} />
              <NavGroup title="Bloque OT" items={visibleWorkOrderNavItems} open={openGroups.workorders} active={groupActive(visibleWorkOrderNavItems)} onToggle={() => toggleGroup('workorders')} />
              <NavGroup title="Bloque Usuarios" items={visibleUserNavItems} open={openGroups.users} active={groupActive(visibleUserNavItems)} onToggle={() => toggleGroup('users')} />
            </>
          )}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar app-topbar-context">
          {sidebarHidden && (
            <button className="ghost-button topbar-menu-button" type="button" onClick={() => setSidebarHidden(false)}>
              <PanelLeftOpen size={18} /> Menu
            </button>
          )}
          {!isGlobalWorkOrderControl && (
            <div className="topbar-selectors">
              {tenants.length > 0 && (
                <label className="topbar-selector client-selector">
                  <span>Cliente activo</span>
                  <select value={activeTenantId || ''} onChange={(event) => setActiveTenantId(event.target.value)}>
                    {tenants.map((tenantItem) => (
                      <option key={tenantItem.id} value={tenantItem.id}>{tenantItem.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
              {installations.length > 0 && (
                <label className="topbar-selector active-installation-selector">
                  <span>Instalacion activa</span>
                  <select value={activeInstallationId || ''} onChange={(event) => setActiveInstallationId(event.target.value)}>
                    {installations.map((installation) => (
                      <option key={installation.id} value={installation.id}>{installation.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
              {activeTenant && activeInstallation && <span className="active-installation-pill">{activeTenant.nombre} · {activeInstallation.nombre}</span>}
              {!activeInstallation && activeTenant && <span className="active-installation-pill muted">Cliente: {activeTenant.nombre}</span>}
            </div>
          )}
          {isGlobalWorkOrderControl && <div className="topbar-global-context">Control global OT · Sin filtro de cliente o instalacion</div>}
          <NavLink className="primary-button topbar-scan-button" to="/scanner"><QrCode size={18} /> Escanear QR</NavLink>
          <InstallAppButton />
          <NavLink className="ghost-button topbar-profile-button" to="/ajustes"><UserCircle size={18} /> Perfil</NavLink>
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

function NavGroup({ title, items, open, active, onToggle }) {
  if (!items.length) return null;
  return (
    <div className={`nav-group ${active ? 'active' : ''}`}>
      <button className="nav-group-toggle" type="button" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="nav-group-items">
          {items.map((item) => <NavItem key={item.to} item={item} />)}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, compact = false }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} className={({ isActive }) => `nav-item ${compact ? 'compact' : ''} ${isActive ? 'active' : ''}`}>
      <Icon size={20} />
      <span>{item.label}</span>
    </NavLink>
  );
}
