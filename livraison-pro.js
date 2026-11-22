/* ZUMUYA GROUP — espace société de livraison : disponibilité, zones de desserte, offres reçues (accepter / refuser), missions. */
(()=>{'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FCFA';
const km=n=>n==null?'—':Number(n).toLocaleString('fr-FR',{maximumFractionDigits:1})+' km';
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
const SRC={commerce_order:'🛍️ Marketplace',supply_order:'🌾 Approvisionnement agricole',agro_request:'🌾 Produits agricoles'};
let sb,user,org=null,provider=null,zones=[],inbox=[],filter='todo',editing=null,gps=null,timer=null;
const say=(t,err)=>{const e=$('#proMsg');if(e){e.textContent=t||'';e.className='notice'+(err?' err':'');e.hidden=!t}};

async function init(){
  const el=$('#status'),c=window.ZUMAYA_CONFIG||{};
  if(!window.supabase||!c.SUPABASE_URL)throw Error('Configuration Supabase indisponible.');
  sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
  const {data:{user:u}}=await sb.auth.getUser();if(!u){location.replace('compte.html');return}user=u;
  const {data,error}=await sb.from('rg_organizations').select('id,public_name,organization_type,city').eq('owner_id',u.id).in('organization_type',['delivery','delivery_service','logistics']).limit(1).maybeSingle();
  if(error)throw error;
  if(!data){el.textContent='Aucune société de livraison n’est rattachée à ce compte. Activez le pôle depuis Mon compte.';$('#pro').hidden=true;return}
  org=data;el.textContent='Connecté : '+data.public_name+' · Espace entreprise prêt.';$('#pro').hidden=false;
  await Promise.all([loadProvider(),loadZones()]);await loadInbox();bind();
  try{sb.channel('liv-'+org.id).on('postgres_changes',{event:'*',schema:'public',table:'rg_delivery_offers'},()=>loadInbox().catch(()=>{})).subscribe()}catch(_){}
  timer=setInterval(()=>{if(!document.hidden)loadInbox().catch(()=>{})},20000);
}

async function loadProvider(){const {data}=await sb.from('rg_delivery_providers').select('is_available,note').eq('org_id',org.id).maybeSingle();provider=data||{is_available:true,note:'',_new:true};renderProvider()}
function renderProvider(){
  $('#avail').checked=!!provider.is_available;
  $('#availTxt').innerHTML=provider.is_available?'<b style="color:#0b6b3a">● Disponible</b> — vous recevez les demandes de votre zone.':'<b style="color:#a32121">● Indisponible</b> — vous ne recevez plus de nouvelles demandes.';
  const warn=!zones.length?'<div class="notice err" style="margin-top:8px">Ajoutez au moins une zone de desserte : sans zone, aucune demande ne peut vous être proposée.</div>':'';$('#zoneWarn').innerHTML=warn;
}
async function loadZones(){const {data,error}=await sb.from('rg_delivery_zones').select('*').eq('org_id',org.id).order('created_at');if(error)throw error;zones=data||[];renderZones();renderProvider()}
function renderZones(){
  $('#zoneList').innerHTML=zones.map(z=>`<div class="zrow"><div><b>${esc(z.label)}</b> ${z.is_active?'':'<span class="tg no">Désactivée</span>'}<div class="muted">${esc(z.city||'')}${z.center_lat!=null?' · rayon '+km(z.radius_km)+' autour du point GPS':' · toute la ville'}<br>Tarif : ${money(z.base_fee)} + ${money(z.per_km_fee)} / km</div></div><div class="acts"><button class="btn alt sm" data-zedit="${esc(z.id)}">Modifier</button><button class="btn danger sm" data-zdel="${esc(z.id)}">Supprimer</button></div></div>`).join('')||'<p class="muted">Aucune zone pour le moment.</p>';
}
function fillZone(z){editing=z?z.id:null;const f=$('#zoneForm').elements;gps=z&&z.center_lat!=null?{lat:z.center_lat,lng:z.center_lng}:null;
  f.label.value=z?z.label:'';f.city.value=z?z.city||'':org.city||'';f.radius.value=z?z.radius_km:15;f.base.value=z?z.base_fee:500;f.perkm.value=z?z.per_km_fee:100;f.active.checked=z?z.is_active:true;
  $('#zoneGps').textContent=gps?'✔ Centre GPS défini':'Sans GPS : la zone couvre la ville indiquée';$('#zoneTitle').textContent=z?'Modifier la zone':'Ajouter une zone de desserte';$('#zoneCancel').hidden=!z}

const STATUS_TXT={pending:['À traiter','wait'],accepted:['Acceptée','ok'],declined:['Refusée','no'],closed:['Prise par une autre société',''],cancelled:['Annulée par le vendeur','no'],expired:['Expirée','no']};
function bucket(o){if(o.offer_status==='pending'&&o.request_status==='open')return'todo';if(o.offer_status==='accepted'&&['assigned','picked_up'].includes(o.request_status))return'active';return'history'}
async function loadInbox(){
  const {data,error}=await sb.rpc('rg_delivery_inbox',{p_org:org.id});if(error)throw error;inbox=data||[];renderInbox();
  const n=inbox.filter(o=>bucket(o)==='todo').length;document.title=(n?'('+n+') ':'')+'Entreprise de livraison — ZUMUYA GROUP';
}
function left(t){const ms=new Date(t)-Date.now();if(ms<=0)return'expirée';const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return h?h+' h '+m+' min':m+' min'}
function renderInbox(){
  const cnt={todo:0,active:0,history:0};inbox.forEach(o=>cnt[bucket(o)]++);
  $('#inboxTabs').innerHTML=[['todo','📥 À traiter'],['active','🚚 En cours'],['history','🗂️ Historique']].map(x=>`<button type="button" data-f="${x[0]}" class="${filter===x[0]?'on':''}">${x[1]} <b>${cnt[x[0]]}</b></button>`).join('');
  const rows=inbox.filter(o=>bucket(o)===filter);
  $('#inbox').innerHTML=rows.map(o=>{const s=STATUS_TXT[o.offer_status]||[o.offer_status,''],b=bucket(o);
    const head=`<div class="ohead"><div><b>${esc(o.ref)}</b> <span class="tg ${s[1]}">${esc(s[0])}</span> <span class="muted">${esc(SRC[o.source_type]||o.source_type)}</span></div><span class="muted">${new Date(o.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</span></div>`;
    const route=`<div class="route">📦 ${esc(o.pickup_city||'?')} <span>→</span> 🏠 ${esc(o.dest_city||'?')}</div><div class="muted">Vendeur : ${esc(o.requester_name||'')} · à ${km(o.distance_km)} de votre base · trajet ≈ ${km(o.trip_km)} · estimation ${money(o.estimated_fee)}${o.offer_status==='accepted'?' · convenu '+money(o.proposed_fee):''}</div>${o.parcel_note?`<div class="note">📝 ${esc(o.parcel_note)}</div>`:''}`;
    let body='';
    if(b==='todo')body=`<div class="muted">⏳ Répondre avant : ${esc(left(o.expires_at))}</div><div class="acts"><label class="muted">Votre tarif (FCFA)<input type="number" min="0" step="50" value="${o.estimated_fee!=null?Math.round(o.estimated_fee):''}" data-fee="${esc(o.offer_id)}"></label><button class="btn" data-acc="${esc(o.offer_id)}">✅ Accepter</button><button class="btn danger" data-ref="${esc(o.offer_id)}">Refuser</button><a class="btn alt" href="messagerie.html?kind=delivery_offer&ref=${encodeURIComponent(o.offer_id)}">💬 Poser une question</a></div>`;
    else if(b==='active')body=`<div class="addr">📍 Enlèvement : <b>${esc(o.pickup_address||o.pickup_city||'')}</b><br>🏠 Livraison : <b>${esc(o.dest_address||o.dest_city||'')}</b></div><div class="acts">${o.request_status==='assigned'?`<button class="btn" data-st="picked_up" data-req="${esc(o.request_id)}">📦 Colis récupéré</button>`:''}<button class="btn" data-st="delivered" data-req="${esc(o.request_id)}">✅ Marquer livré</button><a class="btn alt" href="messagerie.html?kind=delivery_offer&ref=${encodeURIComponent(o.offer_id)}">💬 Écrire au vendeur</a></div>`;
    else body=o.offer_status==='accepted'?`<div class="muted">Statut de la livraison : ${o.request_status==='delivered'?'livrée ✔':esc(o.request_status)}</div>`:'';
    return `<article class="offer">${head}${route}${body}</article>`}).join('')||'<p class="muted">'+(filter==='todo'?'Aucune demande en attente.':filter==='active'?'Aucune livraison en cours.':'Aucun historique.')+'</p>';
}

function bind(){
  $('#avail').addEventListener('change',async e=>{const v=e.target.checked;try{const {error}=await sb.rpc('rg_delivery_set_availability',{p_org:org.id,p_available:v});if(error)throw error;provider.is_available=v;renderProvider();say(v?'Vous êtes disponible : les demandes de vos zones arrivent ici.':'Vous êtes indisponible : plus de nouvelles demandes.')}catch(x){e.target.checked=!v;say(x.message,true)}});
  $('#zoneNew').addEventListener('click',()=>{fillZone(null);$('#zoneForm').scrollIntoView({behavior:'smooth'})});
  $('#zoneCancel').addEventListener('click',()=>fillZone(null));
  $('#zoneGpsBtn').addEventListener('click',()=>{if(!navigator.geolocation)return say('Localisation indisponible.',true);navigator.geolocation.getCurrentPosition(p=>{gps={lat:p.coords.latitude,lng:p.coords.longitude};$('#zoneGps').textContent='✔ Centre GPS défini (ma position)'},()=>say('Position refusée.',true),{enableHighAccuracy:true,timeout:15000})});
  $('#zoneNoGps').addEventListener('click',()=>{gps=null;$('#zoneGps').textContent='Sans GPS : la zone couvre la ville indiquée'});
  $('#zoneForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements,b=e.submitter;b.disabled=true;
    try{const {error}=await sb.rpc('rg_delivery_save_zone',{p_org:org.id,p_zone:editing,p_label:f.label.value.trim(),p_city:f.city.value.trim()||null,p_country:'CI',p_lat:gps?gps.lat:null,p_lng:gps?gps.lng:null,p_radius:num(f.radius.value)||15,p_base_fee:num(f.base.value)||0,p_per_km:num(f.perkm.value)||0,p_active:f.active.checked});
      if(error)throw error;fillZone(null);await loadZones();say('Zone enregistrée.')}catch(x){say(x.message,true)}finally{b.disabled=false}});
  $('#zoneList').addEventListener('click',async e=>{const ed=e.target.closest('[data-zedit]'),dl=e.target.closest('[data-zdel]');
    if(ed){fillZone(zones.find(z=>z.id===ed.dataset.zedit));$('#zoneForm').scrollIntoView({behavior:'smooth'})}
    if(dl&&confirm('Supprimer cette zone ?')){try{const {error}=await sb.rpc('rg_delivery_delete_zone',{p_zone:dl.dataset.zdel});if(error)throw error;await loadZones()}catch(x){say(x.message,true)}}});
  $('#inboxTabs').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){filter=b.dataset.f;renderInbox()}});
  $('#inbox').addEventListener('click',async e=>{const acc=e.target.closest('[data-acc]'),ref=e.target.closest('[data-ref]'),st=e.target.closest('[data-st]');
    try{
      if(acc){acc.disabled=true;const fee=num(($('#inbox').querySelector('[data-fee="'+acc.dataset.acc+'"]')||{}).value);const {data,error}=await sb.rpc('rg_delivery_respond',{p_offer:acc.dataset.acc,p_accept:true,p_fee:fee});if(error){acc.disabled=false;throw error}
        say('Livraison acceptée. Les adresses exactes sont visibles dans « En cours » et une conversation avec le vendeur est ouverte.');filter='active';await loadInbox()}
      else if(ref){const r=prompt('Motif du refus (facultatif) :');if(r===null)return;const {error}=await sb.rpc('rg_delivery_respond',{p_offer:ref.dataset.ref,p_accept:false,p_reason:r||null});if(error)throw error;say('Offre refusée.');await loadInbox()}
      else if(st){st.disabled=true;const {error}=await sb.rpc('rg_delivery_set_status',{p_request:st.dataset.req,p_status:st.dataset.st});if(error){st.disabled=false;throw error}say(st.dataset.st==='delivered'?'Livraison terminée.':'Colis marqué comme récupéré.');await loadInbox()}
    }catch(x){say(x.message||'Action impossible.',true);loadInbox().catch(()=>{})}});
}
init().catch(e=>{const el=$('#status');if(el)el.textContent='Erreur : '+(e.message||'vérifiez la connexion et que la migration 17 est installée.')});
})();
