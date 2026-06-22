const requestedHash = window.location.hash;
const isOtRoute = requestedHash === '#/ots' || requestedHash === '#/mis-ots' || requestedHash === '#/ots-creadas' || requestedHash.startsWith('#/ots/');

if (isOtRoute) {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/dashboard`);
}

Promise.all([
  import('./ot-workspace-v11.js?v=20260611-12'),
  import('./ot-workspace-v11-extra.js?v=20260611-12')
]).then(() => {
  if (!isOtRoute) return;
  window.setTimeout(() => {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${requestedHash}`);
    window.dispatchEvent(new Event('hashchange'));
  }, 700);
}).catch((error) => console.error('Error cargando OT estable', error));
