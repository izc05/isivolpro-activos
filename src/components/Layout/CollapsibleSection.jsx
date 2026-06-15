import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  badge,
  defaultOpen = true,
  actions,
  children,
  className = ''
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-section ${open ? 'open' : ''} ${className}`}>
      <button className="collapsible-header" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="collapsible-title-block">
          {Icon && <span className="collapsible-icon"><Icon size={20} /></span>}
          <span>
            <strong>{title}</strong>
            {subtitle && <small>{subtitle}</small>}
          </span>
        </span>
        <span className="collapsible-right">
          {badge && <span className="badge">{badge}</span>}
          <ChevronDown size={18} />
        </span>
      </button>
      {actions && <div className="collapsible-actions">{actions}</div>}
      {open && <div className="collapsible-content">{children}</div>}
    </section>
  );
}
