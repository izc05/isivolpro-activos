const OT_SUPABASE_URL = 'https://ubfbhzovebrmmjpyygnm.supabase.co';
const OT_SUPABASE_KEY = 'sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac';

let otEnhanceToken = '';
let otEnhanceUser = null;
let otEnhanceTenant = null;

function otEsc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function otReadSession() {
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key));
      const session = parsed?.currentSession || parsed;
      if (session?.access_token && session?.user) return session;
    } catch (_) {
      // Continue searching other session keys.
    }
  }
  return null;
}

async function otApi(table, { method = 'GET', select = '*', filters = {}, order = '', body = null, single = false } = {}) {
  const url = new URL(`${OT_SUPABASE_URL}/rest/v1/${table}`);
  if (select) url.searchParams.set('select', select);
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  if (order) url.searchParams.set('order', order);

  const response = await fetch(url, {
    method,
    headers: {
      apikey: OT_SUPABASE_KEY,
      Authorization: `Bearer ${otEnhanceToken}`,
      'Content-Type': 'application/json',
      Prefer: method === 'GET' ? 'count=none' : 'return=representation'
    },
    body: body === null ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.details || `Error ${response.status}`);
  if (single) return Array.isArray(data) ? data[0] : data;
  return data || [];
}

async function otContext() {
  const session = otReadSession();
  if (!session) throw new Error('No se ha encontrado la sesión. Cierra sesión y vuelve a entrar.');
  otEnhanceToken = session.access_token;
  otEnhanceUser = session.user;
  otEnhanceTenant = document.querySelector('.topbar select')?.value || otEnhanceTenant;

  if (!otEnhanceTenant) {
    const memberships = await otApi('tenant_members', {
      select: 'tenant_id',
      filters: { user_id: `eq.${otEnhanceUser.id}`, estado: 'eq.activo' },
      order: 'created_at.asc'
    });
    otEnhanceTenant = memberships[0]?.tenant_id || null;
  }

  if (!otEnhanceTenant) throw new Error('No se ha encontrado una empresa activa.');
}

function otMain() {
  return document.querySelector('main.content') || document.querySelector('.content');
}

function otDefaultChecklist(type = 'mantenimiento') {
  const common = [
    { text: 'Comprobar acceso seguro y señalización de la zona de trabajo', photo: false },
    { text: 'Identificar correctamente la instalación, ubicación y activo', photo: true },
    { text: 'Registrar el estado visual inicial del equipo o instalación', photo: true },
    { text: 'Comprobar protecciones, alimentación y elementos de seguridad aplicables', photo: false }
  ];

  const specific = {
    averia: [
      { text: 'Confirmar con el responsable el síntoma o avería comunicada', photo: false },
      { text: 'Localizar y documentar la causa de la avería', photo: true },
      { text: 'Realizar la reparación o dejar indicada la actuación pendiente', photo: true }
    ],
    mantenimiento: [
      { text: 'Realizar limpieza, reapriete y revisión preventiva', photo: true },
      { text: 'Comprobar desgaste, consumibles y piezas que deban sustituirse', photo: false },
      { text: 'Registrar ajustes y mediciones realizadas', photo: false }
    ],
    revision: [
      { text: 'Revisar documentación, identificación y etiquetado', photo: false },
      { text: 'Comprobar conexiones, protecciones y estado de conservación', photo: true },
      { text: 'Registrar las mediciones y resultados de la revisión', photo: false }
    ],
    instalacion: [
      { text: 'Comprobar que el montaje corresponde con la documentación prevista', photo: true },
      { text: 'Verificar fijaciones, conexionado y terminaciones', photo: true },
      { text: 'Realizar puesta en marcha y pruebas de funcionamiento', photo: false }
    ],
    inspeccion: [
      { text: 'Comprobar la documentación disponible de la instalación', photo: false },
      { text: 'Realizar inspección visual y anotar defectos detectados', photo: true },
      { text: 'Realizar y registrar las mediciones aplicables', photo: false }
    ],
    otro: [
      { text: 'Realizar la actuación específica indicada en la orden de trabajo', photo: true }
    ]
  };

  return [
    ...common,
    ...(specific[type] || specific.mantenimiento),
    { text: 'Realizar prueba funcional final y confirmar el funcionamiento', photo: false },
    { text: 'Registrar material utilizado y material pendiente', photo: false },
    { text: 'Dejar la zona limpia, ordenada y en condiciones seguras', photo: true },
    { text: 'Informar al cliente o responsable y recoger observaciones finales', photo: false }
  ];
}

function otInstallStyles() {
  if (document.getElementById('ot-enhancement-styles')) return;
  const style = document.createElement('style');
  style.id = 'ot-enhancement-styles';
  style.textContent = `
    .ot-extra-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
    .ot-check-builder{grid-column:1/-1;border:1px solid #d7e0ea;border-radius:14px;padding:16px;background:#f8fafc}
    .ot-check-builder-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
    .ot-check-builder-list{display:grid;gap:10px}
    .ot-check-builder-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto auto;gap:10px;align-items:center;background:#fff;border:1px solid #dbe4ee;border-radius:10px;padding:10px}
    .ot-check-builder-row input[type="text"]{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px}
    .ot-check-builder-row label{display:flex!important;flex-direction:row!important;align-items:center;gap:6px;font-weight:600!important;white-space:nowrap}
    .ot-icon-button{border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700}
    .ot-check-card{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:16px;margin-bottom:12px}
    .ot-check-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .ot-check-fields{display:grid;grid-template-columns:190px minmax(0,1fr) auto;gap:12px;align-items:end;margin-top:12px}
    .ot-check-fields label{display:flex;flex-direction:column;gap:6px;font-weight:700;color:#334155}
    .ot-check-fields select,.ot-check-fields textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
    .ot-check-summary{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .ot-check-summary span{padding:7px 11px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:700}
    .ot-mobile-toggle{display:none;position:fixed;left:12px;top:12px;z-index:6002;width:42px;height:42px;border:0;border-radius:10px;background:#0f4c75;color:#fff;font-size:23px;box-shadow:0 6px 18px rgba(0,0,0,.22)}
    .ot-mobile-overlay{display:none;position:fixed;inset:0;background:rgba(15,39,66,.46);z-index:4999}
    @media(max-width:900px){
      .app-shell{display:block!important;min-width:0!important}
      .sidebar{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:275px!important;max-width:82vw!important;transform:translateX(-105%);transition:transform .22s ease;z-index:6000!important;overflow-y:auto!important}
      .sidebar.ot-mobile-open{transform:translateX(0)}
      .ot-mobile-toggle{display:block}
      .ot-mobile-overlay.ot-mobile-open{display:block}
      .main-column{width:100%!important;min-width:0!important;margin-left:0!important}
      .topbar{padding:10px 10px 10px 62px!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important;min-height:66px!important}
      .topbar>div{min-width:120px;flex:1}.topbar select{max-width:170px!important;min-width:130px!important}.topbar button{padding:9px 10px!important}
      .content{padding:16px!important;max-width:100%!important;overflow-x:hidden!important}
      .page-header{align-items:flex-start!important;flex-direction:column!important;gap:12px!important}.page-header h1{font-size:30px!important}
      .ot2-table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch}.ot2-table{min-width:760px!important}
      .ot2-grid,.ot2-form{grid-template-columns:1fr!important}.ot2-form .full{grid-column:auto!important}
      .ot-check-builder-row{grid-template-columns:30px minmax(0,1fr) auto}.ot-check-builder-row label{grid-column:2/3}.ot-check-builder-row .ot-icon-button{grid-column:3/4;grid-row:1/3}
      .ot-check-fields{grid-template-columns:1fr}.mobile-nav{display:none!important}
    }
  `;
  document.head.appendChild(style);
}

function otInstallMobileMenu() {
  if (document.getElementById('ot-mobile-toggle')) return;
  const button = document.createElement('button');
  button.id = 'ot-mobile-toggle';
  button.className = 'ot-mobile-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Abrir menú');
  button.textContent = '☰';

  const overlay = document.createElement('div');
  overlay.id = 'ot-mobile-overlay';
  overlay.className = 'ot-mobile-overlay';

  const close = () => {
    document.querySelector('.sidebar')?.classList.remove('ot-mobile-open');
    overlay.classList.remove('ot-mobile-open');
    button.textContent = '☰';
  };
  const toggle = () => {
    const open = document.querySelector('.sidebar')?.classList.toggle('ot-mobile-open');
    overlay.classList.toggle('ot-mobile-open', Boolean(open));
    button.textContent = open ? '×' : '☰';
  };

  button.addEventListener('click', toggle);
  overlay.addEventListener('click', close);
  document.addEventListener('click', (event) => {
    if (event.target.closest('.sidebar a')) close();
  });
  document.body.append(button, overlay);
}

