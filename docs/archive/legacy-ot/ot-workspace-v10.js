const OT10_URL = 'https://ubfbhzovebrmmjpyygnm.supabase.co';
const OT10_KEY = 'sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac';
const OT10_STATUSES = {
  BORRADOR: 'Borrador', ASIGNADA: 'Asignada', ACEPTADA: 'Aceptada', EN_CURSO: 'En curso',
  PENDIENTE_MATERIAL: 'Pendiente material', PENDIENTE_CLIENTE: 'Pendiente cliente',
  FINALIZADA: 'Finalizada', FIRMADA: 'Firmada', INFORME_GENERADO: 'Informe generado',
  CERRADA: 'Cerrada', CANCELADA: 'Cancelada'
};
const OT10_TYPES = ['averia', 'mantenimiento', 'revision', 'instalacion', 'inspeccion', 'otro'];
const OT10_PRIORITIES = ['baja', 'media', 'alta', 'urgente'];
const ot10State = { token: '', user: null, tenant: null, refs: null, rendering: false };

function ot10Esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function ot10IsRoute(hash = window.location.hash) {
  return hash === '#/ots' || hash === '#/mis-ots' || hash === '#/ots-creadas' || hash.startsWith('#/ots/');
}

function ot10ReadSession() {
  for (const storage of [window.sessionStorage, window.localStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      try {
        const parsed = JSON.parse(storage.getItem(key));
        const session = parsed?.currentSession || parsed;
        if (session?.access_token && session?.user) return session;
      } catch (_) {}
    }
  }
  return null;
}

async function ot10Api(table, { method = 'GET', select = '*', filters = {}, order = '', body = null, single = false, timeout = 12000 } = {}) {
  const url = new URL(`${OT10_URL}/rest/v1/${table}`);
  if (select) url.searchParams.set('select', select);
  if (order) url.searchParams.set('order', order);
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        apikey: OT10_KEY,
        Authorization: `Bearer ${ot10State.token}`,
        'Content-Type': 'application/json',
        Prefer: method === 'GET' ? 'count=none' : 'return=representation'
      },
      body: body === null ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.message || data?.details || `Error ${response.status}`);
    return single ? (Array.isArray(data) ? data[0] : data) : (data || []);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La carga ha tardado demasiado. Pulsa Reintentar.');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function ot10Context() {
  const session = ot10ReadSession();
  if (!session) throw new Error('No se ha encontrado la sesión. Cierra sesión y vuelve a entrar.');
  ot10State.token = session.access_token;
  ot10State.user = session.user;
  ot10State.tenant = document.querySelector('.topbar select')?.value || ot10State.tenant;
  if (!ot10State.tenant) {
    const memberships = await ot10Api('tenant_members', {
      select: 'tenant_id', filters: { user_id: `eq.${ot10State.user.id}`, estado: 'eq.activo' }, order: 'created_at.asc'
    });
    ot10State.tenant = memberships[0]?.tenant_id || null;
  }
  if (!ot10State.tenant) throw new Error('No se ha encontrado una empresa activa para este usuario.');
}

