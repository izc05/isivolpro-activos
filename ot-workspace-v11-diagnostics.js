const OT_DIAG_VERSION='v14';

function otDiagIsRoute(){const h=window.location.hash;return h==='#/ots'||h==='#/mis-ots'||h==='#/ots-creadas'||h.startsWith('#/ots/');}
function otDiagShell(){return document.getElementById('v11-shell');}
function otDiagRetry(){
  const target=window.location.hash;
  if(!otDiagIsRoute())return;
  document.body.classList.remove('v11-active');
  window.history.replaceState({},'',`${window.location.pathname}${window.location.search}#/dashboard`);
  window.setTimeout(()=>{
    window.history.replaceState({},'',`${window.location.pathname}${window.location.search}${target}`);
    window.dispatchEvent(new Event('hashchange'));
  },80);
}
function otDiagBanner(message){
  let box=document.getElementById('ot-diag-error');
  if(!box){box=document.createElement('div');box.id='ot-diag-error';box.style.cssText='position:fixed;left:14px;right:14px;bottom:14px;z-index:12000;padding:13px 15px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.2)';document.body.appendChild(box);}
  box.innerHTML=`<div>${String(message||'Error desconocido')}</div><button id="ot-diag-retry" style="margin-top:9px;padding:8px 12px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#991b1b;font-weight:700">Reintentar OT</button>`;
  document.getElementById('ot-diag-retry').onclick=()=>{box.remove();otDiagRetry();};
}
function otDiagBadge(){
  if(document.getElementById('ot-diag-version'))return;
  const badge=document.createElement('div');badge.id='ot-diag-version';badge.textContent=`OT ${OT_DIAG_VERSION}`;badge.style.cssText='position:fixed;right:8px;bottom:8px;z-index:11999;padding:4px 7px;border-radius:7px;background:#0f2742;color:#fff;font-size:11px;opacity:.72;pointer-events:none';document.body.appendChild(badge);
}
function otDiagWatch(){
  if(!otDiagIsRoute())return;
  otDiagBadge();
  window.setTimeout(()=>{
    if(!otDiagIsRoute())return;
    const shell=otDiagShell();
    if(!shell){otDiagBanner('No se ha creado el espacio de trabajo OT.');return;}
    const text=(shell.textContent||'').trim().toLowerCase();
    if(text==='cargando...'||text==='cargando…'||text.includes('cargando órdenes')||text.includes('cargando checklist')||text.includes('cargando ot')){
      otDiagBanner('La pantalla OT ha quedado bloqueada durante la carga.');
    }
  },15000);
}
window.addEventListener('error',event=>{if(otDiagIsRoute())otDiagBanner(event.message||'Error de JavaScript en OT.');});
window.addEventListener('unhandledrejection',event=>{if(otDiagIsRoute())otDiagBanner(event.reason?.message||String(event.reason||'Error no controlado en OT.'));});
window.addEventListener('hashchange',()=>{document.getElementById('ot-diag-error')?.remove();otDiagWatch();});
window.addEventListener('popstate',otDiagWatch);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(otDiagWatch,400));else setTimeout(otDiagWatch,400);
