import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://ubfbhzovebrmmjpyygnm.supabase.co',
  'sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage
    }
  }
);

const STATUS_LABELS = {
  BORRADOR: 'Borrador',
  ASIGNADA: 'Asignada',
  ACEPTADA: 'Aceptada',
  EN_CURSO: 'En curso',
  PENDIENTE_MATERIAL: 'Pendiente material',
  PENDIENTE_CLIENTE: 'Pendiente cliente',
  FINALIZADA: 'Finalizada',
  FIRMADA: 'Firmada',
  INFORME_GENERADO: 'Informe generado',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada'
};

const STATUSES = Object.keys(STATUS_LABELS);
const TYPES = ['averia', 'mantenimiento', 'revision', 'instalacion', 'inspeccion', 'otro'];
const PRIORITIES = ['baja', 'media', 'alta', 'urgente'];

let lastRenderedHash = '';
let activeTenantId = null;
let currentUser = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureStyles() {
  if (document.getElementById('ot-module-styles')) return;
  const style = document.createElement('style');
  style.id = 'ot-module-styles';
  style.textContent = `
    .ot-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:18px 0}
    .ot-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f2742;font-weight:700;cursor:pointer;text-decoration:none}
    .ot-button.primary{background:#0f4c75;color:#fff;border-color:#0f4c75}.ot-button:disabled{opacity:.55;cursor:not-allowed}
    .ot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.ot-card{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:20px;box-shadow:0 8px 20px rgba(15,39,66,.05)}
    .ot-table-wrap{overflow:auto;background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:12px}.ot-table{width:100%;border-collapse:collapse;min-width:900px}.ot-table th,.ot-table td{padding:13px 12px;border-bottom:1px solid #e2e8f0;text-align:left}.ot-table th{font-size:13px;color:#475569}.ot-table a{color:#075985;font-weight:700;text-decoration:none}
    .ot-badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:700}.ot-badge.urgent{background:#fee2e2;color:#b91c1c}.ot-badge.high{background:#fef3c7;color:#92400e}
    .ot-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ot-form label{display:flex;flex-direction:column;gap:6px;font-weight:700;color:#334155}.ot-form input,.ot-form select,.ot-form textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;background:#fff}.ot-form .full{grid-column:1/-1}
    .ot-error{padding:12px 14px;background:#fee2e2;color:#991b1b;border-radius:10px;margin:12px 0}.ot-success{padding:12px 14px;background:#dcfce7;color:#166534;border-radius:10px;margin:12px 0}
    .ot-detail-list{display:grid;gap:10px}.ot-detail-row{display:flex;justify-content:space-between;gap:20px;padding-bottom:9px;border-bottom:1px solid #e2e8f0}.ot-detail-row span:first-child{color:#64748b}.ot-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
    .ot-nav-item{display:flex;align-items:center;gap:12px;padding:12px 14px;color:#fff;text-decoration:none;border-radius:9px;margin:3px 6px}.ot-nav-item:hover,.ot-nav-item.active{background:#164e70}.ot-nav-icon{width:20px;text-align:center}
    @media(max-width:800px){.ot-grid,.ot-form{grid-template-columns:1fr}.ot-form .full{grid-column:auto}}
  `;
  document.head.appendChild(style);
}

function getMain() {
  return document.querySelector('main.content') || document.querySelector('.content');
}

function injectNavigation() {
  const nav = document.querySelector('.sidebar .nav-list');
  if (!nav || document.getElementById('ot-nav-orders')) return;

  const firstOperationsItem = [...nav.querySelectorAll('a')].find((a) => a.getAttribute('href')?.includes('/incidencias'));
  const orders = document.createElement('a');
  orders.id = 'ot-nav-orders';
  orders.className = 'ot-nav-item';
  orders.href = '#/ots';
  orders.innerHTML = '<span class="ot-nav-icon">▣</span><span>Órdenes OT</span>';

  const mine = document.createElement('a');
  mine.id = 'ot-nav-mine';
  mine.className = 'ot-nav-item';
  mine.href = '#/mis-ots';
  mine.innerHTML = '<span class="ot-nav-icon">✓</span><span>Mis OT</span>';

  if (firstOperationsItem) {
    nav.insertBefore(mine, firstOperationsItem);
    nav.insertBefore(orders, mine);
  } else {
    nav.append(orders, mine);
  }
  updateNavActive();
}

function updateNavActive() {
  const hash = location.hash;
  document.getElementById('ot-nav-orders')?.classList.toggle('active', hash.startsWith('#/ots'));
  document.getElementById('ot-nav-mine')?.classList.toggle('active', hash.startsWith('#/mis-ots'));
}

