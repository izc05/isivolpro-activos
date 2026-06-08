import { Link } from 'react-router-dom';

export default function InvalidQr() {
  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 460, color: '#102033' }}>
        <h1>QR no valido</h1>
        <p>El token no existe, esta revocado o no pertenece a un recurso disponible.</p>
        <Link className="primary-button" to="/scanner">Escanear otro QR</Link>
      </div>
    </div>
  );
}
