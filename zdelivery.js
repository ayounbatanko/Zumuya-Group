/* ZUMUYA GROUP — Expédition par société de livraison (vendeurs Marketplace, producteurs et fournisseurs Agro).
   - ZDelivery.open({sourceType,sourceId,title,pickup,dest,saveSellerLocation,onDone})
       Ouvre la fenêtre : position du vendeur + destination -> sociétés disponibles qui desservent les deux
       (triées de la plus proche à la plus éloignée du vendeur) -> envoi de l'offre aux sociétés choisies.
   - ZDelivery.status(element,sourceType,sourceId)
       Affiche l'état de la demande, les réponses des sociétés (acceptée / refusée / en attente) et la messagerie.
   Toute la logique (zones, disponibilité, tri, droits) est vérifiée côté serveur (migration 17). */
(()=>{'use strict';
const cfg=()=>window.ZUMAYA_CONFIG||{};let _sb=null;
function sb(){if(_sb)return _sb;if(!window.supabase||!cfg().SUPABASE_URL)throw Error('Configuration Supabase indisponible.');_sb=window.supabase.createClient(cfg().SUPABASE_URL,cfg().SUPABASE_ANON_KEY);return _sb}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FCFA';
const km=n=>n==null?'—':Number(n).toLocaleString('fr-FR',{maximumFractionDigits:1})+' km';
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
const geo=()=>new Promise((ok,ko)=>{if(!navigator.geolocation)return ko(Error('La localisation n’est pas disponible sur cet appareil.'));navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude}),()=>ko(Error('Position refusée ou indisponible : autorisez la localisation ou saisissez la ville.')),{enableHighAccuracy:true,timeout:15000,maximumAge:60000})});
async function geocode(address,city){const q=[address,city].filter(Boolean).join(', ');if(!q)throw Error('Saisissez une adresse ou une ville.');
  const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('Localisation de l’adresse indisponible.');const j=await r.json();if(!j.length)throw Error('Adresse introuvable : essayez avec la ville seule.');return{lat:+j[0].lat,lng:+j[0].lon}}
function css(){if(document.getElementById('zd-css'))return;const s=document.createElement('style');s.id='zd-css';s.textContent=`
.zd-back{position:fixed;inset:0;background:#0b1b2b99;z-index:9998;display:flex;align-items:flex-end;justify-content:center;padding:0}
.zd-box{background:#fff;color:#17212b;width:min(720px,100%);max-height:94vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px;font:15px/1.45 system-ui,sans-serif}
@media(min-width:760px){.zd-back{align-items:center;padding:20px}.zd-box{border-radius:18px}}
.zd-box h2{margin:0 0 4px;font-size:19px}.zd-box h3{margin:16px 0 6px;font-size:14px;color:#102b45}.zd-m{color:#5b6b7a;font-size:13px}
.zd-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:520px){.zd-g{grid-template-columns:1fr}}
.zd-box input,.zd-box textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5df;border-radius:10px;padding:10px;font:inherit}
.zd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
.zd-b{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#102b45;color:#fff;font-size:14px;text-decoration:none;display:inline-block}
.zd-b.alt{background:#eaf0f5;color:#102b45}.zd-b.d{background:#fde8e8;color:#a32121}.zd-b:disabled{opacity:.55;cursor:wait}
.zd-org{display:flex;gap:10px;align-items:flex-start;border:1px solid #dbe3ea;border-radius:12px;padding:10px;margin-top:8px;cursor:pointer}
.zd-org input{width:auto;margin-top:4px}.zd-org.first{border-color:#c59a42;background:#fffaf0}.zd-org b{display:block}
.zd-tag{display:inline-block;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:700;background:#eef2f5;color:#102b45;margin-right:4px}
.zd-tag.ok{background:#dff5e8;color:#0b6b3a}.zd-tag.no{background:#fde8e8;color:#a32121}.zd-tag.wait{background:#fff1d6;color:#8a5a00}
.zd-msg{margin-top:10px;padding:9px 11px;border-radius:10px;background:#eef6ff;color:#0e4a7a;font-size:13px}.zd-msg.err{background:#fde8e8;color:#a32121}
.zd-st{border:1px solid #dbe3ea;border-radius:12px;padding:11px;margin-top:8px;background:#fff}.zd-st .zd-offer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid #eef2f5;padding:7px 0;font-size:13.5px}
`;document.head.appendChild(s)}
const REQ={open:['En attente de réponse','wait'],assigned:['Prise en charge','ok'],picked_up:['Colis récupéré','ok'],delivered:['Livré ✔','ok'],cancelled:['Annulée','no']};
const OFR={pending:['En attente','wait'],accepted:['Acceptée ✅','ok'],declined:['Refusée','no'],closed:['Clôturée',''],cancelled:['Annulée','no'],expired:['Expirée','no']};

