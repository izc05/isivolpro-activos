import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, FileImage, Keyboard, LockKeyhole, QrCode, ShieldCheck } from 'lucide-react';
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
      <PageHeader title="Escáner QR" subtitle="Escanea un activo, ubicación o instalación. El acceso se valida antes de mostrar información." />
      <section className="scanner-hero">
        <div>
          <span className="section-eyebrow">Lectura segura</span>
          <h2>Apunta al código QR</h2>
          <p>El QR no contiene datos privados, solo un token. La app comprueba permisos y abre la ficha correcta.</p>
        </div>
        <div className="scanner-hero-badges">
          <span><ShieldCheck size={16} /> Permisos</span>
          <span><LockKeyhole size={16} /> Token seguro</span>
        </div>
      </section>

      <div className="scanner-layout">
        <section className="scanner-card scanner-camera-card">
          {!canUseCamera && (
            <p className="warning-text">
              En movil, la camara desde navegador normalmente exige HTTPS. Si entras por la IP local con http, usa "Leer QR desde foto" o instala la APK.
            </p>
          )}
          <div className="scanner-card-header">
            <div className="scanner-card-icon"><Camera size={22} /></div>
            <div>
              <strong>Cámara</strong>
              <span>Concede permiso y centra el QR dentro del marco.</span>
            </div>
          </div>
          <div className="scanner-box">
            <div className="scanner-frame-hint" aria-hidden="true">
              <QrCode size={44} />
            </div>
            <div id="qr-reader" />
          </div>
          {scanError && <p className="error-text">{scanError}</p>}
        </section>

        <aside className="scanner-side-panel">
          <form className="scanner-manual-card" onSubmit={submitManual}>
            <div className="scanner-card-header">
              <div className="scanner-card-icon"><Keyboard size={21} /></div>
              <div>
                <strong>Entrada manual</strong>
                <span>Pega el enlace o escribe el token del QR.</span>
              </div>
            </div>
            <input value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="/qr/a8f7k2p9x4" />
            <button className="primary-button" type="submit">Resolver QR</button>
          </form>

          <label className="scanner-upload-card">
            <span className="scanner-card-icon"><FileImage size={22} /></span>
            <strong>Leer QR desde foto</strong>
            <small>Útil si la cámara no abre o tienes una foto guardada.</small>
            <input type="file" accept="image/*" capture="environment" onChange={scanImage} />
          </label>
          <div id="qr-file-reader" className="qr-file-reader" />

          <section className="scanner-help-card">
            <strong>Cómo funciona</strong>
            <ol>
              <li>Escanea el QR del activo, ubicación o instalación.</li>
              <li>La app valida tu usuario y permisos.</li>
              <li>Se abre la ficha o el aviso correspondiente.</li>
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
