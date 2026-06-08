export default function Modal({ title, open, onClose, children }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="ghost-button" type="button" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </section>
    </div>
  );
}
