const VERSION = '20260611-2';
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

// The published React bundle does not know the OT routes yet. Keep its
// Dashboard route mounted, then let ot-module.js replace only the content area.
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

// Prevent the old HashRouter from receiving an unknown OT route.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  const href = link?.getAttribute('href') || '';
  if (!isOtHash(href)) return;
  event.preventDefault();
  activateOtRoute(href);
}, true);

// Also handle programmatic location.hash changes made inside the OT module.
window.addEventListener('hashchange', () => {
  const targetHash = window.location.hash;
  if (!isOtHash(targetHash)) return;
  window.history.replaceState({}, '', dashboardUrl());
  window.setTimeout(() => activateOtRoute(targetHash), 0);
});

import(`./ot-module.js?v=${VERSION}`).then(() => {
  if (initialOtHash) {
    window.setTimeout(() => activateOtRoute(initialOtHash), 500);
  }
});
