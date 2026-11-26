/* ZUMUYA GROUP — messagerie entre tous les utilisateurs (clients, vendeurs, restaurants, hôtels, producteurs, livraison).
   Liens d'ouverture directe (utilisés par les boutons « Contacter ») :
     messagerie.html?kind=store&ref=<id boutique>        vendeur Marketplace
     messagerie.html?kind=org&ref=<id organisation>      restaurant, hôtel, société…
     messagerie.html?kind=rest&ref=<id restaurant>       restaurant du ZUMUYA Restauration
     messagerie.html?kind=user&ref=<id utilisateur>      producteur agricole, particulier
     messagerie.html?kind=delivery_offer&ref=<id offre>  échange vendeur <-> société de livraison
     messagerie.html?to=<id utilisateur>                 ancien format, toujours accepté
   Paramètres facultatifs : subject, ctx_type, ctx_id. Une même conversation est réutilisée pour un même contexte. */
(()=>{'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb,me,active=null,threads=[],lastMsgId=null,timer=null,dirKind='store',dirData={store:null,rest:null,agro:null};
const ROLES={customer:'Client',restaurant:'Restaurant',hotel:'Hôtel',agro_producer:'Producteur agricole',agro_trader:'Commerçant agricole',marketplace:'Vendeur Marketplace',delivery_service:'Société de livraison',delivery:'Livreur',staff:'Équipe',commerce:'Commerce',business:'Entreprise'};
const role=r=>ROLES[r]||'Compte ZUMUYA';
const status=(t,err)=>{const el=$('#chatStatus');el.textContent=t||'';el.style.color=err?'#a32121':''};
const sameDay=(a,b)=>a.toDateString()===b.toDateString();
const hm=d=>d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
const short=t=>{const d=new Date(t),n=new Date();return sameDay(d,n)?hm(d):d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})};
const dayLabel=d=>{const n=new Date(),y=new Date(Date.now()-864e5);return sameDay(d,n)?'Aujourd’hui':sameDay(d,y)?'Hier':d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})};
const ctxTag=t=>t.context_type==='delivery_request'?'<span class="tag">🚚 Livraison</span>':'';

async function start(){
  const c=window.ZUMAYA_CONFIG||{};if(!window.supabase||!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)throw Error('Configuration Supabase indisponible.');
  sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
  const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('compte.html');return}
  me=session.user;
  const p=new URLSearchParams(location.search);let kind=p.get('kind'),ref=p.get('ref');const to=p.get('to');
  if(!kind&&to){kind='user';ref=to}
  if(kind&&ref){
    const {data,error}=await sb.rpc('rg_market_chat_open',{p_kind:kind,p_ref:ref,p_subject:p.get('subject')||null,p_ctx_type:p.get('ctx_type')||null,p_ctx_id:p.get('ctx_id')||null});
    history.replaceState({},'','messagerie.html');
    if(error)status(error.message||'Impossible d’ouvrir la conversation.',true);else active=data;
  }
  await loadThreads();
  if(active)await openThread(active);
  bind();realtime();
  timer=setInterval(()=>{if(document.hidden)return;loadThreads().catch(()=>{});if(active)loadMessages(active,true).catch(()=>{})},12000);
  if(!active)status('');
}

async function loadThreads(){
  const {data,error}=await sb.rpc('rg_market_chat_threads');if(error)throw error;threads=data||[];renderThreads();
  const total=threads.reduce((n,t)=>n+Number(t.unread_count||0),0);
  $('#unreadTotal').innerHTML=total?'<span class="badge">'+total+'</span>':'';document.title=(total?'('+total+') ':'')+'Messagerie — ZUMUYA GROUP';
}
function renderThreads(){
  const q=($('#threadSearch').value||'').toLowerCase().trim();
  const rows=threads.filter(t=>!q||((t.other_name||'')+' '+(t.subject||'')+' '+(t.last_body||'')).toLowerCase().includes(q));
  $('#chatThreads').innerHTML=rows.map(t=>{const n=Number(t.unread_count||0),mine=t.last_sender===me.id,prev=t.last_body?((t.last_kind==='system'?'':mine?'Vous : ':'')+t.last_body):'Nouvelle conversation';
    return `<button type="button" class="chat-thread ${active===t.conversation_id?'active':''} ${n?'unread':''}" data-thread="${esc(t.conversation_id)}"><div class="t1"><b>${esc(t.other_name||'Utilisateur ZUMUYA')}</b><time>${short(t.last_at||t.updated_at)}</time></div><div class="t2">${ctxTag(t)}${esc(prev)}${n?'<span class="badge">'+n+'</span>':''}</div></button>`}).join('')
   ||'<p class="chat-empty">'+(q?'Aucune conversation trouvée.':'Aucune conversation pour le moment. Utilisez « Nouvelle conversation » ou le bouton Contacter d’un vendeur, restaurant ou hôtel.')+'</p>';
}

