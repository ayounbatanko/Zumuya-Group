(()=>{'use strict';
const $=s=>document.querySelector(s),cfg=window.ZUMAYA_CONFIG||{};
const notice=$('#notice');let sb=null,user=null,items=[],marketCart=readMarketCart();
const params=new URLSearchParams(location.search),storeFilter=params.get('store');let autoAdded=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FCFA';
const https=u=>typeof u==='string'&&/^https:\/\//i.test(u)?u:'';
function msg(el,t){el.textContent=t}
async function init(){try{
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)throw Error('Configuration Supabase absente.');
  if(!window.supabase?.createClient)throw Error('Bibliothèque Supabase indisponible.');
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const {data,error}=await sb.auth.getSession();if(error)throw error;user=data.session?.user||null;
  await Promise.all([loadCategories(),loadProducts(),loadBanner()]);ensureCartPanel();renderMarketCart();
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
  let q=sb.from('commerce_products').select('id,store_id,title,description,price,stock_quantity,image_url,media_urls,video_urls,market_type,commerce_stores!inner(store_name,city,phone,verification_status,is_active)').eq('status','active').eq('commerce_stores.is_active',true).gt('stock_quantity',0).order('created_at',{ascending:false}).limit(80);
  if(storeFilter)q=q.eq('store_id',storeFilter);
  if(term)q=q.ilike('title','%'+term.replace(/[%_,()]/g,'')+'%');
  if($('#category').value)q=q.eq('category_id',$('#category').value);
  if($('#market').value!=='all')q=q.in('market_type',[$('#market').value,'all']);
  const {data,error}=await q;if(error)throw error;items=data||[];
  const root=$('#products');root.innerHTML='';
  items.forEach(p=>{const card=document.createElement('article');card.className='product';card.dataset.id=p.id;
    const img=https(p.image_url)||https((p.media_urls||[])[0]);
    card.innerHTML=`<div class="ph">${img?`<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none'">`:''}</div><div class="body"><h3>${esc(p.title)}</h3><div class="price">${money(p.price)}</div><div class="meta">${esc(p.commerce_stores.store_name)} · ${esc(p.commerce_stores.city||'')}</div><div class="meta">Stock : ${p.stock_quantity}${(p.video_urls||[]).length?' · 🎥':''}</div><button type="button" data-add="${p.id}" data-store="${p.store_id}">＋ Ajouter au panier</button></div>`;
    root.append(card)});
  if(!items.length)root.innerHTML='<p class="muted">Aucun produit disponible pour cette recherche.</p>';
  renderMarketCart();
  const requested=params.get('product');if(requested&&!autoAdded){autoAdded=true;addToMarketCart(requested)}
}
$('#products').addEventListener('click',e=>{
  const b=e.target.closest('[data-add]');
  if(b){e.stopPropagation();return addToMarketCart(b.dataset.add)}
  const q=e.target.closest('[data-cart-action]');if(q){e.stopPropagation();return marketCartAction(q.dataset.cartAction,q.dataset.id)}
  const c=e.target.closest('.product');if(c)openProduct(c.dataset.id);
});
function sessionKey(){try{let k=sessionStorage.getItem('zm_sk');if(!k){k=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2))+'';sessionStorage.setItem('zm_sk',k)}return k}catch(_){return null}}
function openProduct(id){
  const p=items.find(x=>x.id===id);if(!p)return;
  const imgs=((p.media_urls||[]).length?p.media_urls:[p.image_url]).map(https).filter(Boolean),vids=(p.video_urls||[]).map(https).filter(Boolean);
  $('#pcontent').innerHTML=`<div class="gallery">${imgs.map(u=>`<img src="${esc(u)}" alt="${esc(p.title)}">`).join('')}${vids.map(u=>`<video src="${esc(u)}" controls playsinline preload="metadata"></video>`).join('')}</div>
  <div class="pinfo"><h2>${esc(p.title)}</h2><div class="price">${money(p.price)}</div><div class="meta">Vendu par <a href="marketplace.html?store=${encodeURIComponent(p.store_id)}">${esc(p.commerce_stores.store_name)}</a> · ${esc(p.commerce_stores.city||'')}</div><div class="meta">Stock : ${p.stock_quantity}</div>${p.description?`<p>${esc(p.description)}</p>`:''}<div class="zm-actions"><button type="button" id="pbuy">＋ Ajouter au panier</button> <a class="zm-chat" href="messagerie.html?kind=store&ref=${encodeURIComponent(p.store_id)}&subject=${encodeURIComponent('Question sur : '+p.title)}&ctx_type=product&ctx_id=${encodeURIComponent(p.id)}">💬 Contacter le vendeur</a></div></div>`;
  $('#pbuy').addEventListener('click',()=>{addToMarketCart(p.id);closeModal()});
  $('#pmodal').hidden=false;document.body.style.overflow='hidden';
  sb.rpc('commerce_track_view',{p_product:p.id,p_session:sessionKey()}).then(()=>{},()=>{});
}
function closeModal(){$('#pmodal').hidden=true;document.body.style.overflow='';$('#pcontent').innerHTML=''}
$('#pclose').addEventListener('click',closeModal);$('#pmodal').addEventListener('click',e=>{if(e.target.id==='pmodal')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function myPos(){return new Promise(ok=>{if(!navigator.geolocation)return ok(null);navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude}),()=>ok(null),{enableHighAccuracy:true,timeout:12000,maximumAge:60000})})}
function readMarketCart(){try{return JSON.parse(localStorage.getItem('zm_market_cart')||'null')}catch(_){return null}}
function writeMarketCart(){try{localStorage.setItem('zm_market_cart',JSON.stringify(marketCart))}catch(_){}}
function ensureCartPanel(){if($('#marketCart'))return;const box=document.createElement('section');box.id='marketCart';box.className='market-cart-panel';box.innerHTML='<h2>🛒 Mon panier Marketplace</h2><div id="marketCartBody"></div>';const anchor=$('#products');anchor.parentNode.insertBefore(box,anchor)}
function renderMarketCart(){
 const box=$('#marketCartBody');if(!box)return;
 if(!marketCart||!marketCart.items||!marketCart.items.length){box.innerHTML='<p class="muted">Votre panier est vide. Ajoutez des produits d’une même boutique pour préparer votre commande.</p>';return}
 const total=marketCart.items.reduce((n,x)=>n+x.price*x.qty,0);
 const lines=marketCart.items.map(x=>'<div class="market-cart-line"><span><b>'+esc(x.title)+'</b><br><small>'+money(x.price)+' × '+x.qty+'</small></span><span class="cart-qty"><button type="button" data-cart-action="minus" data-id="'+esc(x.id)+'">−</button><b>'+x.qty+'</b><button type="button" data-cart-action="plus" data-id="'+esc(x.id)+'">＋</button><button type="button" data-cart-action="remove" data-id="'+esc(x.id)+'">Retirer</button></span></div>').join('');
 box.innerHTML='<p><b>Boutique :</b> '+esc(marketCart.store_name)+' · '+marketCart.items.reduce((n,x)=>n+x.qty,0)+' article(s)</p><div class="market-cart-lines">'+lines+'</div><p class="cart-total"><b>Total produits : '+money(total)+'</b></p><p><a href="messagerie.html?kind=store&ref='+encodeURIComponent(marketCart.store_id)+'&subject='+encodeURIComponent('Question sur mon panier')+'">💬 Discuter avec le fournisseur</a></p><button type="button" id="marketCheckout">Valider la commande</button> <button type="button" id="marketClear">Vider le panier</button>';
 $('#marketCheckout').onclick=checkoutMarketCart;$('#marketClear').onclick=()=>{marketCart=null;writeMarketCart();renderMarketCart()};
}
function addToMarketCart(id){
 if(!user){alert('Connectez-vous d’abord depuis votre compte ZUMAYA pour ajouter des produits au panier.');return}
 const p=items.find(x=>x.id===id);if(!p)return;
 if(marketCart&&marketCart.store_id!==p.store_id){if(!confirm('Votre panier contient déjà des produits d’une autre boutique. Le vider pour continuer avec ce fournisseur ?'))return;marketCart=null}
 if(!marketCart)marketCart={store_id:p.store_id,store_name:p.commerce_stores.store_name,items:[]};
 const line=marketCart.items.find(x=>x.id===p.id);
 if(line){if(line.qty>=p.stock_quantity){alert('Stock disponible insuffisant.');return}line.qty++}
 else marketCart.items.push({id:p.id,title:p.title,price:Number(p.price)||0,qty:1,stock:p.stock_quantity});
 writeMarketCart();renderMarketCart();msg(notice,p.title+' ajouté au panier.');
}
function marketCartAction(action,id){
 if(!marketCart)return;const line=marketCart.items.find(x=>x.id===id);if(!line)return;
 if(action==='plus'){if(line.qty>=line.stock){alert('Stock disponible insuffisant.');return}line.qty++}
 if(action==='minus')line.qty--;
 if(action==='remove')line.qty=0;
 marketCart.items=marketCart.items.filter(x=>x.qty>0);
 if(!marketCart.items.length)marketCart=null;
 writeMarketCart();renderMarketCart();
}
async function checkoutMarketCart(){
 try{
  if(!user)throw Error('Connectez-vous d’abord depuis votre compte ZUMAYA.');
  if(!marketCart||!marketCart.items.length)return;
  const address=prompt('Adresse de livraison (quartier, rue, repère) :','');if(address===null)return;if(!address.trim())throw Error('Saisissez une adresse de livraison.');
  const city=(prompt('Ville de livraison :','')||'').trim()||null;
  let pos=null;if(confirm('Partager votre position GPS pour faciliter la livraison ?\\nOK = oui · Annuler = non'))pos=await myPos();
  const payload={p_store_id:marketCart.store_id,p_items:marketCart.items.map(x=>({product_id:x.id,quantity:x.qty})),p_delivery_address:address.trim(),p_buyer_note:null,p_delivery_fee:0,p_delivery_city:city,p_delivery_lat:pos?pos.lat:null,p_delivery_lng:pos?pos.lng:null};
  const {data,error}=await sb.rpc('commerce_create_order',payload);if(error)throw error;
  const ref=data;marketCart=null;writeMarketCart();renderMarketCart();alert('Commande créée : '+ref+'. Le vendeur va la confirmer. Vous pouvez échanger avec lui par messagerie.');await loadProducts();
 }catch(e){alert(e.message||'Commande impossible.')}
}
$('#refresh').addEventListener('click',()=>loadProducts().catch(e=>msg(notice,e.message)));
let timer;$('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>loadProducts().catch(e=>msg(notice,e.message)),300)});
$('#category').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));$('#market').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));
init();
})();