async function resolveContext() {
  const { data: userData } = await supabase.auth.getUser();
  currentUser = userData.user;
  if (!currentUser) throw new Error('La sesión no está disponible. Cierra sesión y vuelve a entrar.');

  const selected = document.querySelector('.topbar select')?.value;
  if (selected) {
    activeTenantId = selected;
    return;
  }

  const { data, error } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', currentUser.id)
    .eq('estado', 'activo')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  activeTenantId = data?.tenant_id;
  if (!activeTenantId) throw new Error('No se ha encontrado una empresa activa para este usuario.');
}

function pageHeader(title, subtitle, action = '') {
  return `<div class="page-header"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${action}</div>`;
}

async function fetchOrders(onlyMine = false) {
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre), ubicaciones(nombre), activos(nombre), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', activeTenantId)
    .order('created_at', { ascending: false });
  if (onlyMine) query = query.eq('assigned_to', currentUser.id);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function renderOrders(onlyMine = false) {
  const main = getMain();
  if (!main) return;
  main.innerHTML = `${pageHeader(onlyMine ? 'Mis OT' : 'Órdenes de trabajo', onlyMine ? 'Órdenes asignadas a tu usuario.' : 'Crea, asigna y controla las órdenes de trabajo.', onlyMine ? '<a class="ot-button" href="#/ots">Ver todas</a>' : '<button id="ot-new-button" class="ot-button primary">Nueva OT</button>')}<div id="ot-message"></div><div class="ot-table-wrap"><p>Cargando órdenes...</p></div>`;

  try {
    const rows = await fetchOrders(onlyMine);
    const wrap = main.querySelector('.ot-table-wrap');
    if (!rows.length) {
      wrap.innerHTML = '<p>No hay órdenes de trabajo.</p>';
    } else {
      wrap.innerHTML = `<table class="ot-table"><thead><tr><th>OT</th><th>Trabajo</th><th>Instalación</th><th>Activo</th><th>Técnico</th><th>Prioridad</th><th>Estado</th><th>Prevista</th></tr></thead><tbody>${rows.map((row) => `<tr>
        <td><a href="#/ots/${row.id}">${escapeHtml(row.codigo_ot || row.id.slice(0,8))}</a></td>
        <td>${escapeHtml(row.titulo)}</td><td>${escapeHtml(row.instalaciones?.nombre || '-')}</td><td>${escapeHtml(row.activos?.nombre || '-')}</td>
        <td>${escapeHtml(row.assigned?.nombre || row.assigned?.email || 'Sin asignar')}</td>
        <td><span class="ot-badge ${row.prioridad === 'urgente' ? 'urgent' : row.prioridad === 'alta' ? 'high' : ''}">${escapeHtml(row.prioridad)}</span></td>
        <td><span class="ot-badge">${escapeHtml(STATUS_LABELS[row.estado] || row.estado)}</span></td>
        <td>${row.fecha_prevista ? new Date(row.fecha_prevista).toLocaleString() : '-'}</td></tr>`).join('')}</tbody></table>`;
    }
    document.getElementById('ot-new-button')?.addEventListener('click', renderCreateForm);
  } catch (error) {
    main.querySelector('.ot-table-wrap').innerHTML = `<div class="ot-error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderCreateForm() {
  const main = getMain();
  main.innerHTML = `${pageHeader('Nueva orden de trabajo', 'Asigna la OT a una instalación y a un técnico.', '<a class="ot-button" href="#/ots">Volver</a>')}<div id="ot-message"></div><section class="ot-card"><form id="ot-create-form" class="ot-form"><label>Instalación<select id="ot-installation" required><option value="">Cargando...</option></select></label><label>Ubicación<select id="ot-location"><option value="">Sin ubicación concreta</option></select></label><label>Activo<select id="ot-asset"><option value="">Sin activo concreto</option></select></label><label>Técnico<select id="ot-technician"><option value="">Sin asignar</option></select></label><label class="full">Título<input id="ot-title" required placeholder="Ej. Revisión bomba de achique"></label><label>Tipo<select id="ot-type">${TYPES.map((v) => `<option value="${v}">${v}</option>`).join('')}</select></label><label>Prioridad<select id="ot-priority">${PRIORITIES.map((v) => `<option value="${v}">${v}</option>`).join('')}</select></label><label>Fecha prevista<input id="ot-date" type="datetime-local"></label><label class="full">Descripción<textarea id="ot-description" rows="5"></textarea></label><div class="full ot-actions"><button class="ot-button primary" type="submit">Crear OT</button><a class="ot-button" href="#/ots">Cancelar</a></div></form></section>`;

  const [installationsResult, locationsResult, assetsResult, membersResult] = await Promise.all([
    supabase.from('instalaciones').select('id,nombre').eq('tenant_id', activeTenantId).order('nombre'),
    supabase.from('ubicaciones').select('id,nombre,instalacion_id').eq('tenant_id', activeTenantId).order('nombre'),
    supabase.from('activos').select('id,nombre,instalacion_id,ubicacion_id').eq('tenant_id', activeTenantId).order('nombre'),
    supabase.from('tenant_members').select('user_id,role,estado,profiles(nombre,email)').eq('tenant_id', activeTenantId).eq('estado', 'activo')
  ]);
  const failure = [installationsResult, locationsResult, assetsResult, membersResult].find((result) => result.error);
  if (failure) {
    document.getElementById('ot-message').innerHTML = `<div class="ot-error">${escapeHtml(failure.error.message)}</div>`;
    return;
  }

  const installations = installationsResult.data || [];
  const locations = locationsResult.data || [];
  const assets = assetsResult.data || [];
  const members = membersResult.data || [];
  const installationSelect = document.getElementById('ot-installation');
  const locationSelect = document.getElementById('ot-location');
  const assetSelect = document.getElementById('ot-asset');
  const technicianSelect = document.getElementById('ot-technician');

  installationSelect.innerHTML = '<option value="">Seleccionar</option>' + installations.map((row) => `<option value="${row.id}">${escapeHtml(row.nombre)}</option>`).join('');
  technicianSelect.innerHTML = '<option value="">Sin asignar</option>' + members.filter((m) => ['admin_cliente','tecnico','tecnico_externo'].includes(m.role)).map((m) => `<option value="${m.user_id}">${escapeHtml(m.profiles?.nombre || m.profiles?.email || m.user_id)}</option>`).join('');

  function updateRelated() {
    const installationId = installationSelect.value;
    locationSelect.innerHTML = '<option value="">Sin ubicación concreta</option>' + locations.filter((row) => row.instalacion_id === installationId).map((row) => `<option value="${row.id}">${escapeHtml(row.nombre)}</option>`).join('');
    assetSelect.innerHTML = '<option value="">Sin activo concreto</option>' + assets.filter((row) => row.instalacion_id === installationId).map((row) => `<option value="${row.id}">${escapeHtml(row.nombre)}</option>`).join('');
  }
  installationSelect.addEventListener('change', updateRelated);

  document.getElementById('ot-create-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    const codigo = `OT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const payload = {
      tenant_id: activeTenantId,
      codigo_ot: codigo,
      instalacion_id: installationSelect.value,
      ubicacion_id: locationSelect.value || null,
      activo_id: assetSelect.value || null,
      assigned_to: technicianSelect.value || null,
      titulo: document.getElementById('ot-title').value.trim(),
      descripcion: document.getElementById('ot-description').value.trim() || null,
      tipo: document.getElementById('ot-type').value,
      prioridad: document.getElementById('ot-priority').value,
      estado: technicianSelect.value ? 'ASIGNADA' : 'BORRADOR',
      fecha_prevista: document.getElementById('ot-date').value ? new Date(document.getElementById('ot-date').value).toISOString() : null,
      created_by: currentUser.id
    };
    const { data, error } = await supabase.from('ordenes_trabajo').insert(payload).select('id').single();
    button.disabled = false;
    if (error) {
      document.getElementById('ot-message').innerHTML = `<div class="ot-error">${escapeHtml(error.message)}</div>`;
      return;
    }
    location.hash = `#/ots/${data.id}`;
  });
}

