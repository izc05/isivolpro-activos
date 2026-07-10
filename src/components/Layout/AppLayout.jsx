import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BarChart3, Building2, CalendarClock, ChevronDown, ClipboardCheck, FileText, History, Home, ListChecks, MapPin, PanelLeftClose, PanelLeftOpen, QrCode, Settings, ShieldCheck, Users, Wrench, AlertTriangle, Image, Video, UserCircle, FileWarning } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import OfflineBanner from './OfflineBanner';
import InstallAppButton from './InstallAppButton';
import NotificationBell from './NotificationBell';
import WorkContextSelector from './WorkContextSelector';
import homeserveLogo from '../../assets/homeserve/homeserve-logo-rojo-horizontal.png';
import GlobalSearch from '../Search/GlobalSearch';

const mainNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: BarChart3, permission: 'admin' },
  { to: '/scanner', label: 'Escanear QR', mobileLabel: 'Escanear', icon: QrCode, permission: 'all' }
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
  {
    to: '/ots-dashboard',
    label: 'Panel OT',
    icon: BarChart3,
    permission: 'workorders_manage',
    activePaths: ['/ots-dashboard']
  },
  {
    to: '/ots',
    label: 'Órdenes de trabajo',
    icon: ClipboardCheck,
    permission: 'workorders_manage',
    activePaths: ['/ots', '/ots-realizadas', '/mis-ots', '/ots-creadas']
  },
  {
    to: '/ots-control',
    label: 'Planificación',
    icon: CalendarClock,
    permission: 'workorders_manage',
    activePaths: ['/ots-control', '/ots-agenda']
  },
  {
    to: '/incidencias',
    label: 'Incidencias',
    mobileLabel: 'Avisos',
    icon: AlertTriangle,
    permission: 'incidents',
    activePaths: ['/incidencias']
  }
];

const technicianNavItems = [
  {
    to: '/mis-ots',
    label: 'Mis OT',
    mobileLabel: 'Mis OT',
    icon: ListChecks,
    permission: 'workorders',
    activePaths: ['/mis-ots', '/ots']
  },
  {
    to: '/incidencias',
    label: 'Incidencias',
    mobileLabel: 'Avisos',
    icon: AlertTriangle,
    permission: 'incidents',
    activePaths: ['/incidencias']
  }
];

const maintenanceNavItems = [
  { to: '/mantenimiento', label: 'Panel mantenimiento', icon: BarChart3, permission: 'maintenance' },
  { to: '/mantenimiento/planes', label: 'Planes preventivos', icon: ClipboardCheck, permission: 'maintenance' },
  { to: '/mantenimiento/calendario', label: 'Calendario', icon: CalendarClock, permission: 'maintenance' },
  { to: '/mantenimiento/pendientes', label: 'Trabajos pendientes', icon: ListChecks, permission: 'maintenance' },
  { to: '/mantenimiento/correctivos', label: 'Correctivos', icon: AlertTriangle, permission: 'maintenance' },
  { to: '/mantenimiento/historial', label: 'Historial', icon: History, permission: 'maintenance' }
];

const ocaNavItems = [
  { to: '/oca', label: 'Panel OCA', icon: BarChart3, permission: 'oca' },
  { to: '/oca/inspecciones', label: 'Inspecciones', icon: ShieldCheck, permission: 'oca' },
  { to: '/oca/vencimientos', label: 'Próximas y vencidas', icon: CalendarClock, permission: 'oca' },
  { to: '/oca/incidencias', label: 'Incidencias OCA', icon: AlertTriangle, permission: 'oca' },
  { to: '/oca/documentacion', label: 'Documentación', icon: FileWarning, permission: 'oca' }
];

const userNavItems = [
  { to: '/usuarios-panel', label: 'Panel usuarios', icon: Users, permission: 'users' },
  { to: '/usuarios', label: 'Gestion usuarios', icon: UserIcon, permission: 'users' },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck, permission: 'audit' },
  { to: '/ajustes', label: 'Ajustes', mobileLabel: 'Cuenta', icon: Settings, permission: 'all' }
];

const technicianClientSelectStyle = {
  width: '100%',
  maxWidth: '100%',
  minHeight: 24,
  height: 24,
  padding: '0 24px 0 0',
  border: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  boxShadow: 'none'
};

function UserIcon(props) {
  return <Users {...props} />;
}