function ot10InstallStyles() {
  if (document.getElementById('ot10-styles')) return;
  const style = document.createElement('style');
  style.id = 'ot10-styles';
  style.textContent = `
    #ot10-shell{display:none;padding:18px;min-height:calc(100vh - 86px);background:#eef5f9;box-sizing:border-box}
    body.ot10-active #ot10-shell{display:block} body.ot10-active main.content{display:none!important}
    .ot10-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}.ot10-head h1{margin:0;font-size:36px;color:#0f2742}.ot10-head p{margin:6px 0 0;color:#64748b}
    .ot10-actions{display:flex;gap:9px;flex-wrap:wrap}.ot10-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f2742;font-weight:700;cursor:pointer;text-decoration:none}.ot10-btn.primary{background:#0f4c75;color:#fff;border-color:#0f4c75}.ot10-btn.danger{color:#b91c1c;border-color:#fecaca}.ot10-btn:disabled{opacity:.55}
    .ot10-card{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:17px;box-shadow:0 7px 18px rgba(15,39,66,.05)}.ot10-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.ot10-row{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid #e2e8f0}.ot10-row span{color:#64748b}
    .ot10-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ot10-tabs button{padding:9px 13px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;font-weight:700;color:#334155;cursor:pointer}.ot10-tabs button.active{background:#0f4c75;color:#fff;border-color:#0f4c75}.ot10-toolbar{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px}.ot10-toolbar input,.ot10-toolbar select{padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
    .ot10-tablewrap{overflow:auto}.ot10-table{width:100%;border-collapse:collapse;min-width:880px}.ot10-table th,.ot10-table td{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left}.ot10-table th{font-size:13px;color:#64748b}.ot10-link{color:#075985;font-weight:800;cursor:pointer}.ot10-badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:700}.ot10-badge.alta{background:#fef3c7;color:#92400e}.ot10-badge.urgente{background:#fee2e2;color:#b91c1c}
    .ot10-mobile-list{display:none}.ot10-mobile-card{background:#fff;border:1px solid #d7e0ea;border-radius:13px;padding:14px;margin-bottom:10px;cursor:pointer}.ot10-mobile-card h3{margin:0 0 6px}.ot10-mobile-card p{margin:5px 0;color:#64748b}
    .ot10-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.ot10-form label{display:flex;flex-direction:column;gap:6px;font-weight:700;color:#334155}.ot10-form input,.ot10-form select,.ot10-form textarea{padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font:inherit;box-sizing:border-box;width:100%}.ot10-full{grid-column:1/-1}
    .ot10-message{padding:12px 14px;border-radius:10px;margin:12px 0}.ot10-message.ok{background:#dcfce7;color:#166534}.ot10-message.error{background:#fee2e2;color:#991b1b}.ot10-loading{display:flex;align-items:center;gap:10px}.ot10-spinner{width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:#0f4c75;border-radius:50%;animation:ot10spin .8s linear infinite}@keyframes ot10spin{to{transform:rotate(360deg)}}
    .ot10-check{background:#fff;border:1px solid #d7e0ea;border-radius:13px;padding:14px;margin-bottom:11px}.ot10-check-top{display:grid;grid-template-columns:65px minmax(0,1fr) auto;gap:9px;align-items:start}.ot10-check-top input,.ot10-check-top textarea,.ot10-check-grid select,.ot10-check-grid textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.ot10-check-top textarea{min-height:66px}.ot10-check-grid{display:grid;grid-template-columns:180px minmax(0,1fr) 170px;gap:10px;align-items:end;margin-top:10px}.ot10-check-grid label{display:flex;flex-direction:column;gap:5px;font-weight:700}.ot10-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ot10-summary span{padding:7px 10px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:700}
    .ot10-builder{grid-column:1/-1;border:1px solid #d7e0ea;border-radius:13px;padding:13px;background:#f8fafc}.ot10-builder-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;gap:8px;align-items:center;background:#fff;border:1px solid #dbe4ee;border-radius:9px;padding:8px;margin-top:8px}.ot10-builder-row input[type=text]{padding:9px;border:1px solid #cbd5e1;border-radius:8px;width:100%;box-sizing:border-box}
    .ot10-nav{margin:4px 6px}.ot10-nav button{width:100%;display:flex;justify-content:space-between;padding:11px;border:0;border-radius:9px;background:transparent;color:#fff;font-weight:800}.ot10-navlinks{display:grid}.ot10-navlinks a{padding:10px 13px;color:#fff;text-decoration:none;border-radius:9px}.ot10-navlinks a.active,.ot10-navlinks a:hover{background:#164e70}
    .ot10-menu{display:none;position:fixed;left:12px;top:12px;z-index:8001;width:42px;height:42px;border:0;border-radius:10px;background:#0f4c75;color:#fff;font-size:22px}.ot10-overlay{display:none;position:fixed;inset:0;background:rgba(15,39,66,.45);z-index:7998}
    @media(max-width:900px){body.ot10-active .sidebar{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:280px!important;max-width:84vw!important;transform:translateX(-105%)!important;transition:.2s;z-index:8000!important;overflow-y:auto!important}body.ot10-active .sidebar.ot10-open{transform:translateX(0)!important}.ot10-menu{display:block}.ot10-overlay.ot10-open{display:block}.main-column{width:100%!important;margin:0!important;min-width:0!important}.topbar{padding:10px 10px 10px 62px!important;flex-wrap:wrap!important;gap:8px!important}#ot10-shell{padding:14px}.ot10-head{flex-direction:column}.ot10-head h1{font-size:30px}.ot10-tablewrap{display:none}.ot10-mobile-list{display:block}.ot10-form,.ot10-grid{grid-template-columns:1fr}.ot10-full{grid-column:auto}.ot10-check-top{grid-template-columns:55px minmax(0,1fr)}.ot10-check-top .ot10-actions{grid-column:1/-1}.ot10-check-grid{grid-template-columns:1fr}.ot10-builder-row{grid-template-columns:30px minmax(0,1fr) auto}.ot10-builder-row .ot10-danger{grid-column:3;grid-row:1/3}}
  `;
  document.head.appendChild(style);
}

function ot10EnsureShell() {
  let shell = document.getElementById('ot10-shell');
  if (shell) return shell;
  shell = document.createElement('section');
  shell.id = 'ot10-shell';
  const column = document.querySelector('.main-column');
  const content = document.querySelector('main.content');
  if (column && content) column.insertBefore(shell, content);
  else document.body.appendChild(shell);
  return shell;
}

function ot10InstallMenu() {
  if (!document.getElementById('ot10-menu')) {
    const button = document.createElement('button');
    button.id = 'ot10-menu'; button.className = 'ot10-menu'; button.textContent = '☰';
    const overlay = document.createElement('div'); overlay.id = 'ot10-overlay'; overlay.className = 'ot10-overlay';
    button.onclick = () => { document.querySelector('.sidebar')?.classList.toggle('ot10-open'); overlay.classList.toggle('ot10-open'); };
    overlay.onclick = ot10CloseMenu;
    document.body.append(button, overlay);
  }
  const nav = document.querySelector('.sidebar .nav-list');
  if (!nav || document.getElementById('ot10-nav')) return;
  document.querySelectorAll('#otv3-nav,#ot2-orders,#ot2-mine,#ot-nav-orders,#ot-nav-mine').forEach((node) => node.remove());
  const group = document.createElement('div');
  group.id = 'ot10-nav'; group.className = 'ot10-nav';
  group.innerHTML = `<button type="button"><span>Órdenes de trabajo</span><span>⌄</span></button><div class="ot10-navlinks"><a href="#/ots" data-ot10-go>▣ Todas las OT</a><a href="#/mis-ots" data-ot10-go>✓ Mis OT</a><a href="#/ots-creadas" data-ot10-go>✎ Creadas por mí</a></div>`;
  const anchor = [...nav.querySelectorAll('a')].find((link) => link.getAttribute('href')?.includes('/incidencias'));
  if (anchor) nav.insertBefore(group, anchor); else nav.appendChild(group);
  group.querySelector('button').onclick = () => { const links = group.querySelector('.ot10-navlinks'); links.hidden = !links.hidden; };
}

