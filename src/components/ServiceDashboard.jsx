import { Link } from 'react-router-dom';
import { FileText, QrCode } from 'lucide-react';

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="service-section-header">
      <div>
        {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function DashboardCard({ icon: Icon, title, description, meta, to, actionLabel, tone = 'default', children }) {
  const content = (
    <article className={`dashboard-card dashboard-card-${tone}`}>
      <div className="dashboard-card-icon">{Icon && <Icon size={24} />}</div>
      <div className="dashboard-card-body">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {children}
        <div className="dashboard-card-footer">
          {meta && <span>{meta}</span>}
          {actionLabel && <strong>{actionLabel}</strong>}
        </div>
      </div>
    </article>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

export function QuickActionButton({ to, icon: Icon, children, variant = 'secondary' }) {
  const className = variant === 'primary' ? 'primary-button quick-action-button' : 'secondary-button quick-action-button';
  return (
    <Link className={className} to={to}>
      {Icon && <Icon size={18} />}
      {children}
    </Link>
  );
}

export function QRScanButton({ label = 'Escanear QR' }) {
  return <QuickActionButton to="/scanner" icon={QrCode} variant="primary">{label}</QuickActionButton>;
}

export function StatusBadge({ status }) {
  const value = String(status || '').toLowerCase();
  const tone = ['correcto', 'resuelta', 'cerrada'].includes(value)
    ? 'ok'
    : ['averiado', 'fuera_servicio', 'critica', 'urgente'].includes(value)
      ? 'danger'
      : 'warn';
  const label = value.replaceAll('_', ' ') || 'Pendiente';
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function AssetCard({ title, location, status, lastReview, nextReview, to }) {
  return (
    <article className="asset-service-card">
      <div className="asset-service-head">
        <div>
          <h3>{title}</h3>
          <span>{location || 'Ubicacion pendiente'}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="asset-service-meta">
        <span>Ultima revision <strong>{lastReview || '-'}</strong></span>
        <span>Proxima revision <strong>{nextReview || '-'}</strong></span>
      </div>
      <div className="quick-actions">
        {to && <Link className="secondary-button" to={to}>Ver ficha</Link>}
        <Link className="ghost-button" to="/incidencias">Crear incidencia</Link>
      </div>
    </article>
  );
}

export function IncidentCard({ title, description, status, to }) {
  return (
    <article className="incident-service-card">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <StatusBadge status={status} />
      {to && <Link className="secondary-button" to={to}>Seguimiento</Link>}
    </article>
  );
}

export function DocumentCard({ title, description, to = '/documentos' }) {
  return (
    <Link className="document-card" to={to}>
      <FileText size={20} />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </Link>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state service-empty-state">
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}
