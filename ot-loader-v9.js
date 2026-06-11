const targetHash = window.location.hash;
const isOtRoute = targetHash.startsWith('#/ots') || targetHash === '#/mis-ots' || targetHash === '#/ots-creadas';

if (isOtRoute) {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/dashboard`);
}

import('./ot-app-v3.js?v=20260611-9')
  .then(() => import('./ot-app-v3-fixes.js?v=20260611-9'))
  .then(() => import('./ot-checklist-v4.js?v=20260611-9'))
  .then(() => {
    if (!isOtRoute) return;
    window.setTimeout(() => {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${targetHash}`);
      window.dispatchEvent(new Event('hashchange'));
    }, 650);
  })
  .catch((error) => console.error('Error cargando OT', error));