function ot10CloseMenu() {
  document.querySelector('.sidebar')?.classList.remove('ot10-open');
  document.getElementById('ot10-overlay')?.classList.remove('ot10-open');
}

function ot10Navigate(hash, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${window.location.pathname}${window.location.search}${hash}`);
  ot10RenderRoute();
  ot10CloseMenu();
}

function ot10Header(title, subtitle, actions = '') {
  return `<div class="ot10-head"><div><h1>${ot10Esc(title)}</h1><p>${ot10Esc(subtitle)}</p></div><div class="ot10-actions">${actions}</div></div>`;
}
function ot10Message(text, type = 'ok') { return `<div class="ot10-message ${type}">${ot10Esc(text)}</div>`; }
function ot10Row(label, value) { return `<div class="ot10-row"><span>${ot10Esc(label)}</span><strong>${ot10Esc(value)}</strong></div>`; }
function ot10Loading(text = 'Cargando…') { return `<div class="ot10-card ot10-loading"><span class="ot10-spinner"></span><strong>${ot10Esc(text)}</strong></div>`; }

async function ot10LoadRefs(force = false) {
  if (ot10State.refs && !force) return ot10State.refs;
  const [installations, locations, assets, members] = await Promise.all([
    ot10Api('instalaciones', { select: 'id,nombre,direccion,contacto_nombre,contacto_telefono', filters: { tenant_id: `eq.${ot10State.tenant}` }, order: 'nombre.asc' }),
    ot10Api('ubicaciones', { select: 'id,nombre,instalacion_id', filters: { tenant_id: `eq.${ot10State.tenant}` }, order: 'nombre.asc' }),
    ot10Api('activos', { select: 'id,nombre,instalacion_id,ubicacion_id,marca,modelo,numero_serie', filters: { tenant_id: `eq.${ot10State.tenant}` }, order: 'nombre.asc' }),
    ot10Api('tenant_members', { select: 'user_id,role,estado,profiles(nombre,email)', filters: { tenant_id: `eq.${ot10State.tenant}`, estado: 'eq.activo' } })
  ]);
  ot10State.refs = { installations, locations, assets, members };
  return ot10State.refs;
}

function ot10MapRefs(order, refs) {
  return {
    ...order,
    installation: refs.installations.find((item) => item.id === order.instalacion_id),
    location: refs.locations.find((item) => item.id === order.ubicacion_id),
    asset: refs.assets.find((item) => item.id === order.activo_id),
    technician: refs.members.find((item) => item.user_id === order.assigned_to)?.profiles
  };
}

async function ot10GetOrders(mode = 'all') {
  const filters = { tenant_id: `eq.${ot10State.tenant}` };
  if (mode === 'mine') filters.assigned_to = `eq.${ot10State.user.id}`;
  if (mode === 'created') filters.created_by = `eq.${ot10State.user.id}`;
  const [orders, refs] = await Promise.all([
    ot10Api('ordenes_trabajo', { select: '*', filters, order: 'created_at.desc' }),
    ot10LoadRefs()
  ]);
  return orders.map((order) => ot10MapRefs(order, refs));
}

function ot10Tabs(mode) {
  return `<div class="ot10-tabs"><button data-mode="all" class="${mode === 'all' ? 'active' : ''}">Todas las OT</button><button data-mode="mine" class="${mode === 'mine' ? 'active' : ''}">Mis OT</button><button data-mode="created" class="${mode === 'created' ? 'active' : ''}">Creadas por mí</button></div>`;
}

async function ot10RenderList(mode = 'all') {
  const shell = ot10EnsureShell();
  const title = mode === 'mine' ? 'Mis OT' : mode === 'created' ? 'OT creadas por mí' : 'Órdenes de trabajo';
  const subtitle = mode === 'mine' ? 'Órdenes asignadas a tu usuario.' : mode === 'created' ? 'Seguimiento de las órdenes que has creado.' : 'Consulta y gestiona todas las órdenes de trabajo.';
  shell.innerHTML = `${ot10Header(title, subtitle, '<button class="ot10-btn primary" data-ot10-go="#/ots/nueva">Nueva OT</button>')}${ot10Tabs(mode)}<div class="ot10-toolbar"><input id="ot10-search" placeholder="Buscar OT, trabajo o instalación"><select id="ot10-filter"><option value="">Todos los estados</option>${Object.entries(OT10_STATUSES).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></div>${ot10Loading('Cargando órdenes…')}`;
  try {
    const orders = await ot10GetOrders(mode);
    const draw = () => {
      const query = document.getElementById('ot10-search')?.value.toLowerCase() || '';
      const status = document.getElementById('ot10-filter')?.value || '';
      const rows = orders.filter((order) => (!status || order.estado === status) && (!query || [order.codigo_ot, order.titulo, order.installation?.nombre, order.technician?.nombre, order.technician?.email].some((value) => String(value || '').toLowerCase().includes(query))));
      const table = `<div class="ot10-tablewrap ot10-card"><table class="ot10-table"><thead><tr><th>OT</th><th>Trabajo</th><th>Instalación</th><th>Activo</th><th>Técnico</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>${rows.map((order) => `<tr><td><span class="ot10-link" data-ot10-go="#/ots/${order.id}">${ot10Esc(order.codigo_ot || order.id.slice(0, 8))}</span></td><td>${ot10Esc(order.titulo)}</td><td>${ot10Esc(order.installation?.nombre || '-')}</td><td>${ot10Esc(order.asset?.nombre || '-')}</td><td>${ot10Esc(order.technician?.nombre || order.technician?.email || 'Sin asignar')}</td><td><span class="ot10-badge ${order.prioridad}">${ot10Esc(order.prioridad)}</span></td><td><span class="ot10-badge">${ot10Esc(OT10_STATUSES[order.estado] || order.estado)}</span></td></tr>`).join('')}</tbody></table></div>`;
      const cards = `<div class="ot10-mobile-list">${rows.map((order) => `<article class="ot10-mobile-card" data-ot10-go="#/ots/${order.id}"><h3>${ot10Esc(order.codigo_ot || 'OT')} · ${ot10Esc(order.titulo)}</h3><p>${ot10Esc(order.installation?.nombre || '-')} · ${ot10Esc(order.asset?.nombre || '-')}</p><p>Técnico: ${ot10Esc(order.technician?.nombre || order.technician?.email || 'Sin asignar')}</p><div class="ot10-actions"><span class="ot10-badge">${ot10Esc(OT10_STATUSES[order.estado] || order.estado)}</span><span class="ot10-badge ${order.prioridad}">${ot10Esc(order.prioridad)}</span></div></article>`).join('')}</div>`;
      const loading = shell.querySelector('.ot10-loading');
      if (loading) loading.outerHTML = rows.length ? table + cards : '<div class="ot10-card"><p>No hay órdenes de trabajo.</p></div>';
      else {
        const oldTable = shell.querySelector('.ot10-tablewrap'); const oldCards = shell.querySelector('.ot10-mobile-list');
        if (oldTable) oldTable.outerHTML = rows.length ? table : '<div class="ot10-card"><p>No hay órdenes de trabajo.</p></div>';
        if (oldCards) oldCards.outerHTML = rows.length ? cards : '';
      }
    };
    draw();
    document.getElementById('ot10-search').oninput = draw;
    document.getElementById('ot10-filter').onchange = draw;
  } catch (error) {
    shell.innerHTML = `${ot10Header(title, subtitle, '<button class="ot10-btn" data-ot10-retry>Reintentar</button>')}${ot10Message(error.message, 'error')}`;
  }
}

async function ot10GetOrder(id) {
  const [order, refs] = await Promise.all([
    ot10Api('ordenes_trabajo', { select: '*', filters: { tenant_id: `eq.${ot10State.tenant}`, id: `eq.${id}` }, single: true }),
    ot10LoadRefs()
  ]);
  if (!order) throw new Error('No se ha encontrado la OT.');
  return ot10MapRefs(order, refs);
}

async function ot10RenderDetail(id) {
  const shell = ot10EnsureShell(); shell.innerHTML = ot10Loading('Cargando OT…');
  try {
    const [order, checklist] = await Promise.all([
      ot10GetOrder(id),
      ot10Api('ot_checklist_respuestas', { select: 'id,resultado', filters: { tenant_id: `eq.${ot10State.tenant}`, ot_id: `eq.${id}` } })
    ]);
    const done = checklist.filter((item) => item.resultado !== 'pendiente').length;
    shell.innerHTML = `${ot10Header(order.codigo_ot || 'OT', order.titulo, `<button class="ot10-btn" data-ot10-go="#/ots">Volver</button><button class="ot10-btn" data-ot10-go="#/ots/${id}/editar">Editar OT</button><button class="ot10-btn primary" data-ot10-go="#/ots/${id}/checklist">Checklist ${done}/${checklist.length}</button>`)}<div id="ot10-message"></div><div class="ot10-grid"><section class="ot10-card"><h2>Estado y asignación</h2>${ot10Row('Estado', OT10_STATUSES[order.estado] || order.estado)}${ot10Row('Prioridad', order.prioridad)}${ot10Row('Tipo', order.tipo)}${ot10Row('Técnico', order.technician?.nombre || order.technician?.email || 'Sin asignar')}${ot10Row('Fecha prevista', order.fecha_prevista ? new Date(order.fecha_prevista).toLocaleString() : '-')}<label style="display:block;margin-top:14px;font-weight:700">Actualizar estado<select id="ot10-status" style="display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cbd5e1;border-radius:9px">${Object.entries(OT10_STATUSES).map(([key, value]) => `<option value="${key}" ${key === order.estado ? 'selected' : ''}>${value}</option>`).join('')}</select></label></section><section class="ot10-card"><h2>Instalación y activo</h2>${ot10Row('Instalación', order.installation?.nombre || '-')}${ot10Row('Dirección', order.installation?.direccion || '-')}${ot10Row('Ubicación', order.location?.nombre || '-')}${ot10Row('Activo', order.asset?.nombre || '-')}${ot10Row('Marca/modelo', [order.asset?.marca, order.asset?.modelo].filter(Boolean).join(' / ') || '-')}${ot10Row('Nº serie', order.asset?.numero_serie || '-')}</section></div><section class="ot10-card" style="margin-top:15px"><h2>Descripción del trabajo</h2><p>${ot10Esc(order.descripcion || 'Sin descripción adicional.')}</p></section>`;
    document.getElementById('ot10-status').onchange = async (event) => {
      try {
        await ot10Api('ordenes_trabajo', { method: 'PATCH', select: 'id', filters: { tenant_id: `eq.${ot10State.tenant}`, id: `eq.${id}` }, body: { estado: event.target.value, updated_at: new Date().toISOString() } });
        document.getElementById('ot10-message').innerHTML = ot10Message('Estado actualizado.');
      } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); }
    };
  } catch (error) {
    shell.innerHTML = `${ot10Header('Orden de trabajo', 'No se ha podido cargar', '<button class="ot10-btn" data-ot10-retry>Reintentar</button>')}${ot10Message(error.message, 'error')}`;
  }
}

function ot10Template(type = 'mantenimiento') {
  const base = [['Comprobar acceso seguro y señalización de la zona de trabajo', false], ['Identificar correctamente la instalación, ubicación y activo', true], ['Registrar el estado visual inicial del equipo o instalación', true], ['Comprobar protecciones, alimentación y elementos de seguridad aplicables', false]];
  const specific = {
    averia: [['Confirmar el síntoma o avería comunicada', false], ['Localizar y documentar la causa de la avería', true], ['Realizar la reparación o indicar la actuación pendiente', true]],
    mantenimiento: [['Realizar limpieza, reapriete y revisión preventiva', true], ['Comprobar desgaste, consumibles y piezas a sustituir', false], ['Registrar ajustes y mediciones realizadas', false]],
    revision: [['Revisar documentación, identificación y etiquetado', false], ['Comprobar conexiones, protecciones y estado de conservación', true], ['Registrar mediciones y resultados', false]],
    instalacion: [['Comprobar que el montaje corresponde con lo previsto', true], ['Verificar fijaciones, conexionado y terminaciones', true], ['Realizar puesta en marcha y pruebas', false]],
    inspeccion: [['Comprobar documentación disponible', false], ['Realizar inspección visual y anotar defectos', true], ['Registrar las mediciones aplicables', false]],
    otro: [['Realizar la actuación específica indicada en la OT', true]]
  };
  return [...base, ...(specific[type] || specific.mantenimiento), ['Realizar prueba funcional final', false], ['Registrar material utilizado o pendiente', false], ['Dejar la zona limpia, ordenada y segura', true], ['Informar al responsable y recoger observaciones finales', false]].map(([text, photo]) => ({ text, photo }));
}

function ot10Builder(items) {
  return `<div id="ot10-builder">${items.map((item, index) => `<div class="ot10-builder-row"><strong>${index + 1}</strong><input class="ot10-builder-text" type="text" value="${ot10Esc(item.text)}"><label><input class="ot10-builder-photo" type="checkbox" ${item.photo ? 'checked' : ''}> Foto</label><button class="ot10-btn danger ot10-danger" type="button" data-builder-delete>Eliminar</button></div>`).join('')}</div>`;
}

function ot10WireBuilder() {
  document.querySelectorAll('[data-builder-delete]').forEach((button) => button.onclick = () => { button.closest('.ot10-builder-row').remove(); ot10RenumberBuilder(); });
}
function ot10RenumberBuilder() { document.querySelectorAll('.ot10-builder-row').forEach((row, index) => row.querySelector('strong').textContent = String(index + 1)); }

async function ot10RenderCreate() {
  const shell = ot10EnsureShell(); shell.innerHTML = ot10Loading('Preparando nueva OT…');
  try {
    const refs = await ot10LoadRefs();
    shell.innerHTML = `${ot10Header('Nueva orden de trabajo', 'Crea la OT y personaliza sus puntos.', '<button class="ot10-btn" data-ot10-go="#/ots">Volver</button>')}<div id="ot10-message"></div><section class="ot10-card"><form id="ot10-create" class="ot10-form"><label>Instalación<select id="c10-install" required><option value="">Seleccionar</option>${refs.installations.map((item) => `<option value="${item.id}">${ot10Esc(item.nombre)}</option>`).join('')}</select></label><label>Ubicación<select id="c10-location"><option value="">Sin ubicación</option></select></label><label>Activo<select id="c10-asset"><option value="">Sin activo</option></select></label><label>Técnico<select id="c10-tech"><option value="">Sin asignar</option>${refs.members.filter((item) => ['admin_cliente', 'tecnico', 'tecnico_externo'].includes(item.role)).map((item) => `<option value="${item.user_id}">${ot10Esc(item.profiles?.nombre || item.profiles?.email || item.user_id)}</option>`).join('')}</select></label><label class="ot10-full">Título<input id="c10-title" required></label><label>Tipo<select id="c10-type">${OT10_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}</select></label><label>Prioridad<select id="c10-priority">${OT10_PRIORITIES.map((priority) => `<option value="${priority}">${priority}</option>`).join('')}</select></label><label>Fecha prevista<input id="c10-date" type="datetime-local"></label><label class="ot10-full">Descripción<textarea id="c10-desc" rows="4"></textarea></label><div class="ot10-builder"><div class="ot10-actions"><button id="c10-template" class="ot10-btn" type="button">Cargar plantilla del tipo</button><button id="c10-add" class="ot10-btn" type="button">Añadir punto</button></div>${ot10Builder(ot10Template('mantenimiento'))}</div><div class="ot10-full"><button class="ot10-btn primary" type="submit">Crear OT</button></div></form></section>`;
    const installation = document.getElementById('c10-install'); const location = document.getElementById('c10-location'); const asset = document.getElementById('c10-asset');
    const updateRelated = () => { location.innerHTML = '<option value="">Sin ubicación</option>' + refs.locations.filter((item) => item.instalacion_id === installation.value).map((item) => `<option value="${item.id}">${ot10Esc(item.nombre)}</option>`).join(''); asset.innerHTML = '<option value="">Sin activo</option>' + refs.assets.filter((item) => item.instalacion_id === installation.value).map((item) => `<option value="${item.id}">${ot10Esc(item.nombre)}</option>`).join(''); };
    installation.onchange = updateRelated;
    ot10WireBuilder();
    document.getElementById('c10-template').onclick = () => { document.getElementById('ot10-builder').outerHTML = ot10Builder(ot10Template(document.getElementById('c10-type').value)); ot10WireBuilder(); };
    document.getElementById('c10-add').onclick = () => { document.getElementById('ot10-builder').insertAdjacentHTML('beforeend', `<div class="ot10-builder-row"><strong>0</strong><input class="ot10-builder-text" type="text" value="Nuevo punto"><label><input class="ot10-builder-photo" type="checkbox"> Foto</label><button class="ot10-btn danger ot10-danger" type="button" data-builder-delete>Eliminar</button></div>`); ot10RenumberBuilder(); ot10WireBuilder(); };
    document.getElementById('ot10-create').onsubmit = async (event) => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try {
        const order = await ot10Api('ordenes_trabajo', { method: 'POST', select: 'id', single: true, body: { tenant_id: ot10State.tenant, codigo_ot: `OT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, instalacion_id: installation.value, ubicacion_id: location.value || null, activo_id: asset.value || null, assigned_to: document.getElementById('c10-tech').value || null, titulo: document.getElementById('c10-title').value.trim(), descripcion: document.getElementById('c10-desc').value.trim() || null, tipo: document.getElementById('c10-type').value, prioridad: document.getElementById('c10-priority').value, estado: document.getElementById('c10-tech').value ? 'ASIGNADA' : 'BORRADOR', fecha_prevista: document.getElementById('c10-date').value ? new Date(document.getElementById('c10-date').value).toISOString() : null, created_by: ot10State.user.id } });
        const points = [...document.querySelectorAll('.ot10-builder-row')].map((row, index) => ({ tenant_id: ot10State.tenant, ot_id: order.id, orden: index + 1, punto: String(index + 1), descripcion: row.querySelector('.ot10-builder-text').value.trim(), resultado: 'pendiente', requiere_foto: row.querySelector('.ot10-builder-photo').checked, created_by: ot10State.user.id })).filter((item) => item.descripcion);
        if (points.length) await ot10Api('ot_checklist_respuestas', { method: 'POST', select: 'id', body: points });
        ot10Navigate(`#/ots/${order.id}`);
      } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); button.disabled = false; }
    };
  } catch (error) { shell.innerHTML = `${ot10Header('Nueva orden de trabajo', 'No se ha podido preparar', '<button class="ot10-btn" data-ot10-retry>Reintentar</button>')}${ot10Message(error.message, 'error')}`; }
}

