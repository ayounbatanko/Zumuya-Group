(()=>{'use strict';
const $=s=>document.querySelector(s),cfg=window.ZUMAYA_CONFIG||{};
const notice=$('#notice');let sb=null,user=null,items=[];
const params=new URLSearchParams(location.search),storeFilter=params.get('store');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FCFA';
const https=u=>typeof u==='string'&&/^https:\/\//i.test(u)?u:'';
function msg(el,t){el.textContent=t}
async function init(){try{
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)throw Error('Configuration Supabase absente.');
  if(!window.supabase?.createClient)throw Error('Bibliothèque Supabase indisponible.');
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const {data,error}=await sb.auth.getSession();if(error)throw error;user=data.session?.user||null;
  await Promise.all([loadCategories(),loadProducts(),loadBanner()]);
  msg(notice,user?'Marketplace prêt.':'Catalogue public. Connectez-vous via ZUMAYA pour acheter ou vendre.');
}catch(e){msg(notice,e.message||'Impossible de charger ZUMAYA MARKET.')}}
async function loadCategories(){const {data,error}=await sb.from('commerce_categories').select('id,name').eq('is_active',true).order('name');if(error)throw error;(data||[]).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;$('#category').append(o)})}
async function loadBanner(){
  if(!storeFilter)return;
  const {data}=await sb.from('commerce_stores').select('store_name,city,description,logo_url').eq('id',storeFilter).maybeSingle();
  const b=$('#storeBanner');if(!data){return}
  b.innerHTML=`${https(data.logo_url)?`<img src="${esc(data.logo_url)}" alt="">`:''}<div><h2>${esc(data.store_name)}</h2><p>${esc([data.city,data.description].filter(Boolean).join(' — '))}</p></div><a href="marketplace.html">Toutes les boutiques</a> <a href="messagerie.html?kind=store&ref=${encodeURIComponent(storeFilter)}&subject=${encodeURIComponent('Question à '+data.store_name)}">💬 Contacter la boutique</a>`;b.hidden=false;
}
async function loadProducts(){
  const term=$('#search').value.trim();
  let q=sb.from('commerce_products').select('id,store_id,title,description,price,stock_quantity,image_url,media_urls,video_urls,market_type,commerce_stores!inner(store_name,city,phone,verification_status,is_active)').eq('status','active').eq('commerce_stores.verification_status','verified').eq('commerce_stores.is_active',true).gt('stock_quantity',0).order('created_at',{ascending:false}).limit(80);
  if(storeFilter)q=q.eq('store_id',storeFilter);
  if(term)q=q.ilike('title','%'+term.replace(/[%_,()]/g,'')+'%');
  if($('#category').value)q=q.eq('category_id',$('#category').value);
  if($('#market').value!=='all')q=q.in('market_type',[$('#market').value,'all']);
  const {data,error}=await q;if(error)throw error;items=data||[];
  const root=$('#products');root.innerHTML='';
  items.forEach(p=>{const card=document.createElement('article');card.className='product';card.dataset.id=p.id;
    const img=https(p.image_url)||https((p.media_urls||[])[0]);
    card.innerHTML=`<div class="ph">${img?`<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none'">`:''}</div><div class="body"><h3>${esc(p.title)}</h3><div class="price">${money(p.price)}</div><div class="meta">${esc(p.commerce_stores.store_name)} · ${esc(p.commerce_stores.city||'')}</div><div class="meta">Stock : ${p.stock_quantity}${(p.video_urls||[]).length?' · 🎥':''}</div><button type="button" data-buy="${p.id}" data-store="${p.store_id}">Commander</button><a class="zm-chat" data-contact href="messagerie.html?kind=store&ref=${encodeURIComponent(p.store_id)}&subject=${encodeURIComponent('Question sur : '+p.title)}&ctx_type=product&ctx_id=${encodeURIComponent(p.id)}">💬 Contacter le fournisseur</a></div>`;
    root.append(card)});
  if(!items.length)root.innerHTML='<p class="muted">Aucun produit disponible pour cette recherche.</p>';
}
$('#products').addEventListener('click',e=>{
  const contact=e.target.closest('[data-contact]');if(contact){e.stopPropagation();return}
  const b=e.target.closest('[data-buy]');
  if(b){e.stopPropagation();return buy(b.dataset.store,b.dataset.buy)}
  const c=e.target.closest('.product');if(c)openProduct(c.dataset.id);
});
function sessionKey(){try{let k=sessionStorage.getItem('zm_sk');if(!k){k=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2))+'';sessionStorage.setItem('zm_sk',k)}return k}catch(_){return null}}
function openProduct(id){
  const p=items.find(x=>x.id===id);if(!p)return;
  const imgs=((p.media_urls||[]).length?p.media_urls:[p.image_url]).map(https).filter(Boolean),vids=(p.video_urls||[]).map(https).filter(Boolean);
  $('#pcontent').innerHTML=`<div class="gallery">${imgs.map(u=>`<img src="${esc(u)}" alt="${esc(p.title)}">`).join('')}${vids.map(u=>`<video src="${esc(u)}" controls playsinline preload="metadata"></video>`).join('')}</div>
  <div class="pinfo"><h2>${esc(p.title)}</h2><div class="price">${money(p.price)}</div><div class="meta">Vendu par <a href="marketplace.html?store=${encodeURIComponent(p.store_id)}">${esc(p.commerce_stores.store_name)}</a> · ${esc(p.commerce_stores.city||'')}</div><div class="meta">Stock : ${p.stock_quantity}</div>${p.description?`<p>${esc(p.description)}</p>`:''}<div class="zm-actions"><button type="button" id="pbuy">Commander</button> <a class="zm-chat" href="messagerie.html?kind=store&ref=${encodeURIComponent(p.store_id)}&subject=${encodeURIComponent('Question sur : '+p.title)}&ctx_type=product&ctx_id=${encodeURIComponent(p.id)}">💬 Contacter le vendeur</a></div></div>`;
  $('#pbuy').addEventListener('click',()=>buy(p.store_id,p.id));
  $('#pmodal').hidden=false;document.body.style.overflow='hidden';
  sb.rpc('commerce_track_view',{p_product:p.id,p_session:sessionKey()}).then(()=>{},()=>{});
}
function closeModal(){$('#pmodal').hidden=true;document.body.style.overflow='';$('#pcontent').innerHTML=''}
$('#pclose').addEventListener('click',closeModal);$('#pmodal').addEventListener('click',e=>{if(e.target.id==='pmodal')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function myPos(){return new Promise(ok=>{if(!navigator.geolocation)return ok(null);navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude}),()=>ok(null),{enableHighAccuracy:true,timeout:12000,maximumAge:60000})})}
async function buy(storeId,productId){try{if(!user)throw Error('Connectez-vous d’abord depuis le portail ZUMAYA.');const qty=Number(prompt('Quantité souhaitée :','1'));if(!Number.isInteger(qty)||qty<1)return;
  const address=prompt('Adresse de livraison (quartier, rue, repère) :','')||null;const city=(prompt('Ville de livraison (nécessaire pour trouver une société de livraison) :','')||'').trim()||null;
  let pos=null;if(confirm('Partager votre position GPS pour faciliter la livraison ?\nOK = oui · Annuler = non, la ville suffit'))pos=await myPos();
  const {data,error}=await sb.rpc('commerce_create_order',{p_store_id:storeId,p_items:[{product_id:productId,quantity:qty}],p_delivery_address:address,p_buyer_note:null,p_delivery_fee:0,p_delivery_city:city,p_delivery_lat:pos?pos.lat:null,p_delivery_lng:pos?pos.lng:null});if(error)throw error;
  alert('Commande créée : '+data+'. Le vendeur va la confirmer et pourra organiser la livraison. Vous pouvez lui écrire par messagerie.');closeModal();await loadProducts()}catch(e){alert(e.message||'Commande impossible.')}}
$('#refresh').addEventListener('click',()=>loadProducts().catch(e=>msg(notice,e.message)));
let timer;$('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>loadProducts().catch(e=>msg(notice,e.message)),300)});
$('#category').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));$('#market').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));
init();
})();