async function renderDetail(id) {
  const main = getMain();
  main.innerHTML = `${pageHeader('Orden de trabajo', 'Cargando información...', '<a class="ot-button" href="#/ots">Volver</a>')}<div class="ot-card">Cargando...</div>`;
  const { data: row, error } = await supabase.from('ordenes_trabajo').select('*, instalaciones(nombre,direccion,contacto_nombre,contacto_telefono), ubicaciones(nombre), activos(nombre,marca,modelo,numero_serie), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)').eq('tenant_id', activeTenantId).eq('id', id).single();
  if (error) {
    main.innerHTML = `<div class="ot-error">${escapeHtml(error.message)}</div>`;
    return;
  }
  main.innerHTML = `${pageHeader(row.codigo_ot || 'Orden de trabajo', row.titulo, '<a class="ot-button" href="#/ots">Volver</a>')}<div id="ot-message"></div><div class="ot-grid"><section class="ot-card"><h2>Estado de la OT</h2><div class="ot-detail-list">${detailRow('Estado', STATUS_LABELS[row.estado] || row.estado)}${detailRow('Prioridad', row.prioridad)}${detailRow('Tipo', row.tipo)}${detailRow('Técnico', row.assigned?.nombre || row.assigned?.email || 'Sin asignar')}${detailRow('Fecha prevista', row.fecha_prevista ? new Date(row.fecha_prevista).toLocaleString() : '-')}${detailRow('Inicio', row.fecha_inicio ? new Date(row.fecha_inicio).toLocaleString() : '-')}${detailRow('Fin', row.fecha_fin ? new Date(row.fecha_fin).toLocaleString() : '-')}</div><label style="display:block;margin-top:18px;font-weight:700">Cambiar estado<select id="ot-status" style="width:100%;margin-top:6px;padding:10px;border:1px solid #cbd5e1;border-radius:9px">${STATUSES.map((status) => `<option value="${status}" ${status === row.estado ? 'selected' : ''}>${STATUS_LABELS[status]}</option>`).join('')}</select></label></section><section class="ot-card"><h2>Instalación y activo</h2><div class="ot-detail-list">${detailRow('Instalación', row.instalaciones?.nombre || '-')}${detailRow('Dirección', row.instalaciones?.direccion || '-')}${detailRow('Contacto', row.instalaciones?.contacto_nombre || '-')}${detailRow('Teléfono', row.instalaciones?.contacto_telefono || '-')}${detailRow('Ubicación', row.ubicaciones?.nombre || '-')}${detailRow('Activo', row.activos?.nombre || '-')}${detailRow('Marca / modelo', [row.activos?.marca,row.activos?.modelo].filter(Boolean).join(' / ') || '-')}${detailRow('Nº serie', row.activos?.numero_serie || '-')}</div></section></div><section class="ot-card" style="margin-top:16px"><h2>Descripción</h2><p>${escapeHtml(row.descripcion || 'Sin descripción adicional.')}</p><div class="ot-actions"><button class="ot-button" disabled>Visita — siguiente actualización</button><button class="ot-button" disabled>Checklist</button><button class="ot-button" disabled>Firma</button><button class="ot-button" disabled>PDF</button></div></section>`;

  document.getElementById('ot-status').addEventListener('change', async (event) => {
    const status = event.target.value;
    const patch = { estado: status };
    if (status === 'EN_CURSO' && !row.fecha_inicio) patch.fecha_inicio = new Date().toISOString();
    if (['FINALIZADA','FIRMADA','INFORME_GENERADO','CERRADA'].includes(status) && !row.fecha_fin) patch.fecha_fin = new Date().toISOString();
    const { error: updateError } = await supabase.from('ordenes_trabajo').update(patch).eq('id', id).eq('tenant_id', activeTenantId);
    document.getElementById('ot-message').innerHTML = updateError ? `<div class="ot-error">${escapeHtml(updateError.message)}</div>` : '<div class="ot-success">Estado actualizado.</div>';
  });
}

