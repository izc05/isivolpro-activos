import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const canShowIosHelp = useMemo(() => typeof window !== 'undefined' && isAppleMobile(), []);

  useEffect(() => {
    setInstalled(isStandalone());

    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function onInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installApp() {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (canShowIosHelp) setShowIosHelp((current) => !current);
  }

  if (installed) return null;
  if (!installPrompt && !canShowIosHelp) return null;

  return (
    <div className="install-app-wrap">
      <button className="secondary-button install-app-button" type="button" onClick={installApp}>
        <Download size={18} /> Instalar app
      </button>
      {showIosHelp && (
        <div className="install-app-help" role="status">
          En iPhone/iPad: comparte la pagina y toca "Anadir a pantalla de inicio".
        </div>
      )}
    </div>
  );
}
