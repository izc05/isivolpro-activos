const SUPABASE_URL = 'https://ubfbhzovebrmmjpyygnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac';

const STATUS_LABELS = {
  BORRADOR: 'Borrador', ASIGNADA: 'Asignada', ACEPTADA: 'Aceptada', EN_CURSO: 'En curso',
  PENDIENTE_MATERIAL: 'Pendiente material', PENDIENTE_CLIENTE: 'Pendiente cliente',
  FINALIZADA: 'Finalizada', FIRMADA: 'Firmada', INFORME_GENERADO: 'Informe generado',
  CERRADA: 'Cerrada', CANCELADA: 'Cancelada'
};
const STATUSES = Object.keys(STATUS_LABELS);
const TYPES = ['averia', 'mantenimiento', 'revision', 'instalacion', 'inspeccion', 'otro'];
const PRIORITIES = ['baja', 'media', 'alta', 'urgente'];
let activeTenantId = null;
let currentUser = null;
let accessToken = '';
let lastHash = '';

function esc(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function getSession() {
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key));
      const session = parsed?.currentSession || parsed;
      if (session?.access_token && session?.user) return session;
    } catch (_) {}
  }
  return null;
}

async function api(table, { select='*', filters={}, method='GET', body=null, single=false, order='' } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (select) url.searchParams.set('select', select);
  Object.entries(filters).forEach(([key,value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  if (order) url.searchParams.set('order', order);
  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: method === 'GET' ? 'count=none' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.details || `Error ${response.status}`);
  if (single) return Array.isArray(data) ? data[0] : data;
  return data || [];
}

function styles() {
  if (document.getElementById('ot-v2-styles')) return;
  const style = document.createElement('style');
  style.id = 'ot-v2-styles';
  style.textContent = `
  .ot2-btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f2742;font-weight:700;cursor:pointer;text-decoration:none}.ot2-btn.primary{background:#0f4c75;color:#fff;border-color:#0f4c75}.ot2-btn:disabled{opacity:.55}
  .ot2-card{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:20px;box-shadow:0 8px 20px rgba(15,39,66,.05)}.ot2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.ot2-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
  .ot2-table-wrap{overflow:auto;background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:12px}.ot2-table{width:100%;border-collapse:collapse;min-width:850px}.ot2-table th,.ot2-table td{padding:13px 12px;border-bottom:1px solid #e2e8f0;text-align:left}.ot2-table a{color:#075985;font-weight:700;text-decoration:none}
  .ot2-badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:700}.ot2-badge.urgent{background:#fee2e2;color:#b91c1c}.ot2-badge.high{background:#fef3c7;color:#92400e}
  .ot2-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ot2-form label{display:flex;flex-direction:column;gap:6px;font-weight:700;color:#334155}.ot2-form input,.ot2-form select,.ot2-form textarea{padding:11px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;background:#fff}.ot2-form .full{grid-column:1/-1}.ot2-error{padding:12px 14px;background:#fee2e2;color:#991b1b;border-radius:10px;margin:12px 0}.ot2-success{padding:12px 14px;background:#dcfce7;color:#166534;border-radius:10px;margin:12px 0}
  .ot2-row{display:flex;justify-content:space-between;gap:18px;padding:9px 0;border-bottom:1px solid #e2e8f0}.ot2-row span{color:#64748b}.ot2-nav{display:flex;align-items:center;gap:12px;padding:12px 14px;color:#fff;text-decoration:none;border-radius:9px;margin:3px 6px}.ot2-nav:hover,.ot2-nav.active{background:#164e70}
  @media(max-width:800px){.ot2-grid,.ot2-form{grid-template-columns:1fr}.ot2-form .full{grid-column:auto}}
  `;
  document.head.appendChild(style);
}

function mainEl(){ return document.querySelector('main.content') || document.querySelector('.content'); }
function isOtHash(hash){ return hash.startsWith('#/ots') || hash.startsWith('#/mis-ots'); }

function injectNav(){
  const nav = document.querySelector('.sidebar .nav-list');
  if (!nav || document.getElementById('ot2-orders')) return;
  const anchor = [...nav.querySelectorAll('a')].find(a => a.getAttribute('href')?.includes('/incidencias'));
  const orders = document.createElement('a'); orders.id='ot2-orders'; orders.className='ot2-nav'; orders.href='#/ots'; orders.innerHTML='<span>▣</span><span>Órdenes OT</span>';
  const mine = document.createElement('a'); mine.id='ot2-mine'; mine.className='ot2-nav'; mine.href='#/mis-ots'; mine.innerHTML='<span>✓</span><span>Mis OT</span>';
  if(anchor){ nav.insertBefore(orders,anchor); nav.insertBefore(mine,anchor); } else { nav.append(orders,mine); }
  updateNav();
}
function updateNav(){ const h=location.hash; document.getElementById('ot2-orders')?.classList.toggle('active',h.startsWith('#/ots')); document.getElementById('ot2-mine')?.classList.toggle('active',h.startsWith('#/mis-ots')); }

async function context(){
  const session=getSession();
  if(!session) throw new Error('No se ha encontrado la sesión. Cierra sesión y vuelve a entrar.');
  currentUser=session.user; accessToken=session.access_token;
  activeTenantId=document.querySelector('.topbar select')?.value || activeTenantId;
  if(!activeTenantId){
    const rows=await api('tenant_members',{filters:{user_id:`eq.${currentUser.id}`,estado:'eq.activo'},select:'tenant_id',order:'created_at.asc',single:false});
    activeTenantId=rows[0]?.tenant_id;
  }
  if(!activeTenantId) throw new Error('No se ha encontrado una empresa activa.');
}

function header(title,subtitle,action=''){ return `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${action}</div>`; }
function row(label,value){ return `<div class="ot2-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }

async function listOrders(onlyMine=false){
  const filters={tenant_id:`eq.${activeTenantId}`}; if(onlyMine) filters.assigned_to=`eq.${currentUser.id}`;
  return api('ordenes_trabajo',{select:'*,instalaciones(nombre),ubicaciones(nombre),activos(nombre),assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)',filters,order:'created_at.desc'});
}

async function renderList(onlyMine=false){
  const main=mainEl();
  main.innerHTML=`${header(onlyMine?'Mis OT':'Órdenes de trabajo',onlyMine?'Órdenes asignadas a tu usuario.':'Crea, asigna y controla las órdenes de trabajo.',onlyMine?'<a class="ot2-btn" href="#/ots">Ver todas</a>':'<button id="ot2-new" class="ot2-btn primary">Nueva OT</button>')}<div id="ot2-msg"></div><div class="ot2-table-wrap">Cargando...</div>`;
  try{
    const orders=await listOrders(onlyMine); const wrap=main.querySelector('.ot2-table-wrap');
    if(!orders.length) wrap.innerHTML='<p>No hay órdenes de trabajo.</p>';
    else wrap.innerHTML=`<table class="ot2-table"><thead><tr><th>OT</th><th>Trabajo</th><th>Instalación</th><th>Activo</th><th>Técnico</th><th>Prioridad</th><th>Estado</th><th>Prevista</th></tr></thead><tbody>${orders.map(o=>`<tr><td><a href="#/ots/${o.id}">${esc(o.codigo_ot||o.id.slice(0,8))}</a></td><td>${esc(o.titulo)}</td><td>${esc(o.instalaciones?.nombre||'-')}</td><td>${esc(o.activos?.nombre||'-')}</td><td>${esc(o.assigned?.nombre||o.assigned?.email||'Sin asignar')}</td><td><span class="ot2-badge ${o.prioridad==='urgente'?'urgent':o.prioridad==='alta'?'high':''}">${esc(o.prioridad)}</span></td><td><span class="ot2-badge">${esc(STATUS_LABELS[o.estado]||o.estado)}</span></td><td>${o.fecha_prevista?new Date(o.fecha_prevista).toLocaleString():'-'}</td></tr>`).join('')}</tbody></table>`;
    document.getElementById('ot2-new')?.addEventListener('click',renderCreate);
  }catch(error){ main.querySelector('.ot2-table-wrap').innerHTML=`<div class="ot2-error">${esc(error.message)}</div>`; }
}

async function renderCreate(){
  const main=mainEl();
  main.innerHTML=`${header('Nueva orden de trabajo','Asigna la OT a una instalación y a un técnico.','<a class="ot2-btn" href="#/ots">Volver</a>')}<div id="ot2-msg"></div><section class="ot2-card"><form id="ot2-form" class="ot2-form"><label>Instalación<select id="ot2-install" required><option value="">Cargando...</option></select></label><label>Ubicación<select id="ot2-location"><option value="">Sin ubicación</option></select></label><label>Activo<select id="ot2-asset"><option value="">Sin activo</option></select></label><label>Técnico<select id="ot2-tech"><option value="">Sin asignar</option></select></label><label class="full">Título<input id="ot2-title" required></label><label>Tipo<select id="ot2-type">${TYPES.map(v=>`<option>${v}</option>`).join('')}</select></label><label>Prioridad<select id="ot2-priority">${PRIORITIES.map(v=>`<option>${v}</option>`).join('')}</select></label><label>Fecha prevista<input id="ot2-date" type="datetime-local"></label><label class="full">Descripción<textarea id="ot2-desc" rows="5"></textarea></label><div class="full ot2-actions"><button class="ot2-btn primary" type="submit">Crear OT</button><a class="ot2-btn" href="#/ots">Cancelar</a></div></form></section>`;
  try{
    const [inst,loc,assets,members]=await Promise.all([
      api('instalaciones',{select:'id,nombre',filters:{tenant_id:`eq.${activeTenantId}`},order:'nombre.asc'}),
      api('ubicaciones',{select:'id,nombre,instalacion_id',filters:{tenant_id:`eq.${activeTenantId}`},order:'nombre.asc'}),
      api('activos',{select:'id,nombre,instalacion_id,ubicacion_id',filters:{tenant_id:`eq.${activeTenantId}`},order:'nombre.asc'}),
      api('tenant_members',{select:'user_id,role,estado,profiles(nombre,email)',filters:{tenant_id:`eq.${activeTenantId}`,estado:'eq.activo'}})
    ]);
    const i=document.getElementById('ot2-install'),l=document.getElementById('ot2-location'),a=document.getElementById('ot2-asset'),t=document.getElementById('ot2-tech');
    i.innerHTML='<option value="">Seleccionar</option>'+inst.map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
    t.innerHTML='<option value="">Sin asignar</option>'+members.filter(x=>['admin_cliente','tecnico','tecnico_externo'].includes(x.role)).map(x=>`<option value="${x.user_id}">${esc(x.profiles?.nombre||x.profiles?.email||x.user_id)}</option>`).join('');
    const related=()=>{ l.innerHTML='<option value="">Sin ubicación</option>'+loc.filter(x=>x.instalacion_id===i.value).map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join(''); a.innerHTML='<option value="">Sin activo</option>'+assets.filter(x=>x.instalacion_id===i.value).map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join(''); }; i.addEventListener('change',related);
    document.getElementById('ot2-form').addEventListener('submit',async e=>{
      e.preventDefault(); const btn=e.submitter; btn.disabled=true;
      try{
        const payload={tenant_id:activeTenantId,codigo_ot:`OT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,instalacion_id:i.value,ubicacion_id:l.value||null,activo_id:a.value||null,assigned_to:t.value||null,titulo:document.getElementById('ot2-title').value.trim(),descripcion:document.getElementById('ot2-desc').value.trim()||null,tipo:document.getElementById('ot2-type').value,prioridad:document.getElementById('ot2-priority').value,estado:t.value?'ASIGNADA':'BORRADOR',fecha_prevista:document.getElementById('ot2-date').value?new Date(document.getElementById('ot2-date').value).toISOString():null,created_by:currentUser.id};
        const created=await api('ordenes_trabajo',{method:'POST',body:payload,select:'id',single:true}); location.hash=`#/ots/${created.id}`;
      }catch(error){ document.getElementById('ot2-msg').innerHTML=`<div class="ot2-error">${esc(error.message)}</div>`; btn.disabled=false; }
    });
  }catch(error){ document.getElementById('ot2-msg').innerHTML=`<div class="ot2-error">${esc(error.message)}</div>`; }
}

