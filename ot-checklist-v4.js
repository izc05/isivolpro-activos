const OT4_URL='https://ubfbhzovebrmmjpyygnm.supabase.co';
const OT4_KEY='sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac';
let ot4Token='';
let ot4User=null;
let ot4Tenant=null;
let ot4Rendering=false;

function ot4Esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function ot4Main(){return document.querySelector('main.content')||document.querySelector('.content');}
function ot4ChecklistId(){return window.location.hash.match(/^#\/ots\/([0-9a-f-]+)\/checklist$/i)?.[1]||'';}

function ot4Session(){
  for(let i=0;i<sessionStorage.length;i++){
    const key=sessionStorage.key(i);
    if(!key?.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
    try{const parsed=JSON.parse(sessionStorage.getItem(key));const session=parsed?.currentSession||parsed;if(session?.access_token&&session?.user)return session;}catch(_){ }
  }
  return null;
}

async function ot4Api(table,{method='GET',select='*',filters={},order='',body=null,single=false}={}){
  const url=new URL(`${OT4_URL}/rest/v1/${table}`);
  if(select)url.searchParams.set('select',select);
  if(order)url.searchParams.set('order',order);
  Object.entries(filters).forEach(([key,value])=>{if(value!==''&&value!==null&&value!==undefined)url.searchParams.set(key,value);});
  const response=await fetch(url,{method,headers:{apikey:OT4_KEY,Authorization:`Bearer ${ot4Token}`,'Content-Type':'application/json',Prefer:method==='GET'?'count=none':'return=representation'},body:body===null?undefined:JSON.stringify(body)});
  const text=await response.text();
  const data=text?JSON.parse(text):null;
  if(!response.ok)throw new Error(data?.message||data?.details||`Error ${response.status}`);
  return single?(Array.isArray(data)?data[0]:data):(data||[]);
}

async function ot4Context(){
  const session=ot4Session();
  if(!session)throw new Error('No se ha encontrado la sesión. Cierra sesión y vuelve a entrar.');
  ot4Token=session.access_token;
  ot4User=session.user;
  ot4Tenant=document.querySelector('.topbar select')?.value||ot4Tenant;
  if(!ot4Tenant){
    const rows=await ot4Api('tenant_members',{select:'tenant_id',filters:{user_id:`eq.${ot4User.id}`,estado:'eq.activo'},order:'created_at.asc'});
    ot4Tenant=rows[0]?.tenant_id||null;
  }
  if(!ot4Tenant)throw new Error('No se ha encontrado una empresa activa.');
}

function ot4Styles(){
  if(document.getElementById('ot4-style'))return;
  const style=document.createElement('style');
  style.id='ot4-style';
  style.textContent=`
  .ot4-root{width:100%}.ot4-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.ot4-actions{display:flex;gap:9px;flex-wrap:wrap}.ot4-btn{padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f2742;font-weight:700;cursor:pointer}.ot4-btn.primary{background:#0f4c75;color:#fff;border-color:#0f4c75}.ot4-btn.danger{color:#b91c1c;border-color:#fecaca}.ot4-btn:disabled{opacity:.55}.ot4-message{padding:12px 14px;border-radius:10px;margin:12px 0}.ot4-message.ok{background:#dcfce7;color:#166534}.ot4-message.error{background:#fee2e2;color:#991b1b}.ot4-summary{display:flex;gap:9px;flex-wrap:wrap;margin:13px 0}.ot4-summary span{padding:7px 11px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:700}.ot4-card{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:15px;margin-bottom:12px}.ot4-top{display:grid;grid-template-columns:70px minmax(0,1fr) auto;gap:10px;align-items:start}.ot4-top input,.ot4-top textarea,.ot4-grid select,.ot4-grid textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;background:#fff}.ot4-top textarea{min-height:70px}.ot4-grid{display:grid;grid-template-columns:190px minmax(0,1fr) 180px;gap:11px;align-items:end;margin-top:12px}.ot4-grid label{display:flex;flex-direction:column;gap:6px;font-weight:700;color:#334155}.ot4-photo{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;margin-bottom:10px}.ot4-empty{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:24px;text-align:center}.ot4-move{display:flex;gap:6px;flex-wrap:wrap}
  @media(max-width:900px){.ot4-head{flex-direction:column}.ot4-top{grid-template-columns:58px minmax(0,1fr)}.ot4-move{grid-column:1/-1}.ot4-grid{grid-template-columns:1fr}.ot4-actions{width:100%}.ot4-btn{flex:1}}
  `;
  document.head.appendChild(style);
}

function ot4Message(text,type='ok'){return `<div class="ot4-message ${type}">${ot4Esc(text)}</div>`;}
function ot4Card(item){
  return `<article class="ot4-card" data-id="${item.id}">
    <div class="ot4-top">
      <input class="ot4-order" type="number" min="1" value="${Number(item.orden)||1}" aria-label="Orden">
      <textarea class="ot4-description" aria-label="Descripción">${ot4Esc(item.descripcion)}</textarea>
      <div class="ot4-move"><button class="ot4-btn ot4-up" type="button">↑</button><button class="ot4-btn ot4-down" type="button">↓</button><button class="ot4-btn danger ot4-delete" type="button">Eliminar</button></div>
    </div>
    <div class="ot4-grid">
      <label>Resultado<select class="ot4-result"><option value="pendiente" ${item.resultado==='pendiente'?'selected':''}>Pendiente</option><option value="ok" ${item.resultado==='ok'?'selected':''}>OK</option><option value="no_ok" ${item.resultado==='no_ok'?'selected':''}>No OK</option><option value="no_aplica" ${item.resultado==='no_aplica'?'selected':''}>No aplica</option></select></label>
      <label>Observación<textarea class="ot4-observation" rows="3">${ot4Esc(item.observacion||'')}</textarea></label>
      <div><label class="ot4-photo"><input class="ot4-required" type="checkbox" ${item.requiere_foto?'checked':''}> Requiere foto</label><button class="ot4-btn primary ot4-save" type="button">Guardar punto</button></div>
    </div>
  </article>`;
}

function ot4Summary(){
  const cards=[...document.querySelectorAll('.ot4-card')];
  const completed=cards.filter(card=>card.querySelector('.ot4-result')?.value!=='pendiente').length;
  const noOk=cards.filter(card=>card.querySelector('.ot4-result')?.value==='no_ok').length;
  const summary=document.getElementById('ot4-summary');
  if(summary)summary.innerHTML=`<span>${completed}/${cards.length} completados</span><span>${noOk} No OK</span><span>${cards.length} puntos cargados</span>`;
}

function ot4Renumber(){
  [...document.querySelectorAll('.ot4-card')].forEach((card,index)=>{card.querySelector('.ot4-order').value=String(index+1);});
  ot4Summary();
}

async function ot4SaveCard(card,forcedOrder=null){
  const order=forcedOrder??Number(card.querySelector('.ot4-order').value)||1;
  const description=card.querySelector('.ot4-description').value.trim();
  if(!description)throw new Error('La descripción del punto no puede quedar vacía.');
  await ot4Api('ot_checklist_respuestas',{method:'PATCH',select:'id',filters:{tenant_id:`eq.${ot4Tenant}`,id:`eq.${card.dataset.id}`},body:{orden:order,punto:String(order),descripcion:description,resultado:card.querySelector('.ot4-result').value,observacion:card.querySelector('.ot4-observation').value.trim()||null,requiere_foto:card.querySelector('.ot4-required').checked,updated_at:new Date().toISOString()}});
  card.querySelector('.ot4-order').value=String(order);
}

async function ot4SaveAll(){
  const cards=[...document.querySelectorAll('.ot4-card')];
  for(let index=0;index<cards.length;index++)await ot4SaveCard(cards[index],index+1);
  document.getElementById('ot4-message').innerHTML=ot4Message('Checklist guardado correctamente.');
  ot4Summary();
}

function ot4Wire(orderId){
  const list=document.getElementById('ot4-list');
  list.querySelectorAll('.ot4-save').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{await ot4SaveCard(button.closest('.ot4-card'));document.getElementById('ot4-message').innerHTML=ot4Message('Punto guardado.');ot4Summary();}
    catch(error){document.getElementById('ot4-message').innerHTML=ot4Message(error.message,'error');}
    finally{button.disabled=false;}
  });
  list.querySelectorAll('.ot4-up').forEach(button=>button.onclick=()=>{const card=button.closest('.ot4-card');if(card.previousElementSibling)list.insertBefore(card,card.previousElementSibling);ot4Renumber();});
  list.querySelectorAll('.ot4-down').forEach(button=>button.onclick=()=>{const card=button.closest('.ot4-card');if(card.nextElementSibling)list.insertBefore(card.nextElementSibling,card);ot4Renumber();});
  list.querySelectorAll('.ot4-delete').forEach(button=>button.onclick=async()=>{
    if(!window.confirm('¿Eliminar este punto del checklist?'))return;
    const card=button.closest('.ot4-card');
    try{await ot4Api('ot_checklist_respuestas',{method:'DELETE',select:'',filters:{tenant_id:`eq.${ot4Tenant}`,id:`eq.${card.dataset.id}`}});card.remove();ot4Renumber();await ot4SaveAll();}
    catch(error){document.getElementById('ot4-message').innerHTML=ot4Message(error.message,'error');}
  });
  list.querySelectorAll('.ot4-result').forEach(select=>select.onchange=ot4Summary);
  document.getElementById('ot4-saveall').onclick=async()=>{const button=document.getElementById('ot4-saveall');button.disabled=true;try{await ot4SaveAll();}catch(error){document.getElementById('ot4-message').innerHTML=ot4Message(error.message,'error');}finally{button.disabled=false;}};
  document.getElementById('ot4-add').onclick=async()=>{
    const order=list.children.length+1;
    try{
      const created=await ot4Api('ot_checklist_respuestas',{method:'POST',select:'*',single:true,body:{tenant_id:ot4Tenant,ot_id:orderId,orden:order,punto:String(order),descripcion:'Nuevo punto',resultado:'pendiente',requiere_foto:false,created_by:ot4User.id}});
      list.insertAdjacentHTML('beforeend',ot4Card(created));
      ot4Wire(orderId);
      ot4Summary();
    }catch(error){document.getElementById('ot4-message').innerHTML=ot4Message(error.message,'error');}
  };
  document.getElementById('ot4-reload').onclick=()=>ot4Render(true);
  document.getElementById('ot4-back').onclick=()=>{window.history.pushState({},'',`${window.location.pathname}${window.location.search}#/ots/${orderId}`);window.dispatchEvent(new Event('hashchange'));};
}

async function ot4Render(force=false){
  const orderId=ot4ChecklistId();
  if(!orderId||ot4Rendering)return;
  const root=ot4Main();
  if(!root)return;
  if(!force&&root.querySelector('[data-ot4-checklist]'))return;
  ot4Rendering=true;
  ot4Styles();
  root.innerHTML='<section class="ot4-empty" data-ot4-checklist>Cargando checklist guardado...</section>';
  try{
    await ot4Context();
    const [order,items]=await Promise.all([
      ot4Api('ordenes_trabajo',{select:'id,codigo_ot,titulo,tipo',filters:{tenant_id:`eq.${ot4Tenant}`,id:`eq.${orderId}`},single:true}),
      ot4Api('ot_checklist_respuestas',{select:'*',filters:{tenant_id:`eq.${ot4Tenant}`,ot_id:`eq.${orderId}`},order:'orden.asc,created_at.asc'})
    ]);
    const unique=[...new Map(items.map(item=>[item.id,item])).values()].sort((a,b)=>(Number(a.orden)||0)-(Number(b.orden)||0)||String(a.created_at).localeCompare(String(b.created_at)));
    root.innerHTML=`<div class="ot4-root" data-ot4-checklist>
      <div class="ot4-head"><div><h1>Checklist ${ot4Esc(order.codigo_ot||'')}</h1><p>${ot4Esc(order.titulo||'')}</p></div><div class="ot4-actions"><button id="ot4-back" class="ot4-btn" type="button">Volver a la OT</button><button id="ot4-reload" class="ot4-btn" type="button">Recargar</button><button id="ot4-saveall" class="ot4-btn primary" type="button">Guardar todos</button></div></div>
      <div id="ot4-message"></div><div id="ot4-summary" class="ot4-summary"></div>
      ${unique.length?`<div id="ot4-list">${unique.map(ot4Card).join('')}</div>`:`<div class="ot4-empty"><h2>Esta OT no tiene checklist guardado</h2><p>Añade el primer punto para comenzar.</p><div id="ot4-list"></div></div>`}
      <button id="ot4-add" class="ot4-btn" type="button">Añadir punto</button>
    </div>`;
    ot4Wire(orderId);
    ot4Summary();
  }catch(error){root.innerHTML=`<div class="ot4-root" data-ot4-checklist>${ot4Message(error.message,'error')}<button class="ot4-btn" onclick="location.reload()">Reintentar</button></div>`;}
  finally{ot4Rendering=false;}
}

function ot4Boot(){
  const run=()=>{if(ot4ChecklistId())window.setTimeout(()=>ot4Render(),80);};
  window.addEventListener('hashchange',run);
  window.addEventListener('popstate',run);
  const observer=new MutationObserver(()=>{if(ot4ChecklistId()&&!ot4Main()?.querySelector('[data-ot4-checklist]'))run();});
  observer.observe(document.body,{childList:true,subtree:true});
  run();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ot4Boot,250));else setTimeout(ot4Boot,250);