async function open(o){css();o=o||{};const client=sb();
  const back=document.createElement('div');back.className='zd-back';
  const P={lat:num(o.pickup&&o.pickup.lat),lng:num(o.pickup&&o.pickup.lng)},D={lat:num(o.dest&&o.dest.lat),lng:num(o.dest&&o.dest.lng)};
  if(P.lat==null||P.lng==null){P.lat=P.lng=null}if(D.lat==null||D.lng==null){D.lat=D.lng=null}
  let found=[];
  back.innerHTML=`<div class="zd-box" role="dialog" aria-modal="true" aria-label="Faire livrer cette commande"><h2>🚚 ${esc(o.title||'Faire livrer cette commande')}</h2>
  <p class="zd-m">Les sociétés proposées sont disponibles, desservent votre zone et la destination, et sont triées de la plus proche à la plus éloignée de votre position. Chacune peut accepter ou refuser.</p>
  <h3>📦 Enlèvement — votre position</h3><div class="zd-g"><input id="zdPc" placeholder="Ville *" value="${esc(o.pickup&&o.pickup.city||'')}" autocomplete="address-level2"><input id="zdPa" placeholder="Adresse / quartier" value="${esc(o.pickup&&o.pickup.address||'')}"></div>
  <div class="zd-row"><button type="button" class="zd-b alt" id="zdPg">📍 Utiliser ma position</button><span class="zd-m" id="zdPs"></span></div>
  ${o.saveSellerLocation?'<label class="zd-m" style="display:block;margin-top:6px"><input type="checkbox" id="zdSave" style="width:auto" checked> Enregistrer cette position pour mes prochaines expéditions (privée)</label>':''}
  <h3>🏠 Destination — chez l’acheteur</h3><div class="zd-g"><input id="zdDc" placeholder="Ville *" value="${esc(o.dest&&o.dest.city||'')}" autocomplete="address-level2"><input id="zdDa" placeholder="Adresse / quartier" value="${esc(o.dest&&o.dest.address||'')}"></div>
  <div class="zd-row"><button type="button" class="zd-b alt" id="zdDg">📍 Localiser l’adresse</button><span class="zd-m" id="zdDs"></span></div>
  <div class="zd-row"><button type="button" class="zd-b" id="zdFind">🔎 Voir les sociétés de livraison</button></div>
  <div id="zdList"></div>
  <div id="zdSend" hidden><h3>📝 Message pour les sociétés (facultatif)</h3><textarea id="zdNote" rows="2" maxlength="500" placeholder="Ex. colis fragile, horaire souhaité, taille du colis…"></textarea>
  <div class="zd-row"><button type="button" class="zd-b" id="zdGo">Envoyer la demande</button></div></div>
  <div id="zdMsg"></div><div class="zd-row" style="justify-content:flex-end"><button type="button" class="zd-b alt" id="zdClose">Fermer</button></div></div>`;
  document.body.appendChild(back);document.body.style.overflow='hidden';
  const $=s=>back.querySelector(s),say=(t,err)=>{$('#zdMsg').innerHTML=t?`<div class="zd-msg${err?' err':''}">${esc(t)}</div>`:''};
  const close=()=>{back.remove();document.body.style.overflow=''};
  back.addEventListener('click',e=>{if(e.target===back)close()});$('#zdClose').onclick=close;
  const coordTxt=(c,place)=>c.lat==null?'Ville utilisée (sans coordonnées GPS)':'✔ Position GPS enregistrée';
  const refresh=()=>{$('#zdPs').textContent=coordTxt(P);$('#zdDs').textContent=coordTxt(D)};refresh();
  $('#zdDc').oninput=$('#zdDa').oninput=()=>{D.lat=D.lng=null;refresh()};
  $('#zdPc').oninput=$('#zdPa').oninput=()=>{if(P.lat!=null&&!P._gps){P.lat=P.lng=null}refresh()};
  $('#zdPg').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const g=await geo();P.lat=g.lat;P.lng=g.lng;P._gps=true;refresh();say('Position enregistrée pour cette demande.')}catch(x){say(x.message,true)}finally{b.disabled=false}};
  $('#zdDg').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const g=await geocode($('#zdDa').value.trim(),$('#zdDc').value.trim());D.lat=g.lat;D.lng=g.lng;refresh();say('Adresse localisée.')}catch(x){say(x.message,true)}finally{b.disabled=false}};
  if(P.lat==null&&o.saveSellerLocation){try{const {data:{user}}=await client.auth.getUser();const {data}=user?await client.from('rg_seller_locations').select('city,address,lat,lng').eq('user_id',user.id).maybeSingle():{data:null};
    if(data){if(!$('#zdPc').value)$('#zdPc').value=data.city||'';if(!$('#zdPa').value)$('#zdPa').value=data.address||'';if(data.lat!=null){P.lat=data.lat;P.lng=data.lng}refresh()}}catch(_){}}
  $('#zdFind').onclick=async e=>{const b=e.currentTarget,pc=$('#zdPc').value.trim(),dc=$('#zdDc').value.trim();
    if(P.lat==null&&!pc)return say('Indiquez votre ville ou utilisez votre position.',true);if(D.lat==null&&!dc)return say('Indiquez la ville de destination.',true);
    b.disabled=true;say('Recherche des sociétés qui desservent cette zone…');$('#zdSend').hidden=true;
    try{const {data,error}=await client.rpc('rg_delivery_suggest',{p_pickup_lat:P.lat,p_pickup_lng:P.lng,p_pickup_city:pc||null,p_dest_lat:D.lat,p_dest_lng:D.lng,p_dest_city:dc||null});if(error)throw error;
      found=data||[];
      if(!found.length){$('#zdList').innerHTML='<div class="zd-msg err">Aucune société de livraison disponible ne dessert à la fois votre zone et cette destination pour le moment. Vous pouvez livrer vous-même ou réessayer plus tard.</div>';say('');return}
      $('#zdList').innerHTML='<h3>🚚 '+found.length+' société'+(found.length>1?'s':'')+' disponible'+(found.length>1?'s':'')+' (de la plus proche à la plus éloignée)</h3>'+found.map((s,i)=>`<label class="zd-org${i===0?' first':''}"><input type="checkbox" data-org="${esc(s.org_id)}" ${i<3?'checked':''}><span><b>${esc(s.org_name)}${i===0?' · la plus proche':''}</b><span class="zd-m">${esc(s.org_city||'')} · à ${km(s.distance_km)} de vous${s.trip_km!=null?' · trajet ≈ '+km(s.trip_km):''}<br>Zone : ${esc(s.zone_label||'')} · Estimation : <b>${money(s.estimated_fee)}</b></span></span></label>`).join('');
      $('#zdSend').hidden=false;say('Cochez les sociétés à solliciter : la première qui accepte prend la livraison.')}
    catch(x){say(x.message||'Recherche impossible.',true)}finally{b.disabled=false}};
  $('#zdGo').onclick=async e=>{const b=e.currentTarget,ids=[...back.querySelectorAll('[data-org]:checked')].map(x=>x.dataset.org);if(!ids.length)return say('Choisissez au moins une société.',true);if(ids.length>10)return say('Maximum 10 sociétés.',true);
    b.disabled=true;say('Envoi de la demande…');
    try{if(o.saveSellerLocation&&$('#zdSave')&&$('#zdSave').checked){const {data:{user}}=await client.auth.getUser();if(user)await client.from('rg_seller_locations').upsert({user_id:user.id,city:$('#zdPc').value.trim()||null,address:$('#zdPa').value.trim()||null,lat:P.lat,lng:P.lng,updated_at:new Date().toISOString()})}
      const {error}=await client.rpc('rg_delivery_request_create',{p_source_type:o.sourceType,p_source_id:o.sourceId,p_pickup_address:$('#zdPa').value.trim()||null,p_pickup_city:$('#zdPc').value.trim()||null,p_pickup_lat:P.lat,p_pickup_lng:P.lng,p_dest_address:$('#zdDa').value.trim()||null,p_dest_city:$('#zdDc').value.trim()||null,p_dest_lat:D.lat,p_dest_lng:D.lng,p_org_ids:ids,p_note:$('#zdNote').value.trim()||null});
      if(error)throw error;close();if(typeof o.onDone==='function')o.onDone()}
    catch(x){say(x.message||'Envoi impossible.',true);b.disabled=false}};
}

