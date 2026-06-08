import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import { tokenFromQrValue } from '../services/qrService';

export default function QRScanner() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [manualToken, setManualToken] = useState('');
  const [scanError, setScanError] = useState('');
  const canUseCamera = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 240, height: 240 } }, false);
    scanner.render((decodedText) => {
      const token = tokenFromQrValue(decodedText);
      scanner.clear();
      navigate(`/qr/${token}`);
    }, (errorMessage) => {
      if (String(errorMessage || '').toLowerCase().includes('permission')) {
        setScanError('Permiso de camara denegado. Activalo en el navegador o usa una foto del QR.');
      }
    });
    scannerRef.current = scanner;
    return () => {
      scannerRef.current?.clear().catch(() => {});
    };
  }, [navigate]);

  function submitManual(event) {
    event.preventDefault();
    const token = tokenFromQrValue(manualToken);
    if (token) navigate(`/qr/${token}`);
  }

  async function scanImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanError('');
    try {
      const scanner = new Html5Qrcode('qr-file-reader');
      const decodedText = await scanner.scanFile(file, true);
      const token = tokenFromQrValue(decodedText);
      await scanner.clear().catch(() => {});
      if (token) navigate(`/qr/${token}`);
    } catch (err) {
      setScanError('No he podido leer un QR en esa imagen. Prueba con una foto mas enfocada o introduce el codigo manualmente.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <>
      <PageHeader title="Escaner QR" subtitle="El QR solo contiene un token opaco. La app valida permisos antes de mostrar datos." />
      <div className="grid two">
        <div className="scanner-card">
          {!canUseCamera && (
            <p className="warning-text">
              En movil, la camara desde navegador normalmente exige HTTPS. Si entras por la IP local con http, usa "Leer QR desde foto" o instala la APK.
            </p>
          )}
          <div className="scanner-box" id="qr-reader" />
          {scanError && <p className="error-text">{scanError}</p>}
        </div>
        <form className="card form-grid" onSubmit={submitManual}>
          <strong>Entrada manual</strong>
          <label className="upload-box">
            Leer QR desde foto
            <input type="file" accept="image/*" capture="environment" onChange={scanImage} />
          </label>
          <div id="qr-file-reader" className="qr-file-reader" />
          <input value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="/qr/a8f7k2p9x4" />
          <button className="primary-button" type="submit">Resolver QR</button>
        </form>
      </div>
    </>
  );
}