async function ot10RenderEdit(id) {
  const shell = ot10EnsureShell(); shell.innerHTML = ot10Loading('Cargando edición…');
  try {
    const [order, refs] = await Promise.all([ot10GetOrder(id), ot10LoadRefs()]);
    shell.innerHTML = `${ot10Header(`Editar ${order.codigo_ot || 'OT'}`, 'Actualiza cualquier dato de la orden.', `<button class="ot10-btn" data-ot10-go="#/ots/${id}">Volver</button>`)}<div id="ot10-message"></div><section class="ot10-card"><form id="ot10-edit" class="ot10-form"><label>Instalación<select id="e10-install">${refs.installations.map((item) => `<option value="${item.id}" ${item.id === order.instalacion_id ? 'selected' : ''}>${ot10Esc(item.nombre)}</option>`).join('')}</select></label><label>Ubicación<select id="e10-location"></select></label><label>Activo<select id="e10-asset"></select></label><label>Técnico<select id="e10-tech"><option value="">Sin asignar</option>${refs.members.filter((item) => ['admin_cliente', 'tecnico', 'tecnico_externo'].includes(item.role)).map((item) => `<option value="${item.user_id}" ${item.user_id === order.assigned_to ? 'selected' : ''}>${ot10Esc(item.profiles?.nombre || item.profiles?.email || item.user_id)}</option>`).join('')}</select></label><label class="ot10-full">Título<input id="e10-title" value="${ot10Esc(order.titulo)}"></label><label>Tipo<select id="e10-type">${OT10_TYPES.map((type) => `<option value="${type}" ${type === order.tipo ? 'selected' : ''}>${type}</option>`).join('')}</select></label><label>Prioridad<select id="e10-priority">${OT10_PRIORITIES.map((priority) => `<option value="${priority}" ${priority === order.prioridad ? 'selected' : ''}>${priority}</option>`).join('')}</select></label><label>Estado<select id="e10-status">${Object.entries(OT10_STATUSES).map(([key, value]) => `<option value="${key}" ${key === order.estado ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Fecha prevista<input id="e10-date" type="datetime-local" value="${order.fecha_prevista ? new Date(new Date(order.fecha_prevista).getTime() - new Date(order.fecha_prevista).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}"></label><label class="ot10-full">Descripción<textarea id="e10-desc" rows="4">${ot10Esc(order.descripcion || '')}</textarea></label><div class="ot10-full ot10-actions"><button class="ot10-btn primary" type="submit">Guardar cambios</button><button class="ot10-btn" type="button" data-ot10-go="#/ots/${id}/checklist">Editar checklist</button></div></form></section>`;
    const installation = document.getElementById('e10-install'); const location = document.getElementById('e10-location'); const asset = document.getElementById('e10-asset');
    const updateRelated = () => { location.innerHTML = '<option value="">Sin ubicación</option>' + refs.locations.filter((item) => item.instalacion_id === installation.value).map((item) => `<option value="${item.id}" ${item.id === order.ubicacion_id ? 'selected' : ''}>${ot10Esc(item.nombre)}</option>`).join(''); asset.innerHTML = '<option value="">Sin activo</option>' + refs.assets.filter((item) => item.instalacion_id === installation.value).map((item) => `<option value="${item.id}" ${item.id === order.activo_id ? 'selected' : ''}>${ot10Esc(item.nombre)}</option>`).join(''); };
    updateRelated(); installation.onchange = () => { order.ubicacion_id = null; order.activo_id = null; updateRelated(); };
    document.getElementById('ot10-edit').onsubmit = async (event) => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try {
        await ot10Api('ordenes_trabajo', { method: 'PATCH', select: 'id', filters: { tenant_id: `eq.${ot10State.tenant}`, id: `eq.${id}` }, body: { instalacion_id: installation.value, ubicacion_id: location.value || null, activo_id: asset.value || null, assigned_to: document.getElementById('e10-tech').value || null, titulo: document.getElementById('e10-title').value.trim(), descripcion: document.getElementById('e10-desc').value.trim() || null, tipo: document.getElementById('e10-type').value, prioridad: document.getElementById('e10-priority').value, estado: document.getElementById('e10-status').value, fecha_prevista: document.getElementById('e10-date').value ? new Date(document.getElementById('e10-date').value).toISOString() : null, updated_at: new Date().toISOString() } });
        document.getElementById('ot10-message').innerHTML = ot10Message('OT actualizada correctamente.');
      } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); }
      finally { button.disabled = false; }
    };
  } catch (error) { shell.innerHTML = `${ot10Header('Editar OT', 'No se ha podido cargar', '<button class="ot10-btn" data-ot10-retry>Reintentar</button>')}${ot10Message(error.message, 'error')}`; }
}

function ot10ChecklistCard(item) {
  return `<article class="ot10-check" data-id="${item.id}"><div class="ot10-check-top"><input class="ot10-order" type="number" min="1" value="${Number(item.orden) || 1}"><textarea class="ot10-description">${ot10Esc(item.descripcion)}</textarea><div class="ot10-actions"><button class="ot10-btn" type="button" data-check-up>↑</button><button class="ot10-btn" type="button" data-check-down>↓</button><button class="ot10-btn danger" type="button" data-check-delete>Eliminar</button></div></div><div class="ot10-check-grid"><label>Resultado<select class="ot10-result"><option value="pendiente" ${item.resultado === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="ok" ${item.resultado === 'ok' ? 'selected' : ''}>OK</option><option value="no_ok" ${item.resultado === 'no_ok' ? 'selected' : ''}>No OK</option><option value="no_aplica" ${item.resultado === 'no_aplica' ? 'selected' : ''}>No aplica</option></select></label><label>Observación<textarea class="ot10-observation" rows="3">${ot10Esc(item.observacion || '')}</textarea></label><div><label style="display:flex;flex-direction:row;align-items:center;gap:6px;margin-bottom:10px"><input class="ot10-photo" type="checkbox" ${item.requiere_foto ? 'checked' : ''}> Requiere foto</label><button class="ot10-btn primary" type="button" data-check-save>Guardar punto</button></div></div></article>`;
}

function ot10UpdateSummary() {
  const cards = [...document.querySelectorAll('.ot10-check')];
  const done = cards.filter((card) => card.querySelector('.ot10-result').value !== 'pendiente').length;
  const noOk = cards.filter((card) => card.querySelector('.ot10-result').value === 'no_ok').length;
  const summary = document.getElementById('ot10-summary');
  if (summary) summary.innerHTML = `<span>${done}/${cards.length} completados</span><span>${noOk} No OK</span><span>${cards.length} puntos cargados</span>`;
}

async function ot10SaveChecklistCard(card, forcedOrder = null) {
  const order = forcedOrder ?? Number(card.querySelector('.ot10-order').value) || 1;
  const description = card.querySelector('.ot10-description').value.trim();
  if (!description) throw new Error('La descripción no puede quedar vacía.');
  await ot10Api('ot_checklist_respuestas', { method: 'PATCH', select: 'id', filters: { tenant_id: `eq.${ot10State.tenant}`, id: `eq.${card.dataset.id}` }, body: { orden: order, punto: String(order), descripcion: description, resultado: card.querySelector('.ot10-result').value, observacion: card.querySelector('.ot10-observation').value.trim() || null, requiere_foto: card.querySelector('.ot10-photo').checked, updated_at: new Date().toISOString() } });
  card.querySelector('.ot10-order').value = String(order);
}

async function ot10RenderChecklist(id) {
  const shell = ot10EnsureShell(); shell.innerHTML = ot10Loading('Cargando checklist guardado…');
  try {
    const [order, items] = await Promise.all([
      ot10GetOrder(id),
      ot10Api('ot_checklist_respuestas', { select: '*', filters: { tenant_id: `eq.${ot10State.tenant}`, ot_id: `eq.${id}` }, order: 'orden.asc,created_at.asc' })
    ]);
    const unique = [...new Map(items.map((item) => [item.id, item])).values()];
    shell.innerHTML = `${ot10Header(`Checklist ${order.codigo_ot || ''}`, order.titulo, `<button class="ot10-btn" data-ot10-go="#/ots/${id}">Volver a la OT</button><button id="ot10-reload-check" class="ot10-btn">Recargar</button><button id="ot10-save-all" class="ot10-btn primary">Guardar todos</button>`)}<div id="ot10-message"></div><div id="ot10-summary" class="ot10-summary"></div><div id="ot10-check-list">${unique.map(ot10ChecklistCard).join('')}</div><button id="ot10-add-check" class="ot10-btn" type="button">Añadir punto</button>`;
    const list = document.getElementById('ot10-check-list');
    const wire = () => {
      list.querySelectorAll('[data-check-save]').forEach((button) => button.onclick = async () => { button.disabled = true; try { await ot10SaveChecklistCard(button.closest('.ot10-check')); document.getElementById('ot10-message').innerHTML = ot10Message('Punto guardado.'); ot10UpdateSummary(); } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); } finally { button.disabled = false; } });
      list.querySelectorAll('[data-check-up]').forEach((button) => button.onclick = () => { const card = button.closest('.ot10-check'); if (card.previousElementSibling) list.insertBefore(card, card.previousElementSibling); [...list.children].forEach((item, index) => item.querySelector('.ot10-order').value = String(index + 1)); });
      list.querySelectorAll('[data-check-down]').forEach((button) => button.onclick = () => { const card = button.closest('.ot10-check'); if (card.nextElementSibling) list.insertBefore(card.nextElementSibling, card); [...list.children].forEach((item, index) => item.querySelector('.ot10-order').value = String(index + 1)); });
      list.querySelectorAll('[data-check-delete]').forEach((button) => button.onclick = async () => { if (!window.confirm('¿Eliminar este punto?')) return; const card = button.closest('.ot10-check'); try { await ot10Api('ot_checklist_respuestas', { method: 'DELETE', select: '', filters: { tenant_id: `eq.${ot10State.tenant}`, id: `eq.${card.dataset.id}` } }); card.remove(); ot10UpdateSummary(); } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); } });
      list.querySelectorAll('.ot10-result').forEach((select) => select.onchange = ot10UpdateSummary);
    };
    wire(); ot10UpdateSummary();
    document.getElementById('ot10-reload-check').onclick = () => ot10RenderChecklist(id);
    document.getElementById('ot10-save-all').onclick = async () => { const button = document.getElementById('ot10-save-all'); button.disabled = true; try { const cards = [...list.children]; for (let index = 0; index < cards.length; index += 1) await ot10SaveChecklistCard(cards[index], index + 1); document.getElementById('ot10-message').innerHTML = ot10Message('Checklist guardado y ordenado.'); ot10UpdateSummary(); } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); } finally { button.disabled = false; } };
    document.getElementById('ot10-add-check').onclick = async () => { try { const orderNumber = list.children.length + 1; const created = await ot10Api('ot_checklist_respuestas', { method: 'POST', select: '*', single: true, body: { tenant_id: ot10State.tenant, ot_id: id, orden: orderNumber, punto: String(orderNumber), descripcion: 'Nuevo punto', resultado: 'pendiente', requiere_foto: false, created_by: ot10State.user.id } }); list.insertAdjacentHTML('beforeend', ot10ChecklistCard(created)); wire(); ot10UpdateSummary(); } catch (error) { document.getElementById('ot10-message').innerHTML = ot10Message(error.message, 'error'); } };
  } catch (error) {
    shell.innerHTML = `${ot10Header('Checklist', 'No se ha podido cargar', '<button class="ot10-btn" data-ot10-retry>Reintentar</button>')}${ot10Message(error.message, 'error')}`;
  }
}

async function ot10RenderRoute() {
  if (ot10State.rendering || !ot10IsRoute()) return;
  ot10State.rendering = true;
  document.body.classList.add('ot10-active');
  ot10EnsureShell(); ot10InstallMenu();
  try {
    await ot10Context();
    const hash = window.location.hash;
    if (hash === '#/ots') await ot10RenderList('all');
    else if (hash === '#/mis-ots') await ot10RenderList('mine');
    else if (hash === '#/ots-creadas') await ot10RenderList('created');
    else if (hash === '#/ots/nueva') await ot10RenderCreate();
    else {
      let match = hash.match(/^#\/ots\/([0-9a-f-]+)\/editar$/i);
      if (match) await ot10RenderEdit(match[1]);
      else {
        match = hash.match(/^#\/ots\/([0-9a-f-]+)\/checklist$/i);
        if (match) await ot10RenderChecklist(match[1]);
        else {
          match = hash.match(/^#\/ots\/([0-9a-f-]+)$/i);
          if (match) await ot10RenderDetail(match[1]);
          else ot10Navigate('#/ots', true);
        }
      }
    }
    document.querySelectorAll('#ot10-nav a').forEach((link) => {
      const href = link.getAttribute('href');
      const active = href === window.location.hash || (href === '#/ots' && /^#\/ots\//.test(window.location.hash));
      link.classList.toggle('active', active);
    });
  } catch (error) {
    ot10EnsureShell().innerHTML = `${ot10Header('Órdenes de trabajo', 'No se ha podido cargar', '<button class="ot10-btn" data-ot10-retry>Reintentar</button>')}${ot10Message(error.message, 'error')}`;
  } finally { ot10State.rendering = false; }
}

function ot10LeaveRoute() {
  if (ot10IsRoute()) return;
  document.body.classList.remove('ot10-active');
  ot10CloseMenu();
}

function ot10Boot() {
  ot10InstallStyles(); ot10EnsureShell(); ot10InstallMenu();
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-ot10-go]');
    if (!target) return;
    const hash = target.getAttribute('data-ot10-go') || target.getAttribute('href');
    if (!ot10IsRoute(hash)) return;
    event.preventDefault(); event.stopImmediatePropagation(); ot10Navigate(hash);
  }, true);
  document.addEventListener('click', (event) => { const tab = event.target.closest('[data-mode]'); if (!tab) return; const routes = { all: '#/ots', mine: '#/mis-ots', created: '#/ots-creadas' }; ot10Navigate(routes[tab.dataset.mode]); });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-ot10-retry]')) { ot10State.refs = null; ot10RenderRoute(); } });
  window.addEventListener('popstate', () => { if (ot10IsRoute()) ot10RenderRoute(); else ot10LeaveRoute(); });
  window.addEventListener('hashchange', () => { if (ot10IsRoute()) ot10RenderRoute(); else ot10LeaveRoute(); });
  document.querySelector('.topbar select')?.addEventListener('change', () => { ot10State.tenant = null; ot10State.refs = null; if (ot10IsRoute()) ot10RenderRoute(); });
  const observer = new MutationObserver(() => { ot10InstallMenu(); ot10EnsureShell(); });
  observer.observe(document.body, { childList: true, subtree: true });
  if (ot10IsRoute()) ot10RenderRoute();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(ot10Boot, 250));
else window.setTimeout(ot10Boot, 250);
