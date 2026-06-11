const targetHash = window.location.hash;

if (targetHash.startsWith('#/ots') || targetHash === '#/mis-ots' || targetHash === '#/ots-creadas') {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/dashboard`);
}

import('./ot-app-v3.js?v=20260611-8').then(() => {
  return import('./ot-app-v3-fixes.js?v=20260611-8');
}).then(() => {
  if (!(targetHash.startsWith('#/ots') || targetHash === '#/mis-ots' || targetHash === '#/ots-creadas')) return;
  window.setTimeout(() => {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${targetHash}`);
    window.dispatchEvent(new Event('hashchange'));
  }, 650);
}).catch((error) => console.error('Error cargando OT', error));
