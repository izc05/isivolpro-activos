export function WorkOrderInfoGrid({ children, columns = 3, className = '' }) {
  return <div className={`ot-info-grid ot-info-grid-${columns} ${className}`}>{children}</div>;
}

export function WorkOrderInfoItem({ label, value, important = false, wide = false }) {
  return (
    <div className={`ot-info-item ${important ? 'important' : ''} ${wide ? 'wide' : ''}`}>
      <span className="ot-info-label">{label}</span>
      <strong className="ot-info-value">{value || '-'}</strong>
    </div>
  );
}
