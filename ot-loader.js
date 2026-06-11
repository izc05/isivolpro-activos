const VERSION = '20260611-5';
const isOtHash = (hash) => hash.startsWith('#/ots') || hash.startsWith('#/mis-ots');
const initialOtHash = isOtHash(window.location.hash) ? window.location.hash : '';

function dashboardUrl() {
  return `${window.location.pathname}${window.location.search}#/dashboard`;
}

function activateOtRoute(targetHash) {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${targetHash}`);
  const pulse = document.createElement('span');
  pulse.hidden = true;
  pulse.dataset.otRoutePulse = Date.now().toString();
  document.body.appendChild(pulse);
  pulse.remove();
}

if (initialOtHash) {
  window.history.replaceState({}, '', dashboardUrl());
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if ('caches' in window) {
  window.caches.keys().then((keys) => {
    keys.forEach((key) => window.caches.delete(key));
  }).catch(() => {});
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  const href = link?.getAttribute('href') || '';
  if (!isOtHash(href)) return;
  event.preventDefault();
  activateOtRoute(href);
}, true);

window.addEventListener('hashchange', () => {
  const targetHash = window.location.hash;
  if (!isOtHash(targetHash)) return;
  window.history.replaceState({}, '', dashboardUrl());
  window.setTimeout(() => activateOtRoute(targetHash), 0);
});

import(`./ot-module-v2.js?v=${VERSION}`)
  .then(() => {
    if (initialOtHash) {
      window.setTimeout(() => activateOtRoute(initialOtHash), 500);
    }
  })
  .catch((error) => {
    console.error('No se pudo cargar el módulo OT', error);
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;left:20px;right:20px;bottom:20px;z-index:9999;padding:14px 18px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.15)';
    banner.textContent = `No se pudo cargar el módulo OT: ${error.message}`;
    document.body.appendChild(banner);
  });