function matchesNavItem(pathname, item) {
  const paths = item.activePaths || [item.to];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
    installationsLoading,
    isTenantAdmin,
    canViewInventory,
    canManageWorkOrders,
    canUseWorkOrders,
    canManageUsers,
    canViewAudit,
    canViewOca,
    isCoordinator,
    canUseQrGenerator,
    canCreateIncidents,
    isTechnician,
    setActiveTenantId,
    setActiveInstallationId
  } = tenant;
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({ inventory: false, maintenance: false, oca: false, workorders: false, users: false });
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('isivoltpro-sidebar-hidden') === 'true');
  const isGlobalWorkOrderView = location.pathname.startsWith('/ots-control') || location.pathname.startsWith('/ots-agenda');

  useEffect(() => {
    localStorage.setItem('isivoltpro-sidebar-hidden', sidebarHidden ? 'true' : 'false');
  }, [sidebarHidden]);

  const canSeeItem = (item) => {
    if (item.permission === 'all') return true;
    if (item.permission === 'super_admin') return isSuperAdmin;
    if (item.permission === 'admin') return isTenantAdmin || isSuperAdmin;
    if (item.permission === 'inventory') return canViewInventory;
    if (item.permission === 'qr') return canUseQrGenerator;
    if (item.permission === 'maintenance') return canManageWorkOrders;
    if (item.permission === 'oca') return canViewOca;
    if (item.permission === 'workorders_manage') return canManageWorkOrders;
    if (item.permission === 'workorders') return canUseWorkOrders || canManageWorkOrders;
    if (item.permission === 'incidents') return canCreateIncidents;
    if (item.permission === 'audit') return canViewAudit;
    if (item.permission === 'users') return canManageUsers;
    return false;
  };

  const toggleGroup = (group) => setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  const groupActive = (items) => items.some((item) => matchesNavItem(location.pathname, item));

  const visibleMainNavItems = mainNavItems.filter(canSeeItem);
  const visibleInventoryNavItems = inventoryNavItems.filter(canSeeItem);
  const visibleMaintenanceNavItems = maintenanceNavItems.filter(canSeeItem);
  const visibleOcaNavItems = ocaNavItems.filter(canSeeItem);
  const visibleWorkOrderNavItems = workOrderNavItems.filter(canSeeItem);
  const visibleTechnicianNavItems = technicianNavItems.filter(canSeeItem);
  const visibleUserNavItems = userNavItems.filter(canSeeItem);

  const showFullNavigation = isTenantAdmin || isCoordinator || canViewInventory || canManageWorkOrders || canManageUsers || canViewOca;
  const useTechnicianMobileShell = isTechnician && !isTenantAdmin && !canManageWorkOrders && !canManageUsers;
  const fallbackNavItems = [...visibleTechnicianNavItems, ...visibleUserNavItems].filter((item) => ['/mis-ots', '/incidencias', '/ajustes'].includes(item.to));
  const desktopNavItems = showFullNavigation ? null : [...visibleMainNavItems, ...fallbackNavItems];
  const allMobileNavItems = showFullNavigation
    ? [...visibleMainNavItems, ...visibleInventoryNavItems, ...visibleMaintenanceNavItems, ...visibleOcaNavItems, ...visibleWorkOrderNavItems, ...visibleUserNavItems]
    : [...visibleMainNavItems, ...fallbackNavItems];
  const preferredMobileRoutes = useTechnicianMobileShell
    ? ['/mis-ots', '/scanner', '/incidencias', '/ajustes']
    : ['/dashboard', '/activos', '/mantenimiento', '/incidencias', '/ajustes'];
  const mobileNavItems = preferredMobileRoutes
    .map((route) => allMobileNavItems.find((item) => item.to === route))
    .filter(Boolean);

  return (
    <div className={`app-shell ${sidebarHidden ? 'sidebar-hidden' : ''} ${useTechnicianMobileShell ? 'technician-mobile-shell' : ''}`}>
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
              <NavGroup title="Bloque OCA" items={visibleOcaNavItems} open={openGroups.oca} active={groupActive(visibleOcaNavItems)} onToggle={() => toggleGroup('oca')} />
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
          {!isGlobalWorkOrderView && !useTechnicianMobileShell && (
            <WorkContextSelector
              tenants={tenants}
              activeTenantId={activeTenantId}
              activeTenant={activeTenant}
              installations={installations}
              activeInstallationId={activeInstallationId}
              activeInstallation={activeInstallation}
              installationsLoading={installationsLoading}
              onTenantChange={setActiveTenantId}
              onInstallationChange={setActiveInstallationId}
            />
          )}
          {useTechnicianMobileShell && !isGlobalWorkOrderView && (
            <div className="technician-topbar-summary">
              <strong>Mis trabajos asignados</strong>
              {tenants.length > 1 ? (
                <select
                  aria-label="Seleccionar cliente activo"
                  title="Cambiar cliente"
                  value={activeTenantId || ''}
                  onChange={(event) => setActiveTenantId(event.target.value)}
                  style={technicianClientSelectStyle}
                >
                  {tenants.map((tenantItem) => (
                    <option key={tenantItem.id} value={tenantItem.id}>{tenantItem.nombre}</option>
                  ))}
                </select>
              ) : (
                <span>{activeTenant?.nombre || 'Cliente activo'}</span>
              )}
            </div>
          )}
          {isGlobalWorkOrderView && (
            <div className="topbar-global-context">
              <strong>Vista global de órdenes de trabajo</strong>
              <small>Incluye todos los clientes e instalaciones accesibles. Al abrir una OT se activará su contexto.</small>
            </div>
          )}
          {!useTechnicianMobileShell && !isGlobalWorkOrderView && <GlobalSearch tenantId={activeTenantId} installationId={activeInstallationId} />}
          <NavLink className="primary-button topbar-scan-button" to="/scanner"><QrCode size={18} /> Escanear QR</NavLink>
          <NotificationBell />
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
  const location = useLocation();
  const active = matchesNavItem(location.pathname, item);
  return (
    <NavLink to={item.to} className={`nav-item ${compact ? 'compact' : ''} ${active ? 'active' : ''}`}>
      <Icon size={20} />
      <span>{compact ? item.mobileLabel || item.label : item.label}</span>
    </NavLink>
  );
}
