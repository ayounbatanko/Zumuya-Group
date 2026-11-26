(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n||0))+' FCFA';
const statusLabel={pending:'En attente d’acceptation',accepted:'Acceptée',preparing:'En préparation',ready:'Prête',in_transit:'En cours de livraison',delivered:'Livrée',rejected:'Refusée',cancelled:'Annulée'};
let sb=null,user=null,offers=[],cart=[];
const KEY='zumaya_universal_cart_v1';
try{cart=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){cart=[]}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(_){}renderCart()}
function note(t){const n=$('walletNotice');if(n)n.textContent=t}
function add(id){const o=offers.find(x=>x.id===id);if(!o)return;const row=cart.find(x=>x.offer_id===id);if(row)row.quantity=Math.min(10000,row.quantity+1);else cart.push({offer_id:id,title:o.title,price_minor:o.price_minor,currency_code:o.currency_code,quantity:1,seller_id:o.seller_id});save();const c=$('basketCount');if(c){c.hidden=!cart.length;c.textContent=cart.reduce((n,x)=>n+x.quantity,0)}}
function mediaMarkup(o){
 const raw=[...(Array.isArray(o.media_urls)?o.media_urls:[]),...(Array.isArray(o.video_urls)?o.video_urls:[])];
 if(o.image_url)raw.unshift(o.image_url);
 const urls=[...new Set(raw.filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))].slice(0,8);
 if(!urls.length)return '';
 return '<div class="z-offer-media">'+urls.map(u=>/\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(u)?'<video controls playsinline preload="metadata" src="'+esc(u)+'"></video>':'<img loading="lazy" src="'+esc(u)+'" alt="Visuel du produit" onerror="this.hidden=true">').join('')+'</div>';
}
function renderOffers(){
 const root=$('zPublicOffers');if(!root)return;const q=($('zOfferSearch')?.value||'').trim().toLowerCase();
 const list=offers.filter(o=>!q||[o.title,o.description,o.category,o.module_code].join(' ').toLowerCase().includes(q));
 root.innerHTML=list.length?list.map(o=>`<article class="z-offer">${mediaMarkup(o)}<span class="module">${esc(o.module_code)} · ${esc(o.category)}</span><h3>${esc(o.title)}</h3><p>${esc(o.description||'Offre publique')}</p><span class="price">${money(o.price_minor)} ${esc(o.currency_code||'XOF')}</span><div class="z-offer-actions"><button class="dbtn gold" type="button" data-zadd="${esc(o.id)}">＋ Ajouter au panier</button>${o.seller_id&&o.seller_id!==user?.id?`<a class="dbtn line" href="messagerie.html?to=${encodeURIComponent(o.seller_id)}&subject=${encodeURIComponent('Question sur : '+o.title)}">💬 Contacter le fournisseur</a>`:''}</div></article>`).join(''):'<p class="dempty">Aucune offre publique disponible dans cette recherche.</p>';
}
function renderCart(){
 const root=$('zCartItems');if(!root)return;
 root.innerHTML=cart.length?cart.map((x,i)=>`<div class="z-cart-line"><div><b>${esc(x.title)}</b><div class="muted">${money(x.price_minor)} × ${x.quantity}</div></div><div><b>${money(x.price_minor*x.quantity)}</b> <button type="button" data-zremove="${i}">Retirer</button></div></div>`).join(''):'<p class="dempty">Votre panier est vide. Ajoutez des offres depuis les catalogues publics.</p>';
 const c=$('basketCount');if(c){const n=cart.reduce((a,x)=>a+x.quantity,0);c.hidden=!n;c.textContent=n}
}
async function loadOffers(){
 const {data,error}=await sb.from('rg_public_offers').select('id,seller_id,module_code,category,title,description,price_minor,currency_code,stock_quantity,media_urls,source_table,source_id').eq('is_public',true).order('created_at',{ascending:false}).limit(200);
 if(error){const root=$('zPublicOffers');if(root)root.innerHTML='<p class="dempty">Catalogue momentanément indisponible.</p>';return}
 offers=data||[];
 const ids=offers.filter(o=>o.source_table==='commerce_products'&&o.source_id).map(o=>o.source_id);
 if(ids.length){const {data:media}=await sb.from('commerce_products').select('id,image_url,media_urls,video_urls').in('id',ids);const byId=new Map((media||[]).map(x=>[x.id,x]));offers=offers.map(o=>{const m=o.source_id?byId.get(o.source_id):null;return m?{...o,image_url:m.image_url,media_urls:m.media_urls||o.media_urls,video_urls:m.video_urls||[]}:o})}
 renderOffers();
}
async function loadOrders(){
 const root=$('zMyOrders');if(!root)return;
 const {data,error}=await sb.from('rg_universal_orders').select('id,order_number,module_code,status,payment_method,payment_status,subtotal_minor,delivery_fee_minor,currency_code,created_at,rg_universal_order_items(title_snapshot,quantity,line_total_minor),rg_universal_order_events(new_status,created_at,note)').eq('buyer_id',user.id).order('created_at',{ascending:false}).limit(40);
 if(error){root.innerHTML='<p class="dempty">Impossible de charger vos commandes.</p>';return}
 root.innerHTML=(data||[]).length?data.map(o=>`<article class="z-order"><strong>${esc(o.order_number)}</strong> <span class="status">${esc(statusLabel[o.status]||o.status)}</span><p>${(o.rg_universal_order_items||[]).map(i=>esc(i.title_snapshot)+' × '+i.quantity).join(', ')}</p><b>${money(o.subtotal_minor+o.delivery_fee_minor)}</b><p class="timeline">Paiement : ${o.payment_status==='paid'?'Payé':'À régler'} · ${o.payment_method==='wallet'?'Portefeuille':'Espèces à la livraison'}</p><p class="timeline">${(o.rg_universal_order_events||[]).map(e=>esc(statusLabel[e.new_status]||e.new_status)+' · '+new Date(e.created_at).toLocaleString('fr-FR')).join('<br>')}</p>${o.payment_method==='wallet'&&o.payment_status!=='paid'&&['accepted','preparing','ready','in_transit'].includes(o.status)?`<button type="button" class="dbtn gold" data-zpay="${o.id}">Confirmer le paiement en ligne</button>`:''}</article>`).join(''):'<p class="dempty">Aucune commande pour le moment.</p>';
}
async function checkout(){
 if(!cart.length)return alert('Votre panier est vide.');
 const method=$('zPaymentMode')?.value||'cash_on_delivery',address=$('zDeliveryAddress')?.value||null;
 const btn=$('zCheckout');if(btn)btn.disabled=true;
 try{
  for(const x of cart){
   const {error}=await sb.rpc('rg_universal_create_order',{p_offer_id:x.offer_id,p_quantity:x.quantity,p_payment_method:method,p_delivery_address:address,p_delivery_fee_minor:0,p_buyer_note:null});
   if(error)throw error;
  }
  cart=[];save();await loadOrders();alert('Commande(s) enregistrée(s). Vous pourrez suivre leur acceptation et leur livraison dans Mon panier.');
 }catch(e){alert(e.message||'Impossible de créer la commande. Vérifiez le stock et réessayez.')}
 finally{if(btn)btn.disabled=false}
}
async function loadWallet(){
 const [{data:w,error:we},{data:l,error:le},{data:m,error:me}]=await Promise.all([
  sb.from('rg_wallets').select('balance_minor,currency_code').eq('user_id',user.id).maybeSingle(),
  sb.from('rg_wallet_ledger').select('entry_type,amount_minor,direction,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
  sb.from('rg_wallet_deposit_methods').select('id,label,method_type,instructions').eq('is_active',true).order('label')
 ]);
 $('walletBalance').textContent=we?'Indisponible':money(w?.balance_minor||0);
 $('walletLedger').innerHTML=le?'<p class="muted">Historique indisponible.</p>':(l||[]).map(x=>`<div class="entry"><span>${esc(x.description||x.entry_type)}<small class="muted"> · ${new Date(x.created_at).toLocaleString('fr-FR')}</small></span><b>${x.direction==='credit'?'+':'−'}${money(x.amount_minor)}</b></div>`).join('')||'<p class="muted">Aucune opération pour le moment.</p>';
 const sel=$('zDepositMethod');if(sel)sel.innerHTML=me?'<option value="">Moyens indisponibles</option>':(m||[]).map(x=>`<option value="${x.id}">${esc(x.label)} — ${esc(x.instructions||x.method_type)}</option>`).join('')||'<option value="">Aucun moyen configuré</option>';
}
async function loadNotifications(){
 const {data,error}=await sb.from('rg_activity_notifications').select('module_code').eq('user_id',user.id).eq('is_read',false);
 if(error)return;
 const counts={};(data||[]).forEach(x=>counts[x.module_code]=(counts[x.module_code]||0)+1);
 const mapping={
  marketplace:'marketplace.html',restauration:'zrestaurant-client.html',hotel:'hotel.html',agro:'agro.html',
  livraison:'livraison.html',transport:'livraison.html',prestations:'index.html#services',
  evenements:'index.html#services',commerce:'marketplace.html',voyage:'index.html#services',
  paiement:null,entreprise:'ecosysteme.html'
 };
 Object.entries(mapping).forEach(([code,href])=>{
  const a=href?document.querySelector(`.dside a[href="${href}"]`):document.querySelector('.dside a[data-view="wallet"]');
  if(!a)return;let b=a.querySelector('.zcount');if(!b){b=document.createElement('i');b.className='zcount';a.appendChild(b)}const n=counts[code]||0;b.hidden=!n;b.textContent=n;
 });
}
function bind(){
 document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-zadd]');if(a){add(a.dataset.zadd);return}
  const r=e.target.closest('[data-zremove]');if(r){cart.splice(+r.dataset.zremove,1);save();return}
  const p=e.target.closest('[data-zpay]');if(p){p.disabled=true;const {error}=await sb.rpc('rg_universal_pay_order_wallet',{p_order_id:p.dataset.zpay});if(error)alert(error.message);await loadOrders();await loadWallet();return}
 });
 $('zOfferSearch')?.addEventListener('input',renderOffers);
 $('zCheckout')?.addEventListener('click',checkout);
 $('zDepositForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const amount=Math.round(Number($('zDepositAmount').value));
  if(!amount||amount<=0)return note('Montant invalide.');
  const {data,error}=await sb.rpc('rg_wallet_request_deposit',{p_method_id:$('zDepositMethod').value,p_amount_minor:amount,p_transaction_reference:$('zDepositReference').value||null,p_proof_url:$('zDepositProof').value||null});
  if(error)return note(error.message);
  e.currentTarget.reset();note('Demande de recharge envoyée. Le portefeuille sera crédité après vérification par l’administrateur.');
 });
}
let bound=false;
window.ZUniversalAccount={async open(client,u){sb=client;user=u;if(!bound){bind();bound=true}await Promise.all([loadOffers(),loadOrders(),loadWallet(),loadNotifications()]);renderCart();
 const ch=sb.channel('zumaya-account-'+u.id).on('postgres_changes',{event:'*',schema:'public',table:'rg_activity_notifications',filter:'user_id=eq.'+u.id},()=>loadNotifications()).on('postgres_changes',{event:'*',schema:'public',table:'rg_universal_orders',filter:'buyer_id=eq.'+u.id},()=>{loadOrders();loadWallet()}).subscribe();window.__zumayaAccountChannel=ch;
}};
})();
