/* ZUMUYA GROUP — Approvisionnement entre professionnels (restaurants, hôtels, commerçants ⇄ producteurs, commerçants).
   Distinct des commandes alimentaires des clients (rg_orders). Prix, stocks et droits sont vérifiés par Supabase
   (fonctions rg_supply_* du script 11_equipes_livreurs_approvisionnement.sql).
   Usage : ZSupply.mount(element,{role:'buyer'|'supplier'|'both',orgId,address}) */
(()=>{'use strict';
const C=()=>window.ZUMAYA_CONFIG||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sess(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null'),s=v&&(v.currentSession||v);if(s&&s.access_token&&s.user)return s}}}catch(e){}return null}
const H=()=>{const s=sess();return{apikey:C().SUPABASE_ANON_KEY,Authorization:'Bearer '+(s?s.access_token:C().SUPABASE_ANON_KEY),'Content-Type':'application/json'}};
async function rest(path){const r=await fetch(C().SUPABASE_URL+'/rest/v1/'+path,{headers:H()});if(!r.ok)throw new Error('Lecture impossible ('+r.status+')');return r.json()}
async function rpc(name,args){const r=await fetch(C().SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:H(),body:JSON.stringify(args||{})});
  if(!r.ok){let m='Erreur '+r.status;try{const j=await r.json();m=j.message||m}catch(e){}throw new Error(m)}
  const t=await r.text();return t?JSON.parse(t):null}
const money=(v,c)=>{v=+v||0;if(!c||c==='XOF'||c==='XAF')return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(v)+' FCFA';try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(v)}catch(e){return v+' '+c}};
const ST={pending:['En attente de confirmation','#b26a00'],confirmed:['Confirmée','#0a6aa1'],refused:['Refusée','#b3261e'],delivering:['En livraison','#6a3fb5'],received:['Reçue','#0b7d3f'],cancelled:['Annulée','#6b7785']};

function css(){if(document.getElementById('zs-css'))return;const s=document.createElement('style');s.id='zs-css';
 s.textContent=`.zs{display:grid;gap:12px}.zs *{box-sizing:border-box}.zs .c{background:#fff;border:1px solid #dfe5ec;border-radius:14px;padding:14px}
 .zs h3{margin:0 0 4px;font-size:1.05rem}.zs .m{color:#5b6b7a;font-size:.88rem}.zs input,.zs select,.zs textarea{width:100%;padding:10px 12px;border:1px solid #c9d2dc;border-radius:10px;font:inherit;background:#fff}
 .zs button{border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;background:#102b45;color:#fff}.zs button.s{background:#e8edf3;color:#102b45}.zs button.d{background:#b3261e}.zs button.g{background:#0b7d3f}.zs button:disabled{opacity:.5}
 .zs .tabs{display:flex;gap:6px;overflow-x:auto}.zs .tabs button{background:#e8edf3;color:#102b45;white-space:nowrap}.zs .tabs button.on{background:#102b45;color:#fff}
 .zs .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}.zs .p{display:grid;gap:6px;border:1px solid #e3e8ee;border-radius:12px;padding:12px}
 .zs .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.zs .tag{display:inline-block;padding:2px 9px;border-radius:99px;font-size:.75rem;font-weight:800;color:#fff}
 .zs .err{background:#fdecea;border:1px solid #f1aea8;border-radius:12px;padding:10px;color:#8a1c14}.zs .ok{background:#e8f6ee;border:1px solid #9fd3b5;border-radius:12px;padding:10px}
 .zs table{width:100%;border-collapse:collapse;font-size:.86rem}.zs td,.zs th{padding:6px;border-bottom:1px solid #eef1f5;text-align:left}.zs .q{width:90px}`;
 document.head.appendChild(s)}

function mount(el,opt){css();opt=opt||{};el.classList.add('zs');
 const role=opt.role||'both';let view=role==='supplier'?'received':'catalog';
 let products=[],orders=[],cart={},q='',cat='',msg='',busy=false;
 const me=()=>{const s=sess();return s?s.user.id:null};
 async function loadProducts(){
  products=await rest('rg_agro_products?select=id,owner_id,product_name,description,category,unit,price,quantity,availability,minimum_order,currency_code,origin_city,photo_url,rg_agro_profiles(business_name,city,phone,is_active)&availability=neq.unavailable&quantity=gt.0&order=product_name.asc&limit=300');
  products=products.filter(p=>p.owner_id!==me()&&p.rg_agro_profiles&&p.rg_agro_profiles.is_active!==false)}
 async function loadOrders(){
  orders=await rest('rg_supply_orders?select=*,rg_supply_order_items(*),supplier:rg_agro_profiles!rg_supply_orders_supplier_id_fkey(business_name,city,phone)&order=created_at.desc&limit=80')}
 async function refresh(){try{if(role!=='supplier')await loadProducts();await loadOrders();msg=''}catch(e){msg='⚠ Données indisponibles : '+e.message+' — le script 11_equipes_livreurs_approvisionnement.sql est-il installé ?'}draw()}

 const mineBuy=o=>o.buyer_user_id===me()||(opt.orgId&&o.buyer_org_id===opt.orgId);
 const mineSell=o=>o.supplier_id===me();
 function draw(){
  const rec=orders.filter(mineSell),pass=orders.filter(mineBuy);
  const pend=rec.filter(o=>o.status==='pending').length;
  const nCart=Object.values(cart).reduce((a,b)=>a+Object.keys(b).length,0);
  el.innerHTML=`<div class="c"><h3>🌾 Approvisionnement professionnel</h3><p class="m">${role==='supplier'
     ?'Commandes d’approvisionnement reçues des restaurants, hôtels et commerçants. Elles sont distinctes des commandes des clients.'
     :'Achetez directement auprès des producteurs et commerçants agricoles. Ces achats sont séparés des commandes de vos clients.'}</p>
    <div class="tabs" style="margin-top:8px">${role!=='supplier'?`<button data-v="catalog" class="${view==='catalog'?'on':''}">🛍️ Catalogue</button><button data-v="cart" class="${view==='cart'?'on':''}">🧺 Panier (${nCart})</button><button data-v="mine" class="${view==='mine'?'on':''}">📦 Mes achats</button>`:''}
    ${role!=='buyer'?`<button data-v="received" class="${view==='received'?'on':''}">📥 Commandes reçues${pend?` (${pend})`:''}</button>`:''}</div></div>
   ${msg?`<div class="${msg.startsWith('⚠')?'err':'ok'}">${esc(msg)}</div>`:''}
   ${view==='catalog'?catalog():view==='cart'?cartView():view==='mine'?list(pass,true):list(rec,false)}`;
  bind()}

 function catalog(){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const f=products.filter(p=>(!cat||p.category===cat)&&(!q||(p.product_name+' '+(p.rg_agro_profiles.business_name||'')+' '+(p.origin_city||'')).toLowerCase().includes(q.toLowerCase())));
  return `<div class="c"><div class="row"><input id="zsQ" placeholder="Rechercher un produit ou un fournisseur" value="${esc(q)}" style="flex:2;min-width:180px"><select id="zsCat" style="flex:1;min-width:140px"><option value="">Toutes catégories</option>${cats.map(c=>`<option ${c===cat?'selected':''}>${esc(c)}</option>`).join('')}</select></div></div>
   <div class="grid">${f.length?f.map(p=>`<div class="p" data-p="${esc(p.id)}"><b>${esc(p.product_name)}</b>
     <span class="m">${esc(p.rg_agro_profiles.business_name)} · ${esc(p.origin_city||p.rg_agro_profiles.city||'')}</span>
     <span><b>${money(p.price,p.currency_code)}</b> / ${esc(p.unit)} <span class="m">· ${p.availability==='limited'?'stock limité · ':''}dispo ${+p.quantity} ${esc(p.unit)}${+p.minimum_order>1?' · min. '+(+p.minimum_order):''}</span></span>
     <div class="row"><input class="q" type="number" min="${+p.minimum_order||1}" max="${+p.quantity}" step="any" value="${+p.minimum_order||1}"><button data-a="add">Ajouter</button></div></div>`).join(''):'<p class="m">Aucun produit disponible pour ce filtre.</p>'}</div>`}

 function cartView(){
  const sups=Object.keys(cart).filter(s=>Object.keys(cart[s]).length);
  if(!sups.length)return '<div class="c"><p class="m">Votre panier est vide. Ajoutez des produits depuis le catalogue (une commande par fournisseur).</p></div>';
  return sups.map(s=>{const lines=Object.entries(cart[s]).map(([pid,qty])=>({p:products.find(x=>x.id===pid),qty})).filter(l=>l.p);
   const tot=lines.reduce((a,l)=>a+l.p.price*l.qty,0),sp=lines[0]&&lines[0].p.rg_agro_profiles;
   return `<div class="c" data-s="${esc(s)}"><h3>${esc(sp?sp.business_name:'Fournisseur')}</h3><div style="overflow:auto"><table><tbody>${lines.map(l=>`<tr><td>${esc(l.p.product_name)}</td><td>${+l.qty} ${esc(l.p.unit)}</td><td>${money(l.p.price*l.qty,l.p.currency_code)}</td><td><button class="s" data-a="rm" data-pid="${esc(l.p.id)}">✕</button></td></tr>`).join('')}</tbody></table></div>
    <p><b>Total estimé : ${money(tot,lines[0]&&lines[0].p.currency_code)}</b> <span class="m">— le prix définitif est recalculé par le serveur.</span></p>
    <label class="m">Adresse de livraison<input class="zsAddr" value="${esc(opt.address||'')}" maxlength="300"></label>
    <label class="m">Note pour le fournisseur<input class="zsNote" maxlength="500" placeholder="Ex. livraison avant 9 h"></label>
    <div class="row" style="margin-top:8px"><button data-a="order" ${busy?'disabled':''}>Envoyer la commande</button></div></div>`}).join('')}

 function list(rows,asBuyer){
  if(!rows.length)return `<div class="c"><p class="m">${asBuyer?'Vous n’avez encore passé aucune commande d’approvisionnement.':'Aucune commande reçue pour le moment.'}</p></div>`;
  return rows.map(o=>{const st=ST[o.status]||[o.status,'#555'],who=asBuyer?(o.supplier&&o.supplier.business_name)||'Fournisseur':(o.buyer_name||'Client professionnel');
   const acts=[];
   if(asBuyer){if(o.status==='pending')acts.push(['cancel','Annuler','d']);if(o.status==='delivering')acts.push(['receive','✅ Confirmer la réception','g'])}
   else{if(o.status==='pending'){acts.push(['accept','Accepter','g']);acts.push(['refuse','Refuser','d'])}if(o.status==='confirmed'){acts.push(['ship','🚚 Marquer en livraison',''] );acts.push(['cancel','Annuler','d'])}}
   return `<div class="c" data-o="${esc(o.id)}"><div class="row" style="justify-content:space-between"><div><b>${esc(o.ref)}</b> <span class="tag" style="background:${st[1]}">${st[0]}</span><div class="m">${asBuyer?'Fournisseur':'Acheteur'} : ${esc(who)}${!asBuyer&&o.buyer_phone?' · '+esc(o.buyer_phone):''}${asBuyer&&o.supplier&&o.supplier.phone?' · '+esc(o.supplier.phone):''} · ${new Date(o.created_at).toLocaleString('fr-FR')}</div></div><b>${money(o.total,o.currency_code)}</b></div>
    <div style="overflow:auto"><table><tbody>${(o.rg_supply_order_items||[]).map(i=>`<tr><td>${esc(i.product_name)}</td><td>${+i.quantity} ${esc(i.unit)}</td><td>${money(i.line_total,o.currency_code)}</td></tr>`).join('')}</tbody></table></div>
    ${o.delivery_address?`<div class="m">📍 ${esc(o.delivery_address)}</div>`:''}${o.delivery_note?`<div class="m">📝 ${esc(o.delivery_note)}</div>`:''}${o.refusal_reason?`<div class="m">Motif : ${esc(o.refusal_reason)}</div>`:''}
    ${o.status==='received'?`<div class="m">Paiement : ${o.payment_status==='paid'?'réglé':'à régler directement au fournisseur'}</div>`:''}
    ${acts.length?`<div class="row" style="margin-top:6px">${acts.map(a=>`<button class="${a[2]}" data-a="${a[0]}">${a[1]}</button>`).join('')}</div>`:''}</div>`}).join('')}

 function bind(){
  el.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;msg='';draw()});
  const sq=el.querySelector('#zsQ');if(sq)sq.oninput=()=>{q=sq.value;const pos=sq.selectionStart;draw();const n=el.querySelector('#zsQ');n.focus();n.setSelectionRange(pos,pos)};
  const sc=el.querySelector('#zsCat');if(sc)sc.onchange=()=>{cat=sc.value;draw()};
  el.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=b.dataset.a;
   try{
    if(a==='add'){const box=b.closest('[data-p]'),p=products.find(x=>x.id===box.dataset.p),qty=parseFloat(box.querySelector('.q').value);
      if(!p||!(qty>0))return;if(qty<(+p.minimum_order||0)){msg='⚠ Commande minimale : '+(+p.minimum_order)+' '+p.unit;return draw()}
      if(qty>+p.quantity){msg='⚠ Stock disponible : '+(+p.quantity)+' '+p.unit;return draw()}
      (cart[p.owner_id]=cart[p.owner_id]||{})[p.id]=qty;msg='« '+p.product_name+' » ajouté au panier.';return draw()}
    if(a==='rm'){const s=b.closest('[data-s]').dataset.s;delete cart[s][b.dataset.pid];return draw()}
    if(a==='order'){const box=b.closest('[data-s]'),s=box.dataset.s;busy=true;b.disabled=true;
      const items=Object.entries(cart[s]).map(([product_id,quantity])=>({product_id,quantity}));
      await rpc('rg_supply_place_order',{p_items:items,p_org:opt.orgId||null,p_address:box.querySelector('.zsAddr').value||null,p_note:box.querySelector('.zsNote').value||null});
      delete cart[s];busy=false;view='mine';msg='Commande envoyée. Le fournisseur va la confirmer ou la refuser.';await refresh();return}
    const id=b.closest('[data-o]')&&b.closest('[data-o]').dataset.o;if(!id)return;
    if(a==='accept')await rpc('rg_supply_respond',{p_order:id,p_accept:true});
    else if(a==='refuse'){const r=prompt('Motif du refus (facultatif) :');if(r===null)return;await rpc('rg_supply_respond',{p_order:id,p_accept:false,p_reason:r})}
    else if(a==='ship')await rpc('rg_supply_advance',{p_order:id});
    else if(a==='receive'){const paid=confirm('Avez-vous déjà réglé le fournisseur ?\nOK = oui, réglé · Annuler = pas encore');await rpc('rg_supply_advance',{p_order:id,p_paid:paid})}
    else if(a==='cancel'){if(!confirm('Annuler cette commande ?'))return;await rpc('rg_supply_cancel',{p_order:id})}
    msg='';await refresh();
   }catch(err){busy=false;msg='⚠ Erreur : '+err.message;draw()}};}
 el.innerHTML='<div class="c"><p class="m">Chargement…</p></div>';refresh()}

window.ZSupply={mount};
})();