function otBuilderRow(item, index) {
  return `<div class="ot-check-builder-row" data-index="${index}">
    <strong>${index + 1}</strong>
    <input type="text" class="ot-builder-text" value="${otEsc(item.text)}" required>
    <label><input type="checkbox" class="ot-builder-photo" ${item.photo ? 'checked' : ''}> Foto</label>
    <button class="ot-icon-button ot-builder-remove" type="button">Eliminar</button>
  </div>`;
}

function otRenderBuilder(list, items) {
  list.innerHTML = items.map(otBuilderRow).join('');
  list.querySelectorAll('.ot-builder-remove').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.ot-check-builder-row')?.remove();
      otRenumberBuilder(list);
    });
  });
}

function otRenumberBuilder(list) {
  [...list.querySelectorAll('.ot-check-builder-row')].forEach((row, index) => {
    row.dataset.index = String(index);
    row.querySelector('strong').textContent = String(index + 1);
  });
}

function otReadBuilder(form) {
  return [...form.querySelectorAll('.ot-check-builder-row')]
    .map((row) => ({
      text: row.querySelector('.ot-builder-text')?.value.trim() || '',
      photo: Boolean(row.querySelector('.ot-builder-photo')?.checked)
    }))
    .filter((item) => item.text);
}

function otEnhanceCreateForm() {
  const form = document.getElementById('ot2-form');
  if (!form || form.dataset.checklistEnhanced === 'true') return;
  form.dataset.checklistEnhanced = 'true';

  const actions = form.querySelector('.ot2-actions');
  const section = document.createElement('section');
  section.id = 'ot-checklist-builder';
  section.className = 'ot-check-builder';
  section.innerHTML = `<div class="ot-check-builder-head">
    <div><h3 style="margin:0">Checklist personalizado</h3><p class="muted" style="margin:5px 0 0">Los puntos vienen semipreparados. Puedes modificar, eliminar o añadir los que necesites.</p></div>
    <div class="ot-extra-actions"><button id="ot-load-template" class="ot2-btn" type="button">Cargar plantilla del tipo</button><button id="ot-add-check" class="ot2-btn" type="button">Añadir punto</button></div>
  </div><div id="ot-builder-list" class="ot-check-builder-list"></div>`;
  form.insertBefore(section, actions);

  const list = section.querySelector('#ot-builder-list');
  const typeSelect = document.getElementById('ot2-type');
  otRenderBuilder(list, otDefaultChecklist(typeSelect?.value || 'mantenimiento'));

  section.querySelector('#ot-load-template').addEventListener('click', () => {
    const currentRows = list.querySelectorAll('.ot-check-builder-row').length;
    if (currentRows && !window.confirm('¿Sustituir los puntos actuales por la plantilla del tipo seleccionado?')) return;
    otRenderBuilder(list, otDefaultChecklist(typeSelect?.value || 'mantenimiento'));
  });

  section.querySelector('#ot-add-check').addEventListener('click', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = otBuilderRow({ text: 'Nuevo punto de comprobación', photo: false }, list.children.length);
    const row = wrapper.firstElementChild;
    list.appendChild(row);
    row.querySelector('.ot-builder-remove').addEventListener('click', () => {
      row.remove();
      otRenumberBuilder(list);
    });
    row.querySelector('.ot-builder-text')?.focus();
    row.querySelector('.ot-builder-text')?.select();
  });
}

