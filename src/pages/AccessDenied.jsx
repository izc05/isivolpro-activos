import { Link } from 'react-router-dom';

export default function AccessDenied() {
  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 460, color: '#102033' }}>
        <h1>Acceso denegado</h1>
        <p>No tienes permisos suficientes para consultar este recurso.</p>
        <Link className="primary-button" to="/">Volver al inicio</Link>
      </div>
    </div>
  );
}