async function openThread(id){
  active=id;lastMsgId=null;$('#layout').classList.add('thread-open');$('#chatBody').disabled=false;$('#chatSend button').disabled=false;
  const t=threads.find(x=>x.conversation_id===id);
  $('#chatTitle').innerHTML=`<h2>${esc(t?.other_name||'Conversation')}</h2><p class="chat-note">${esc(role(t?.other_role))}${t?.subject?' · '+esc(t.subject):''}</p>`;
  renderThreads();await loadMessages(id);
  $('#chatBody').focus({preventScroll:true});
}
async function markRead(id){try{await sb.rpc('rg_market_chat_mark_read',{p_conversation:id});const t=threads.find(x=>x.conversation_id===id);if(t&&Number(t.unread_count)){t.unread_count=0;renderThreads();const total=threads.reduce((n,x)=>n+Number(x.unread_count||0),0);$('#unreadTotal').innerHTML=total?'<span class="badge">'+total+'</span>':'';document.title=(total?'('+total+') ':'')+'Messagerie — ZUMUYA GROUP'}}catch(_){}}
async function loadMessages(id,quiet){
  const {data,error}=await sb.from('rg_market_messages').select('id,sender_id,body,created_at,kind').eq('conversation_id',id).order('created_at',{ascending:true}).limit(400);if(error)throw error;
  if(id!==active)return;const last=data&&data.length?data[data.length-1].id:null;if(quiet&&last===lastMsgId)return;lastMsgId=last;
  const box=$('#chatMessages'),near=box.scrollHeight-box.scrollTop-box.clientHeight<120;let prev=null,html='';
  for(const m of data||[]){const d=new Date(m.created_at);if(!prev||!sameDay(prev,d))html+='<div class="chat-day">'+esc(dayLabel(d))+'</div>';prev=d;
    html+=m.kind==='system'?`<div class="chat-sys">${esc(m.body).replace(/\n/g,'<br>')}</div>`:`<div class="chat-bubble ${m.sender_id===me.id?'mine':''}">${esc(m.body).replace(/\n/g,'<br>')}<small>${hm(d)}</small></div>`}
  box.innerHTML=html||'<p class="chat-empty">Démarrez la conversation : dites bonjour 👋</p>';
  if(near||!quiet)box.scrollTop=box.scrollHeight;
  if(!document.hidden)markRead(id);
}

async function send(){
  const ta=$('#chatBody'),body=ta.value.trim();if(!active||!body)return;const b=$('#chatSend button');b.disabled=true;
  try{const {error}=await sb.from('rg_market_messages').insert({conversation_id:active,sender_id:me.id,body});if(error)throw error;ta.value='';ta.style.height='';status('');await loadMessages(active);await loadThreads()}
  catch(err){status(err.message||'Message non envoyé.',true)}finally{b.disabled=false;ta.focus()}
}

function realtime(){
  try{sb.channel('chat-'+me.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'rg_market_messages'},p=>{
    const m=p.new||{};loadThreads().catch(()=>{});if(m.conversation_id===active)loadMessages(active,true).catch(()=>{})}).subscribe()}catch(_){}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadThreads().catch(()=>{});if(active)loadMessages(active,true).catch(()=>{})}});
}