async function otHandleCreateSubmit(event) {
  const form = event.target;
  if (form?.id !== 'ot2-form') return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const button = event.submitter || form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  const message = document.getElementById('ot2-msg');

  try {
    await otContext();
    const installationId = document.getElementById('ot2-install')?.value;
    const title = document.getElementById('ot2-title')?.value.trim();
    if (!installationId || !title) throw new Error('Completa la instalación y el título de la OT.');

    const payload = {
      tenant_id: otEnhanceTenant,
      codigo_ot: `OT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      instalacion_id: installationId,
      ubicacion_id: document.getElementById('ot2-location')?.value || null,
      activo_id: document.getElementById('ot2-asset')?.value || null,
      assigned_to: document.getElementById('ot2-tech')?.value || null,
      titulo: title,
      descripcion: document.getElementById('ot2-desc')?.value.trim() || null,
      tipo: document.getElementById('ot2-type')?.value || 'mantenimiento',
      prioridad: document.getElementById('ot2-priority')?.value || 'media',
      estado: document.getElementById('ot2-tech')?.value ? 'ASIGNADA' : 'BORRADOR',
      fecha_prevista: document.getElementById('ot2-date')?.value ? new Date(document.getElementById('ot2-date').value).toISOString() : null,
      created_by: otEnhanceUser.id
    };

    const created = await otApi('ordenes_trabajo', { method: 'POST', body: payload, select: 'id', single: true });
    const checklist = otReadBuilder(form);
    if (checklist.length) {
      const rows = checklist.map((item, index) => ({
        tenant_id: otEnhanceTenant,
        ot_id: created.id,
        orden: index + 1,
        punto: String(index + 1),
        descripcion: item.text,
        resultado: 'pendiente',
        requiere_foto: item.photo,
        created_by: otEnhanceUser.id
      }));
      try {
        await otApi('ot_checklist_respuestas', { method: 'POST', body: rows, select: 'id' });
      } catch (checkError) {
        console.error('La OT se creó, pero no se pudo guardar el checklist', checkError);
        sessionStorage.setItem('ot-checklist-warning', checkError.message);
      }
    }

    window.location.hash = `#/ots/${created.id}`;
  } catch (error) {
    if (message) message.innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
    if (button) button.disabled = false;
  }
}

async function otLoadReferenceData(order = null) {
  await otContext();
  const [installations, locations, assets, members] = await Promise.all([
    otApi('instalaciones', { select: 'id,nombre', filters: { tenant_id: `eq.${otEnhanceTenant}` }, order: 'nombre.asc' }),
    otApi('ubicaciones', { select: 'id,nombre,instalacion_id', filters: { tenant_id: `eq.${otEnhanceTenant}` }, order: 'nombre.asc' }),
    otApi('activos', { select: 'id,nombre,instalacion_id,ubicacion_id', filters: { tenant_id: `eq.${otEnhanceTenant}` }, order: 'nombre.asc' }),
    otApi('tenant_members', { select: 'user_id,role,estado,profiles(nombre,email)', filters: { tenant_id: `eq.${otEnhanceTenant}`, estado: 'eq.activo' } })
  ]);
  return { installations, locations, assets, members, order };
}

async function otRenderEdit(orderId) {
  const main = otMain();
  if (!main) return;
  main.innerHTML = '<section class="ot2-card">Cargando edición de la OT...</section>';

  try {
    await otContext();
    const order = await otApi('ordenes_trabajo', {
      select: '*', filters: { tenant_id: `eq.${otEnhanceTenant}`, id: `eq.${orderId}` }, single: true
    });
    const refs = await otLoadReferenceData(order);

    main.innerHTML = `<div class="page-header"><div><h1>Editar ${otEsc(order.codigo_ot || 'OT')}</h1><p>Actualiza los datos y la asignación de la orden de trabajo.</p></div><button id="ot-edit-back" class="ot2-btn" type="button">Volver</button></div>
      <div id="ot-edit-message"></div><section class="ot2-card"><form id="ot-edit-form" class="ot2-form">
      <label>Instalación<select id="ot-edit-install" required></select></label><label>Ubicación<select id="ot-edit-location"></select></label>
      <label>Activo<select id="ot-edit-asset"></select></label><label>Técnico<select id="ot-edit-tech"></select></label>
      <label class="full">Título<input id="ot-edit-title" value="${otEsc(order.titulo)}" required></label>
      <label>Tipo<select id="ot-edit-type">${['averia','mantenimiento','revision','instalacion','inspeccion','otro'].map((value) => `<option value="${value}" ${order.tipo === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label>Prioridad<select id="ot-edit-priority">${['baja','media','alta','urgente'].map((value) => `<option value="${value}" ${order.prioridad === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label>Estado<select id="ot-edit-status">${['BORRADOR','ASIGNADA','ACEPTADA','EN_CURSO','PENDIENTE_MATERIAL','PENDIENTE_CLIENTE','FINALIZADA','FIRMADA','INFORME_GENERADO','CERRADA','CANCELADA'].map((value) => `<option value="${value}" ${order.estado === value ? 'selected' : ''}>${value.replaceAll('_',' ')}</option>`).join('')}</select></label>
      <label>Fecha prevista<input id="ot-edit-date" type="datetime-local" value="${order.fecha_prevista ? new Date(new Date(order.fecha_prevista).getTime() - new Date(order.fecha_prevista).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''}"></label>
      <label class="full">Descripción<textarea id="ot-edit-desc" rows="5">${otEsc(order.descripcion || '')}</textarea></label>
      <div class="full ot-extra-actions"><button class="ot2-btn primary" type="submit">Guardar cambios</button><button id="ot-edit-checklist" class="ot2-btn" type="button">Abrir checklist</button></div>
      </form></section>`;

    const install = document.getElementById('ot-edit-install');
    const location = document.getElementById('ot-edit-location');
    const asset = document.getElementById('ot-edit-asset');
    const tech = document.getElementById('ot-edit-tech');

    install.innerHTML = refs.installations.map((item) => `<option value="${item.id}" ${item.id === order.instalacion_id ? 'selected' : ''}>${otEsc(item.nombre)}</option>`).join('');
    tech.innerHTML = '<option value="">Sin asignar</option>' + refs.members.filter((item) => ['admin_cliente','tecnico','tecnico_externo'].includes(item.role)).map((item) => `<option value="${item.user_id}" ${item.user_id === order.assigned_to ? 'selected' : ''}>${otEsc(item.profiles?.nombre || item.profiles?.email || item.user_id)}</option>`).join('');

    const updateRelated = () => {
      location.innerHTML = '<option value="">Sin ubicación</option>' + refs.locations.filter((item) => item.instalacion_id === install.value).map((item) => `<option value="${item.id}" ${item.id === order.ubicacion_id ? 'selected' : ''}>${otEsc(item.nombre)}</option>`).join('');
      asset.innerHTML = '<option value="">Sin activo</option>' + refs.assets.filter((item) => item.instalacion_id === install.value).map((item) => `<option value="${item.id}" ${item.id === order.activo_id ? 'selected' : ''}>${otEsc(item.nombre)}</option>`).join('');
    };
    updateRelated();
    install.addEventListener('change', () => {
      order.ubicacion_id = null;
      order.activo_id = null;
      updateRelated();
    });

    document.getElementById('ot-edit-back').addEventListener('click', () => otRestoreDetail(orderId));
    document.getElementById('ot-edit-checklist').addEventListener('click', () => otRenderChecklist(orderId));
    document.getElementById('ot-edit-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.submitter;
      button.disabled = true;
      try {
        const patch = {
          instalacion_id: install.value,
          ubicacion_id: location.value || null,
          activo_id: asset.value || null,
          assigned_to: tech.value || null,
          titulo: document.getElementById('ot-edit-title').value.trim(),
          descripcion: document.getElementById('ot-edit-desc').value.trim() || null,
          tipo: document.getElementById('ot-edit-type').value,
          prioridad: document.getElementById('ot-edit-priority').value,
          estado: document.getElementById('ot-edit-status').value,
          fecha_prevista: document.getElementById('ot-edit-date').value ? new Date(document.getElementById('ot-edit-date').value).toISOString() : null,
          updated_at: new Date().toISOString()
        };
        await otApi('ordenes_trabajo', { method: 'PATCH', body: patch, select: 'id', filters: { tenant_id: `eq.${otEnhanceTenant}`, id: `eq.${orderId}` } });
        document.getElementById('ot-edit-message').innerHTML = '<div class="ot2-success">Orden de trabajo actualizada correctamente.</div>';
      } catch (error) {
        document.getElementById('ot-edit-message').innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  } catch (error) {
    main.innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
  }
}

function otRestoreDetail(orderId) {
  window.location.hash = '#/ots';
  window.setTimeout(() => { window.location.hash = `#/ots/${orderId}`; }, 30);
}

async function otEnsureChecklist(order) {
  let items = await otApi('ot_checklist_respuestas', {
    select: '*', filters: { tenant_id: `eq.${otEnhanceTenant}`, ot_id: `eq.${order.id}` }, order: 'orden.asc'
  });
  if (items.length) return items;

  const defaults = otDefaultChecklist(order.tipo).map((item, index) => ({
    tenant_id: otEnhanceTenant,
    ot_id: order.id,
    orden: index + 1,
    punto: String(index + 1),
    descripcion: item.text,
    resultado: 'pendiente',
    requiere_foto: item.photo,
    created_by: otEnhanceUser.id
  }));
  items = await otApi('ot_checklist_respuestas', { method: 'POST', body: defaults, select: '*' });
  return items;
}

async function otRenderChecklist(orderId) {
  const main = otMain();
  if (!main) return;
  main.innerHTML = '<section class="ot2-card">Cargando checklist...</section>';

  try {
    await otContext();
    const order = await otApi('ordenes_trabajo', {
      select: 'id,codigo_ot,titulo,tipo', filters: { tenant_id: `eq.${otEnhanceTenant}`, id: `eq.${orderId}` }, single: true
    });
    const items = await otEnsureChecklist(order);
    const completed = items.filter((item) => item.resultado !== 'pendiente').length;
    const noOk = items.filter((item) => item.resultado === 'no_ok').length;

    main.innerHTML = `<div class="page-header"><div><h1>Checklist ${otEsc(order.codigo_ot || '')}</h1><p>${otEsc(order.titulo)}</p></div><button id="ot-check-back" class="ot2-btn" type="button">Volver a la OT</button></div>
      <div id="ot-check-message"></div><section class="ot2-card"><div class="ot-check-summary"><span>${completed}/${items.length} completados</span><span>${noOk} No OK</span></div><div id="ot-check-list"></div><div class="ot-extra-actions"><button id="ot-add-point" class="ot2-btn" type="button">Añadir punto</button></div></section>`;

    const list = document.getElementById('ot-check-list');
    list.innerHTML = items.map((item) => `<article class="ot-check-card" data-id="${item.id}">
      <div class="ot-check-card-head"><div><strong>Punto ${otEsc(item.punto)}</strong><p style="margin:5px 0 0">${otEsc(item.descripcion)}</p></div><button class="ot-icon-button ot-delete-check" type="button">Eliminar</button></div>
      <div class="ot-check-fields"><label>Resultado<select class="ot-result"><option value="pendiente" ${item.resultado === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="ok" ${item.resultado === 'ok' ? 'selected' : ''}>OK</option><option value="no_ok" ${item.resultado === 'no_ok' ? 'selected' : ''}>No OK</option><option value="no_aplica" ${item.resultado === 'no_aplica' ? 'selected' : ''}>No aplica</option></select></label>
      <label>Observación<textarea class="ot-observation" rows="3">${otEsc(item.observacion || '')}</textarea></label>
      <div><label style="display:flex;flex-direction:row;align-items:center;gap:6px;margin-bottom:10px"><input class="ot-photo-required" type="checkbox" ${item.requiere_foto ? 'checked' : ''}> Requiere foto</label><button class="ot2-btn primary ot-save-check" type="button">Guardar</button></div></div>
    </article>`).join('');

    document.getElementById('ot-check-back').addEventListener('click', () => otRestoreDetail(orderId));
    list.querySelectorAll('.ot-save-check').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('.ot-check-card');
        button.disabled = true;
        try {
          await otApi('ot_checklist_respuestas', {
            method: 'PATCH', select: 'id', filters: { tenant_id: `eq.${otEnhanceTenant}`, id: `eq.${card.dataset.id}` },
            body: {
              resultado: card.querySelector('.ot-result').value,
              observacion: card.querySelector('.ot-observation').value.trim() || null,
              requiere_foto: card.querySelector('.ot-photo-required').checked,
              updated_at: new Date().toISOString()
            }
          });
          document.getElementById('ot-check-message').innerHTML = '<div class="ot2-success">Punto guardado.</div>';
        } catch (error) {
          document.getElementById('ot-check-message').innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
        } finally {
          button.disabled = false;
        }
      });
    });

    list.querySelectorAll('.ot-delete-check').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar este punto del checklist?')) return;
        const card = button.closest('.ot-check-card');
        try {
          await otApi('ot_checklist_respuestas', { method: 'DELETE', select: '', filters: { tenant_id: `eq.${otEnhanceTenant}`, id: `eq.${card.dataset.id}` } });
          card.remove();
        } catch (error) {
          document.getElementById('ot-check-message').innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
        }
      });
    });

    document.getElementById('ot-add-point').addEventListener('click', async () => {
      const description = window.prompt('Descripción del nuevo punto:');
      if (!description?.trim()) return;
      const count = list.querySelectorAll('.ot-check-card').length;
      try {
        await otApi('ot_checklist_respuestas', {
          method: 'POST', select: 'id', body: {
            tenant_id: otEnhanceTenant, ot_id: orderId, orden: count + 1, punto: String(count + 1),
            descripcion: description.trim(), resultado: 'pendiente', requiere_foto: false, created_by: otEnhanceUser.id
          }
        });
        await otRenderChecklist(orderId);
      } catch (error) {
        document.getElementById('ot-check-message').innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
      }
    });
  } catch (error) {
    main.innerHTML = `<div class="ot2-error">${otEsc(error.message)}</div>`;
  }
}