function detailRow(label, value) {
  return `<div class="ot-detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

async function renderRoute() {
  const hash = location.hash || '#/dashboard';
  if (!hash.startsWith('#/ots') && !hash.startsWith('#/mis-ots')) {
    lastRenderedHash = '';
    updateNavActive();
    return;
  }
  if (hash === lastRenderedHash && getMain()?.dataset.otRendered === 'true') return;
  lastRenderedHash = hash;
  ensureStyles();
  injectNavigation();
  updateNavActive();
  const main = getMain();
  if (!main) return;
  main.dataset.otRendered = 'true';
  try {
    await resolveContext();
    if (hash === '#/ots') return renderOrders(false);
    if (hash === '#/mis-ots') return renderOrders(true);
    const match = hash.match(/^#\/ots\/([0-9a-f-]+)$/i);
    if (match) return renderDetail(match[1]);
    location.hash = '#/ots';
  } catch (error) {
    main.innerHTML = `<div class="ot-error">${escapeHtml(error.message)}</div>`;
  }
}

function boot() {
  ensureStyles();
  injectNavigation();
  renderRoute();
  window.addEventListener('hashchange', () => setTimeout(renderRoute, 30));
  document.querySelector('.topbar select')?.addEventListener('change', () => {
    activeTenantId = null;
    if (location.hash.startsWith('#/ots') || location.hash.startsWith('#/mis-ots')) renderRoute();
  });
  const observer = new MutationObserver(() => {
    injectNavigation();
    if ((location.hash.startsWith('#/ots') || location.hash.startsWith('#/mis-ots')) && !getMain()?.querySelector('.ot-table-wrap,.ot-card')) {
      renderRoute();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 100));
else setTimeout(boot, 100);