/* Annuaire : boutiques, restaurants et hôtels, producteurs */
async function pub(path){const c=window.ZUMAYA_CONFIG,r=await fetch(c.SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:'Bearer '+c.SUPABASE_ANON_KEY}});if(!r.ok)throw Error('Annuaire indisponible');return r.json()}
async function loadDir(kind){
  if(dirData[kind])return dirData[kind];
  if(kind==='store'){const {data,error}=await sb.from('commerce_stores').select('id,store_name,city,owner_id').eq('is_active',true).order('store_name').limit(200);if(error)throw error;
    dirData.store=(data||[]).filter(x=>x.owner_id!==me.id).map(x=>({k:'store',ref:x.id,name:x.store_name,sub:'Boutique · '+(x.city||'')}))}
  else if(kind==='agro'){const {data,error}=await sb.from('rg_agro_profiles').select('user_id,business_name,role,city').eq('is_active',true).order('business_name').limit(200);if(error)throw error;
    dirData.agro=(data||[]).filter(x=>x.user_id!==me.id).map(x=>({k:'user',ref:x.user_id,name:x.business_name,sub:(x.role==='agro_trader'?'Commerçant agricole':'Producteur')+' · '+(x.city||'')}))}
  else{const [orgs,rests]=await Promise.all([pub('rg_organizations?select=id,organization_type,public_name,city&organization_type=in.(restaurant,hotel)&order=public_name').catch(()=>[]),pub('rg_rests?select=id,data&order=seq.asc').catch(()=>[])]);
    const ids=new Set(orgs.map(o=>o.id)),names=new Set(orgs.map(o=>(o.public_name||'').trim().toLowerCase()));
    const a=orgs.map(o=>({k:'org',ref:o.id,name:o.public_name,sub:(o.organization_type==='hotel'?'Hôtel':'Restaurant')+' · '+(o.city||'')}));
    const b=(rests||[]).map(x=>x.data).filter(Boolean).filter(r=>!(r.portalOrgId&&ids.has(r.portalOrgId))&&!names.has((r.name||'').trim().toLowerCase())).map(r=>({k:'rest',ref:r.id,name:r.name,sub:((r.businessType==='hotel'||(r.hotel&&r.hotel.enabled))?'Hôtel':'Restaurant')+' · '+(r.address||'')}));
    dirData.rest=a.concat(b)}
  return dirData[kind];
}
async function renderDir(){
  const box=$('#chatDirectory');box.innerHTML='<p class="chat-empty">Chargement…</p>';
  try{const rows=await loadDir(dirKind),q=($('#actorSearch').value||'').toLowerCase().trim();
    const f=rows.filter(x=>!q||((x.name||'')+' '+x.sub).toLowerCase().includes(q)).slice(0,60);
    box.innerHTML=f.map(x=>`<button type="button" class="chat-thread" data-k="${esc(x.k)}" data-ref="${esc(x.ref)}" data-name="${esc(x.name)}"><b>${esc(x.name||'Sans nom')}</b><div class="t2">${esc(x.sub)}</div></button>`).join('')||'<p class="chat-empty">Aucun contact trouvé.</p>'}
  catch(e){box.innerHTML='<p class="chat-empty">'+esc(e.message||'Annuaire indisponible.')+'</p>'}
}
async function startWith(k,ref,name){
  try{const {data,error}=await sb.rpc('rg_market_chat_open',{p_kind:k,p_ref:ref,p_subject:'Échange avec '+(name||'un contact')});if(error)throw error;
    $('#dir').open=false;await loadThreads();await openThread(data)}catch(e){status(e.message||'Contact impossible.',true)}
}

function bind(){
  $('#chatThreads').addEventListener('click',e=>{const b=e.target.closest('[data-thread]');if(b)openThread(b.dataset.thread).catch(x=>status(x.message,true))});
  $('#threadSearch').addEventListener('input',renderThreads);
  $('#backBtn').addEventListener('click',()=>{$('#layout').classList.remove('thread-open');active=null;renderThreads()});
  $('#dir').addEventListener('toggle',()=>{if($('#dir').open)renderDir()});
  $('#dirTabs').addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(!b)return;dirKind=b.dataset.d;$('#dirTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderDir()});
  $('#actorSearch').addEventListener('input',()=>renderDir());
  $('#chatDirectory').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)startWith(b.dataset.k,b.dataset.ref,b.dataset.name)});
  $('#chatSend').addEventListener('submit',e=>{e.preventDefault();send()});
  const ta=$('#chatBody');
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}});
  ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,140)+'px'});
}
start().catch(e=>status(e.message||'Messagerie indisponible. Vérifiez que la migration 17 est installée dans Supabase.',true));
})();