/* Suivi : demande, réponses des sociétés, messagerie */
async function status(el,type,id,opt){if(!el)return;css();opt=opt||{};let live=null,timer=null;
  const draw=async()=>{if(!document.body.contains(el)){if(timer)clearInterval(timer);if(live)try{sb().removeChannel(live)}catch(_){}return}
    try{const {data,error}=await sb().rpc('rg_delivery_my_requests',{p_source_type:type,p_source_id:id});if(error)throw error;
      if(!data||!data.length){el.innerHTML='';return}
      const last=data[0].request_id,rows=data.filter(r=>r.request_id===last),h=rows[0],rs=REQ[h.request_status]||[h.request_status,''];
      el.innerHTML=`<div class="zd-st"><div><b>🚚 Livraison ${esc(h.ref)}</b> <span class="zd-tag ${rs[1]}">${esc(rs[0])}</span>${h.trip_km!=null?`<span class="zd-m"> · trajet ≈ ${km(h.trip_km)}</span>`:''}</div>
      ${rows.filter(r=>r.offer_id).map(r=>{const os=OFR[r.offer_status]||[r.offer_status,''];return `<div class="zd-offer"><span><b>${esc(r.org_name||'Société')}</b> <span class="zd-m">${esc(r.org_city||'')} · ${km(r.distance_km)}</span><br><span class="zd-tag ${os[1]}">${esc(os[0])}</span>${r.offer_status==='accepted'?` Tarif : <b>${money(r.proposed_fee??r.estimated_fee)}</b>`:` Estimation : ${money(r.estimated_fee)}`}${r.offer_status==='declined'&&r.decline_reason?`<br><span class="zd-m">Motif : ${esc(r.decline_reason)}</span>`:''}</span>${['pending','accepted'].includes(r.offer_status)?`<a class="zd-b alt" href="messagerie.html?kind=delivery_offer&ref=${encodeURIComponent(r.offer_id)}">💬 Écrire</a>`:''}</div>`}).join('')}
      ${h.request_status==='open'?`<div class="zd-row"><button type="button" class="zd-b d" data-zd-cancel="${esc(h.request_id)}">Annuler la demande</button></div>`:''}</div>`;
      el.querySelectorAll('[data-zd-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('Annuler cette demande de livraison ?'))return;b.disabled=true;try{const {error}=await sb().rpc('rg_delivery_request_cancel',{p_request:b.dataset.zdCancel});if(error)throw error;await draw();if(typeof opt.onChange==='function')opt.onChange()}catch(x){alert(x.message);b.disabled=false}});
    }catch(x){el.innerHTML=''}};
  await draw();timer=setInterval(draw,25000);
  try{live=sb().channel('zd-'+id).on('postgres_changes',{event:'*',schema:'public',table:'rg_delivery_offers'},()=>{draw();if(typeof opt.onChange==='function')opt.onChange()}).subscribe()}catch(_){}
}
window.ZDelivery={open,status};
})();
