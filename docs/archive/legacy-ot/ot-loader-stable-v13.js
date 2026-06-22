const requestedHash = window.location.hash;
const requestedIsOt = requestedHash === '#/ots' || requestedHash === '#/mis-ots' || requestedHash === '#/ots-creadas' || requestedHash.startsWith('#/ots/');

if (requestedIsOt) {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/dashboard`);
}

Promise.all([
  import('./ot-workspace-v11.js?v=20260611-13'),
  import('./ot-workspace-v11-extra.js?v=20260611-13'),
  import('./ot-workspace-v11-detail.js?v=20260611-13')
]).then(() => {
  if (!requestedIsOt) return;
  window.setTimeout(() => {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${requestedHash}`);
    window.dispatchEvent(new Event('hashchange'));
  }, 700);
}).catch((error) => {
  console.error('Error cargando OT estable', error);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:14px 18px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.15)';
  banner.textContent = `Error cargando Órdenes de trabajo: ${error.message}`;
  document.body.appendChild(banner);
});