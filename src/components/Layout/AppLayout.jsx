import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { BarChart3, Building2, ChevronDown, ClipboardCheck, FileText, Home, ListChecks, MapPin, PenLine, QrCode, Settings, ShieldCheck, Users, Wrench, AlertTriangle, Image, Video } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import OfflineBanner from './OfflineBanner';

const mainNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: BarChart3, permission: 'admin' },
  { to: '/scanner', label: 'Escaner QR', icon: QrCode, permission: 'all' }
];

const inventoryNavItems = [
  { to: '/clientes', label: 'Clientes', icon: Building2, permission: 'super_admin' },
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
  { to: '/ots', label: 'Todas las OT', icon: ClipboardCheck, permission: 'workorders_manage' },
  { to: '/ots-realizadas', label: 'OT realizadas', icon: CheckIcon, permission: 'workorders_manage' },
  { to: '/mis-ots', label: 'Mis OT asignadas', icon: ListChecks, permission: 'workorders' },
  { to: '/ots-creadas', label: 'OT creadas por mi', icon: PenLine, permission: 'workorders_manage' },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle, permission: 'incidents' }
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
  const { isSuperAdmin, profile } = useAuth();
  const tenant = useTenant();
  const {
    activeTenant,
    installations,
    activeInstallationId,
    activeInstallation,
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
    setActiveInstallationId
  } = tenant;
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({ inventory: true, workorders: true, users: true });

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

  const toggleGroup = (group) => setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  const groupActive = (items) => items.some((item) => location.pathname.startsWith(item.to));

  const visibleMainNavItems = mainNavItems.filter(canSeeItem);
  const visibleInventoryNavItems = inventoryNavItems.filter(canSeeItem);
  const visibleWorkOrderNavItems = workOrderNavItems.filter(canSeeItem);
  const visibleUserNavItems = userNavItems.filter(canSeeItem);

  const showFullNavigation = isTenantAdmin || canViewInventory || canManageWorkOrders || canManageUsers;
  const fallbackNavItems = [...visibleWorkOrderNavItems, ...visibleUserNavItems].filter((item) => ['/mis-ots', '/incidencias', '/ajustes'].includes(item.to));
  const desktopNavItems = showFullNavigation ? null : [...visibleMainNavItems, ...fallbackNavItems];
  const mobileNavItems = showFullNavigation
    ? [...visibleMainNavItems, ...visibleInventoryNavItems, ...visibleWorkOrderNavItems, ...visibleUserNavItems]
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
              <NavGroup title="Bloque Inventario" items={visibleInventoryNavItems} open={openGroups.inventory} active={groupActive(visibleInventoryNavItems)} onToggle={() => toggleGroup('inventory')} />
              <NavGroup title="Bloque OT" items={visibleWorkOrderNavItems} open={openGroups.workorders} active={groupActive(visibleWorkOrderNavItems)} onToggle={() => toggleGroup('workorders')} />
              <NavGroup title="Bloque Usuarios" items={visibleUserNavItems} open={openGroups.users} active={groupActive(visibleUserNavItems)} onToggle={() => toggleGroup('users')} />
            </>
          )}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar app-topbar-context">
          <div className="topbar-user-block">
            <strong>{profile?.nombre || profile?.email || 'Usuario'}</strong>
            <span>{activeTenant?.nombre || 'Cliente activo'} · {isTechnician ? 'Trabajo tecnico y OT asignadas' : 'Inventario, OT y usuarios'}{activeRole ? ` · ${activeRoleLabel}` : ''}</span>
          </div>
          <div className="topbar-selectors">
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
            {activeInstallation && <span className="active-installation-pill">Trabajando en: {activeInstallation.nombre}</span>}
            {!activeInstallation && activeTenant && <span className="active-installation-pill muted">Cliente: {activeTenant.nombre}</span>}
          </div>
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