function otEnhanceDetailPage() {
  const match = window.location.hash.match(/^#\/ots\/([0-9a-f-]+)$/i);
  if (!match) return;
  const main = otMain();
  if (!main || document.getElementById('ot-detail-enhancements')) return;
  const cards = main.querySelectorAll('.ot2-card');
  if (!cards.length) return;

  const section = document.createElement('section');
  section.id = 'ot-detail-enhancements';
  section.className = 'ot2-card';
  section.style.marginTop = '16px';
  section.innerHTML = `<h2>Gestión de la OT</h2><p class="muted">Actualiza los datos de la orden o completa su checklist personalizado.</p><div class="ot-extra-actions"><button id="ot-edit-order" class="ot2-btn" type="button">Editar OT</button><button id="ot-open-checklist" class="ot2-btn primary" type="button">Abrir checklist</button></div>`;
  main.appendChild(section);
  document.getElementById('ot-edit-order').addEventListener('click', () => otRenderEdit(match[1]));
  document.getElementById('ot-open-checklist').addEventListener('click', () => otRenderChecklist(match[1]));

  const warning = sessionStorage.getItem('ot-checklist-warning');
  if (warning) {
    const box = document.createElement('div');
    box.className = 'ot2-error';
    box.textContent = `La OT se creó, pero el checklist necesita regenerarse: ${warning}`;
    main.prepend(box);
    sessionStorage.removeItem('ot-checklist-warning');
  }
}

function otBootEnhancements() {
  otInstallStyles();
  otInstallMobileMenu();
  document.addEventListener('submit', otHandleCreateSubmit, true);

  const observer = new MutationObserver(() => {
    otInstallMobileMenu();
    otEnhanceCreateForm();
    otEnhanceDetailPage();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  otEnhanceCreateForm();
  otEnhanceDetailPage();
  document.querySelector('.topbar select')?.addEventListener('change', () => { otEnhanceTenant = null; });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.setTimeout(otBootEnhancements, 300));
} else {
  window.setTimeout(otBootEnhancements, 300);
}
