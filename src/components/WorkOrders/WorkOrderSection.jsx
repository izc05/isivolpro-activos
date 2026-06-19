import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function WorkOrderSectionHeader({ icon: Icon, title, subtitle, badge, open = true, onToggle, actions }) {
  const hasToggle = typeof onToggle === 'function';
  const content = (
    <>
      <div className="ot-section-heading">
        {Icon && <span className="ot-section-icon"><Icon size={21} /></span>}
        <span className="ot-section-copy">
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>
      </div>
      <div className="ot-section-controls">
        {badge && (typeof badge === 'string' || typeof badge === 'number' ? <span className="badge">{badge}</span> : badge)}
        {actions && <span className="ot-section-actions">{actions}</span>}
        {hasToggle && <ChevronDown className="ot-section-chevron" size={18} />}
      </div>
    </>
  );

  if (!hasToggle) return <div className="ot-section-header">{content}</div>;
  return (
    <button className="ot-section-header" type="button" onClick={onToggle} aria-expanded={open}>
      {content}
    </button>
  );
}

export default function WorkOrderSection({ title, subtitle, icon, badge, defaultOpen = true, actions, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ot-section ${open ? 'open' : ''} ${className}`}>
      <WorkOrderSectionHeader icon={icon} title={title} subtitle={subtitle} badge={badge} actions={actions} open={open} onToggle={() => setOpen((current) => !current)} />
      {open && <div className="ot-section-body">{children}</div>}
    </section>
  );
}
