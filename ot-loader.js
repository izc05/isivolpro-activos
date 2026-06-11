const VERSION = '20260611-4';
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

Promise.all([
  import(`./ot-module.js?v=${VERSION}`),
  import(`./ot-actions.js?v=${VERSION}`)
]).then(() => {
  if (initialOtHash) {
    window.setTimeout(() => activateOtRoute(initialOtHash), 500);
  }
});
