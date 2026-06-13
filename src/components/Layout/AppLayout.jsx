import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { BarChart3, Building2, ChevronDown, ClipboardCheck, FileText, Home, ListChecks, MapPin, PenLine, QrCode, Settings, ShieldCheck, Users, Wrench, AlertTriangle, Image, Video } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import OfflineBanner from './OfflineBanner';

const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/scanner', label: 'Escaner', icon: QrCode }
];

const inventoryNavItems = [
  { to: '/clientes', label: 'Clientes', icon: Building2 },
  { to: '/instalaciones', label: 'Instalaciones', icon: Home },
  { to: '/ubicaciones', label: 'Ubicaciones', icon: MapPin },
  { to: '/activos', label: 'Activos', icon: Wrench },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/fotos', label: 'Fotos', icon: Image },
  { to: '/videos', label: 'Videos', icon: Video },
  { to: '/qr', label: 'QR', icon: QrCode }
];

const operationsNavItems = [
  { to: '/ots-dashboard', label: 'Dashboard OT', icon: BarChart3 },
  { to: '/ots', label: 'Todas las OT', icon: ClipboardCheck },
  { to: '/mis-ots', label: 'OT asignadas', icon: ListChecks },
  { to: '/ots-creadas', label: 'Creadas por mi', icon: PenLine },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
  { to: '/ajustes', label: 'Ajustes', icon: Settings }
];

const technicianNavItems = [
  { to: '/mis-ots', label: 'Mis OT', icon: ListChecks },
  { to: '/scanner', label: 'Escaner', icon: QrCode },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle },
  { to: '/ajustes', label: 'Cuenta', icon: Settings }
];

export default function AppLayout() {
  const { profile } = useAuth();
  const { tenants, activeTenantId, activeRole, isTenantAdmin, isTechnician, setActiveTenantId } = useTenant();
  const location = useLocation();
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const inventoryActive = inventoryNavItems.some((item) => location.pathname.startsWith(item.to));
  const showAdminNavigation = isTenantAdmin;
  const desktopNavItems = showAdminNavigation ? null : technicianNavItems;
  const mobileNavItems = showAdminNavigation ? [...mainNavItems, ...inventoryNavItems, ...operationsNavItems] : technicianNavItems;

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
              {mainNavItems.map((item) => <NavItem key={item.to} item={item} />)}
              <div className={`nav-group ${inventoryActive ? 'active' : ''}`}>
                <button className="nav-group-toggle" type="button" onClick={() => setInventoryOpen((current) => !current)} aria-expanded={inventoryOpen}>
                  <span>Inventario QR</span>
                  <ChevronDown size={16} />
                </button>
                {inventoryOpen && (
                  <div className="nav-group-items">
                    {inventoryNavItems.map((item) => <NavItem key={item.to} item={item} />)}
                  </div>
                )}
              </div>
              {operationsNavItems.map((item) => <NavItem key={item.to} item={item} />)}
            </>
          )}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <strong>{profile?.nombre || profile?.email || 'Usuario'}</strong>
            <span>{isTechnician ? 'Mis ordenes de trabajo' : 'Documentacion tecnica y mantenimiento por QR'}{activeRole ? ` · ${activeRole.replaceAll('_', ' ')}` : ''}</span>
          </div>
          {tenants.length > 1 && (
            <select value={activeTenantId || ''} onChange={(event) => setActiveTenantId(event.target.value)}>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nombre}</option>)}
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
