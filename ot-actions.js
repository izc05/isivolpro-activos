import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://ubfbhzovebrmmjpyygnm.supabase.co',
  'sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.sessionStorage } }
);

const DEFAULT_POINTS = [
  'Comprobar acceso seguro a la zona de trabajo',
  'Identificar instalación, ubicación y activo intervenido',
  'Revisar estado visual general del equipo o instalación',
  'Comprobar protecciones, alimentación o elementos de seguridad aplicables',
  'Realizar prueba funcional tras la intervención',
  'Registrar material utilizado o material pendiente',
  'Dejar la zona limpia, segura y operativa',
  'Informar al cliente o responsable de la actuación realizada'
];

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const main = () => document.querySelector('main.content') || document.querySelector('.content');
const tenantId = () => document.querySelector('.topbar select')?.value;
const orderId = () => (location.hash.match(/^#\/ots\/([0-9a-f-]+)/i) || [])[1];
const backButton = () => '<button class="ot-button" id="ot-action-back">Volver a la OT</button>';

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('No se ha encontrado la sesión.');
  return data.user;
}

async function getOrder() {
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('*, instalaciones(nombre,direccion), ubicaciones(nombre), activos(nombre,marca,modelo), assigned:profiles!ordenes_trabajo_assigned_to_fkey(nombre,email)')
    .eq('tenant_id', tenantId()).eq('id', orderId()).single();
  if (error) throw error;
  return data;
}

function restore() {
  window.location.reload();
}

function shell(title, subtitle, body) {
  main().innerHTML = `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${backButton()}</div>${body}`;
  document.getElementById('ot-action-back').onclick = restore;
}

async function renderVisit() {
  const order = await getOrder();
  const { data: visits, error } = await supabase.from('ot_visitas').select('*').eq('tenant_id', tenantId()).eq('ot_id', order.id).order('fecha_inicio', { ascending: false });
  if (error) throw error;
  const active = visits.find((visit) => visit.estado === 'EN_CURSO');
  shell(`Visita ${order.codigo_ot}`, order.titulo, `
    <section class="ot-card"><div id="ot-action-msg"></div>
      ${active ? `<p><strong>Visita iniciada:</strong> ${new Date(active.fecha_inicio).toLocaleString()}</p>
        <label style="display:grid;gap:8px"><strong>Observaciones</strong><textarea id="ot-visit-notes" rows="7" style="padding:10px;border:1px solid #cbd5e1;border-radius:9px">${esc(active.observaciones || '')}</textarea></label>
        <div class="ot-actions"><button class="ot-button" id="ot-save-visit">Guardar</button><button class="ot-button primary" id="ot-finish-visit">Finalizar visita</button></div>`
      : '<p>No hay una visita en curso.</p><button class="ot-button primary" id="ot-start-visit">Iniciar visita</button>'}
    </section>
    <section class="ot-card" style="margin-top:16px"><h2>Historial</h2>${visits.length ? visits.map(v => `<p><strong>${new Date(v.fecha_inicio).toLocaleString()}</strong> · ${esc(v.estado)}<br>${esc(v.observaciones || 'Sin observaciones')}</p>`).join('') : '<p>Sin visitas registradas.</p>'}</section>`);

  document.getElementById('ot-start-visit')?.addEventListener('click', async () => {
    try {
      const user = await currentUser();
      const { error: insertError } = await supabase.from('ot_visitas').insert({ tenant_id: tenantId(), ot_id: order.id, tecnico_id: user.id, estado: 'EN_CURSO' });
      if (insertError) throw insertError;
      await supabase.from('ordenes_trabajo').update({ estado: 'EN_CURSO', fecha_inicio: order.fecha_inicio || new Date().toISOString() }).eq('id', order.id);
      renderVisit();
    } catch (err) { showError(err); }
  });

  document.getElementById('ot-save-visit')?.addEventListener('click', async () => {
    const { error: updateError } = await supabase.from('ot_visitas').update({ observaciones: document.getElementById('ot-visit-notes').value }).eq('id', active.id);
    if (updateError) showError(updateError); else showSuccess('Observaciones guardadas.');
  });

  document.getElementById('ot-finish-visit')?.addEventListener('click', async () => {
    const notes = document.getElementById('ot-visit-notes').value;
    const { error: updateError } = await supabase.from('ot_visitas').update({ estado: 'FINALIZADA', fecha_fin: new Date().toISOString(), observaciones: notes }).eq('id', active.id);
    if (updateError) return showError(updateError);
    await supabase.from('ordenes_trabajo').update({ estado: 'FINALIZADA', fecha_fin: new Date().toISOString() }).eq('id', order.id);
    renderVisit();
  });
}

async function renderChecklist() {
  const order = await getOrder();
  let { data: items, error } = await supabase.from('ot_checklist_respuestas').select('*').eq('tenant_id', tenantId()).eq('ot_id', order.id).order('orden');
  if (error) throw error;
  if (!items.length) {
    const user = await currentUser();
    const payload = DEFAULT_POINTS.map((description, index) => ({ tenant_id: tenantId(), ot_id: order.id, orden: index + 1, punto: String(index + 1), descripcion: description, resultado: 'pendiente', requiere_foto: index === 1 || index === 2, created_by: user.id }));
    const result = await supabase.from('ot_checklist_respuestas').insert(payload).select();
    if (result.error) throw result.error;
    items = result.data;
  }
  shell(`Checklist ${order.codigo_ot}`, order.titulo, `<div id="ot-action-msg"></div><div>${items.map(item => `
    <section class="ot-card" style="margin-bottom:14px" data-item="${item.id}"><h2>${item.punto}. ${esc(item.descripcion)}</h2>
      <label style="display:grid;gap:8px"><strong>Resultado</strong><select class="ot-check-result" style="padding:10px;border:1px solid #cbd5e1;border-radius:9px">
        ${[['pendiente','Pendiente'],['ok','OK'],['no_ok','No OK'],['no_aplica','No aplica']].map(([value,label]) => `<option value="${value}" ${item.resultado === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      <label style="display:grid;gap:8px;margin-top:10px"><strong>Observación</strong><textarea class="ot-check-note" rows="3" style="padding:10px;border:1px solid #cbd5e1;border-radius:9px">${esc(item.observacion || '')}</textarea></label>
      <button class="ot-button ot-save-point" style="margin-top:10px">Guardar punto</button>
    </section>`).join('')}</div>`);

  document.querySelectorAll('.ot-save-point').forEach(button => button.addEventListener('click', async () => {
    const card = button.closest('[data-item]');
    const { error: updateError } = await supabase.from('ot_checklist_respuestas').update({ resultado: card.querySelector('.ot-check-result').value, observacion: card.querySelector('.ot-check-note').value, updated_at: new Date().toISOString() }).eq('id', card.dataset.item);
    if (updateError) showError(updateError); else showSuccess('Punto guardado.');
  }));
}

async function renderSignature() {
  const order = await getOrder();
  const { data: visits, error } = await supabase.from('ot_visitas').select('*').eq('tenant_id', tenantId()).eq('ot_id', order.id).order('fecha_inicio', { ascending: false });
  if (error) throw error;
  shell(`Firma ${order.codigo_ot}`, order.titulo, `<section class="ot-card"><div id="ot-action-msg"></div>
    <label style="display:grid;gap:8px"><strong>Visita</strong><select id="ot-sign-visit" style="padding:10px;border:1px solid #cbd5e1;border-radius:9px">${visits.map(v => `<option value="${v.id}">${new Date(v.fecha_inicio).toLocaleString()} · ${v.estado}</option>`).join('')}</select></label>
    <label style="display:grid;gap:8px;margin-top:10px"><strong>Nombre del firmante</strong><input id="ot-sign-name" style="padding:10px;border:1px solid #cbd5e1;border-radius:9px"></label>
    <label style="display:grid;gap:8px;margin-top:10px"><strong>DNI / identificación opcional</strong><input id="ot-sign-dni" style="padding:10px;border:1px solid #cbd5e1;border-radius:9px"></label>
    <canvas id="ot-sign-canvas" width="900" height="260" style="width:100%;height:220px;background:white;border:1px solid #cbd5e1;border-radius:10px;margin-top:14px;touch-action:none"></canvas>
    <div class="ot-actions"><button class="ot-button" id="ot-clear-sign">Limpiar</button><button class="ot-button primary" id="ot-save-sign">Guardar firma</button></div>
  </section>`);
  if (!visits.length) return showError(new Error('Primero debes iniciar una visita.'));
  const canvas = document.getElementById('ot-sign-canvas');
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.strokeStyle = '#111827'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  let drawing = false;
  const point = event => { const rect = canvas.getBoundingClientRect(); const touch = event.touches?.[0]; return { x: ((touch ? touch.clientX : event.clientX) - rect.left) * canvas.width / rect.width, y: ((touch ? touch.clientY : event.clientY) - rect.top) * canvas.height / rect.height }; };
  const start = e => { e.preventDefault(); drawing = true; const p = point(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const move = e => { if (!drawing) return; e.preventDefault(); const p = point(e); ctx.lineTo(p.x,p.y); ctx.stroke(); };
  const end = e => { e.preventDefault(); drawing = false; };
  ['mousedown','touchstart'].forEach(name => canvas.addEventListener(name,start)); ['mousemove','touchmove'].forEach(name => canvas.addEventListener(name,move)); ['mouseup','mouseleave','touchend'].forEach(name => canvas.addEventListener(name,end));
  document.getElementById('ot-clear-sign').onclick = () => { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); };
  document.getElementById('ot-save-sign').onclick = async () => {
    try {
      const name = document.getElementById('ot-sign-name').value.trim(); if (!name) throw new Error('Introduce el nombre del firmante.');
      const visitId = document.getElementById('ot-sign-visit').value;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const path = `${tenantId()}/ordenes-trabajo/${order.id}/firmas/${visitId}/firma-${Date.now()}.png`;
      const upload = await supabase.storage.from('photos-private').upload(path, blob, { contentType: 'image/png' }); if (upload.error) throw upload.error;
      const update = await supabase.from('ot_visitas').update({ nombre_firmante: name, dni_firmante: document.getElementById('ot-sign-dni').value.trim() || null, firma_bucket: 'photos-private', firma_path: path, estado: 'FINALIZADA', fecha_fin: new Date().toISOString() }).eq('id', visitId); if (update.error) throw update.error;
      await supabase.from('ordenes_trabajo').update({ estado: 'FIRMADA', fecha_fin: new Date().toISOString() }).eq('id', order.id);
      showSuccess('Firma guardada correctamente.');
    } catch (err) { showError(err); }
  };
}

async function renderReport() {
  const order = await getOrder();
  const [visitsResult, checklistResult] = await Promise.all([
    supabase.from('ot_visitas').select('*').eq('tenant_id', tenantId()).eq('ot_id', order.id).order('fecha_inicio'),
    supabase.from('ot_checklist_respuestas').select('*').eq('tenant_id', tenantId()).eq('ot_id', order.id).order('orden')
  ]);
  if (visitsResult.error) throw visitsResult.error; if (checklistResult.error) throw checklistResult.error;
  const visits = visitsResult.data || [], checklist = checklistResult.data || [];
  shell(`Informe ${order.codigo_ot}`, order.titulo, `<section class="ot-card" id="ot-print-area">
    <h1>Informe de Orden de Trabajo</h1><p><strong>OT:</strong> ${esc(order.codigo_ot)}</p><p><strong>Instalación:</strong> ${esc(order.instalaciones?.nombre || '-')}</p><p><strong>Activo:</strong> ${esc(order.activos?.nombre || '-')}</p><p><strong>Técnico:</strong> ${esc(order.assigned?.nombre || order.assigned?.email || '-')}</p><p><strong>Estado:</strong> ${esc(order.estado)}</p><p><strong>Descripción:</strong> ${esc(order.descripcion || '-')}</p>
    <h2>Visitas</h2>${visits.length ? visits.map(v => `<p><strong>${new Date(v.fecha_inicio).toLocaleString()}</strong> · ${esc(v.estado)}<br>${esc(v.observaciones || '')}${v.nombre_firmante ? `<br>Firmante: ${esc(v.nombre_firmante)}` : ''}</p>`).join('') : '<p>Sin visitas.</p>'}
    <h2>Checklist</h2>${checklist.length ? checklist.map(i => `<p><strong>${i.punto}. ${esc(i.descripcion)}</strong><br>Resultado: ${esc(i.resultado)}<br>${esc(i.observacion || '')}</p>`).join('') : '<p>Sin checklist.</p>'}
  </section><div class="ot-actions"><button class="ot-button primary" id="ot-print-report">Imprimir / Guardar PDF</button></div>`);
  document.getElementById('ot-print-report').onclick = () => window.print();
}

function showError(error) { const box = document.getElementById('ot-action-msg'); if (box) box.innerHTML = `<div class="ot-error">${esc(error.message || error)}</div>`; }
function showSuccess(text) { const box = document.getElementById('ot-action-msg'); if (box) box.innerHTML = `<div class="ot-success">${esc(text)}</div>`; }

function enhance() {
  if (!orderId()) return;
  const buttons = [...document.querySelectorAll('.ot-actions button')];
  buttons.forEach(button => {
    const text = button.textContent.trim().toLowerCase();
    if (button.dataset.otEnabled) return;
    if (text.startsWith('visita')) { button.disabled = false; button.dataset.otEnabled = '1'; button.onclick = () => renderVisit().catch(showError); }
    else if (text === 'checklist') { button.disabled = false; button.dataset.otEnabled = '1'; button.onclick = () => renderChecklist().catch(showError); }
    else if (text === 'firma') { button.disabled = false; button.dataset.otEnabled = '1'; button.onclick = () => renderSignature().catch(showError); }
    else if (text === 'pdf') { button.disabled = false; button.dataset.otEnabled = '1'; button.onclick = () => renderReport().catch(showError); }
  });
}

new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
setTimeout(enhance, 300);