async function renderDetail(id){
  const main=mainEl(); main.innerHTML=`${header('Orden de trabajo','Cargando...','<a class="ot2-btn" href="#/ots">Volver</a>')}<section class="ot2-card">Cargando...</section>`;
  try{
    const o=await api('ordenes_trabajo',{select:'*,instalaciones(nombre,direccion,contacto_nombre,contacto_telefono),ubicaciones(nombre),activos(nombre,marca,modelo,numero_serie),assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)',filters:{tenant_id:`eq.${activeTenantId}`,id:`eq.${id}`},single:true});
    main.innerHTML=`${header(o.codigo_ot||'OT',o.titulo,'<a class="ot2-btn" href="#/ots">Volver</a>')}<div id="ot2-msg"></div><div class="ot2-grid"><section class="ot2-card"><h2>Estado de la OT</h2>${row('Estado',STATUS_LABELS[o.estado]||o.estado)}${row('Prioridad',o.prioridad)}${row('Tipo',o.tipo)}${row('Técnico',o.assigned?.nombre||o.assigned?.email||'Sin asignar')}${row('Fecha prevista',o.fecha_prevista?new Date(o.fecha_prevista).toLocaleString():'-')}<label style="display:block;margin-top:16px;font-weight:700">Cambiar estado<select id="ot2-status" style="display:block;width:100%;padding:10px;margin-top:6px;border:1px solid #cbd5e1;border-radius:9px">${STATUSES.map(s=>`<option value="${s}" ${s===o.estado?'selected':''}>${STATUS_LABELS[s]}</option>`).join('')}</select></label></section><section class="ot2-card"><h2>Instalación y activo</h2>${row('Instalación',o.instalaciones?.nombre||'-')}${row('Dirección',o.instalaciones?.direccion||'-')}${row('Ubicación',o.ubicaciones?.nombre||'-')}${row('Activo',o.activos?.nombre||'-')}${row('Marca/modelo',[o.activos?.marca,o.activos?.modelo].filter(Boolean).join(' / ')||'-')}</section></div><section class="ot2-card" style="margin-top:16px"><h2>Descripción</h2><p>${esc(o.descripcion||'Sin descripción adicional.')}</p><p class="muted">Visita, checklist, firma y PDF están preparados en el código principal y se activarán al normalizar el despliegue completo.</p></section>`;
    document.getElementById('ot2-status').addEventListener('change',async e=>{ try{ await api('ordenes_trabajo',{method:'PATCH',body:{estado:e.target.value},filters:{tenant_id:`eq.${activeTenantId}`,id:`eq.${id}`},select:'id'}); document.getElementById('ot2-msg').innerHTML='<div class="ot2-success">Estado actualizado.</div>'; }catch(error){ document.getElementById('ot2-msg').innerHTML=`<div class="ot2-error">${esc(error.message)}</div>`; }});
  }catch(error){ main.innerHTML=`<div class="ot2-error">${esc(error.message)}</div>`; }
}

async function route(){
  const h=location.hash; injectNav(); updateNav(); if(!isOtHash(h)){ lastHash=''; return; }
  if(h===lastHash && mainEl()?.dataset.ot2==='1') return; lastHash=h; const main=mainEl(); if(!main)return; main.dataset.ot2='1';
  try{ await context(); if(h==='#/ots') return renderList(false); if(h==='#/mis-ots') return renderList(true); const m=h.match(/^#\/ots\/([0-9a-f-]+)$/i); if(m)return renderDetail(m[1]); location.hash='#/ots'; }catch(error){ main.innerHTML=`<div class="ot2-error">${esc(error.message)}</div>`; }
}

function boot(){ styles(); injectNav(); route(); window.addEventListener('hashchange',()=>setTimeout(route,20)); const observer=new MutationObserver(()=>{ injectNav(); if(isOtHash(location.hash)&&!mainEl()?.querySelector('.ot2-card,.ot2-table-wrap')){ lastHash=''; route(); }}); observer.observe(document.body,{childList:true,subtree:true}); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,250)); else setTimeout(boot,250);
