import { Outlet, NavLink } from 'react-router-dom';
import { BarChart3, Building2, FileText, Home, MapPin, QrCode, Settings, ShieldCheck, Users, Wrench, AlertTriangle, Image, Video } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import OfflineBanner from './OfflineBanner';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/scanner', label: 'Escaner', icon: QrCode },
  { to: '/clientes', label: 'Clientes', icon: Building2 },
  { to: '/instalaciones', label: 'Instalaciones', icon: Home },
  { to: '/ubicaciones', label: 'Ubicaciones', icon: MapPin },
  { to: '/activos', label: 'Activos', icon: Wrench },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/fotos', label: 'Fotos', icon: Image },
  { to: '/videos', label: 'Videos', icon: Video },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle },
  { to: '/qr', label: 'QR', icon: QrCode },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
  { to: '/ajustes', label: 'Ajustes', icon: Settings }
];

export default function AppLayout() {
  const { profile } = useAuth();
  const { tenants, activeTenantId, setActiveTenantId } = useTenant();

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
          {navItems.map((item) => <NavItem key={item.to} item={item} />)}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <strong>{profile?.nombre || profile?.email || 'Usuario'}</strong>
            <span>Documentacion tecnica y mantenimiento por QR</span>
          </div>
          <select value={activeTenantId || ''} onChange={(event) => setActiveTenantId(event.target.value)}>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nombre}</option>)}
          </select>
          <button className="ghost-button" onClick={signOut}>Cerrar sesion</button>
        </header>
        <OfflineBanner />
        <main className="content"><Outlet /></main>
      </div>

      <nav className="mobile-nav">
        {navItems.map((item) => <NavItem key={item.to} item={item} compact />)}
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
