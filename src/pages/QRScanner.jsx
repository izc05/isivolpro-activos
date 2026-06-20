import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, FileImage, ImagePlus, Keyboard, LockKeyhole, QrCode, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import { tokenFromQrValue } from '../services/qrService';

export default function QRScanner() {
  const navigate = useNavigate();
  const liveScannerRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [manualToken, setManualToken] = useState('');
  const [scanError, setScanError] = useState('');
  const [cameraStatus, setCameraStatus] = useState('idle');
  const canUseCamera = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    return () => {
      const scanner = liveScannerRef.current;
      if (!scanner) return;
      scanner.stop().catch(() => {}).finally(() => {
        scanner.clear().catch(() => {});
        liveScannerRef.current = null;
      });
    };
  }, []);

  function submitManual(event) {
    event.preventDefault();
    const token = tokenFromQrValue(manualToken);
    if (token) navigate(`/qr/${token}`);
  }

  async function openLiveCamera() {
    if (!canUseCamera) {
      cameraInputRef.current?.click();
      return;
    }
    setScanError('');
    setCameraStatus('loading');
    let scanner;
    try {
      scanner = liveScannerRef.current || new Html5Qrcode('qr-reader');
      liveScannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const token = tokenFromQrValue(decodedText);
          await scanner.stop().catch(() => {});
          await scanner.clear().catch(() => {});
          liveScannerRef.current = null;
          setCameraStatus('idle');
          if (token) navigate(`/qr/${token}`);
        },
        () => {}
      );
      setCameraStatus('active');
    } catch (err) {
      await scanner?.clear?.().catch(() => {});
      liveScannerRef.current = null;
      setCameraStatus('idle');
      setScanError('No se ha podido abrir la camara desde el navegador. Pulsa "Abrir camara del movil" para usar la camara nativa.');
    }
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
            {cameraStatus !== 'active' && (
              <div className="scanner-camera-empty">
                <QrCode size={42} />
                <strong>Cámara lista</strong>
                <span>Abre la cámara y apunta al QR.</span>
                <button className="primary-button" type="button" onClick={openLiveCamera} disabled={cameraStatus === 'loading'}>
                  <Camera size={18} />
                  {cameraStatus === 'loading' ? 'Abriendo cámara...' : 'Abrir cámara'}
                </button>
              </div>
            )}
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

          <button className="scanner-upload-card scanner-capture-card" type="button" onClick={() => cameraInputRef.current?.click()}>
            <span className="scanner-card-icon"><FileImage size={22} /></span>
            <strong>Abrir cámara del móvil</strong>
            <small>Saca una foto del QR y la app lo resolverá automáticamente.</small>
          </button>
          <button className="scanner-upload-card scanner-gallery-card" type="button" onClick={() => galleryInputRef.current?.click()}>
            <span className="scanner-card-icon"><ImagePlus size={22} /></span>
            <strong>Elegir foto guardada</strong>
            <small>Útil si ya tienes una imagen del QR en la galería.</small>
          </button>
          <input ref={cameraInputRef} className="scanner-hidden-input" type="file" accept="image/*" capture="environment" onChange={scanImage} />
          <input ref={galleryInputRef} className="scanner-hidden-input" type="file" accept="image/*" onChange={scanImage} />
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
