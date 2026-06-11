const target = window.location.hash.startsWith('#/ots') || window.location.hash === '#/mis-ots' || window.location.hash === '#/ots-creadas' ? window.location.hash : '';

if (target) {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/dashboard`);
}

import('./ot-app-v3.js?v=20260611-7')
  .then(() => {
    if (!target) return;
    window.setTimeout(() => {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${target}`);
      window.dispatchEvent(new Event('hashchange'));
    }, 650);
  })
  .catch((error) => {
    console.error('No se pudo cargar el módulo OT', error);
  });
