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
  b.innerHTML=`${https(data.logo_url)?`<img src="${esc(data.logo_url)}" alt="">`:''}<div><h2>${esc(data.store_name)}</h2><p>${esc([data.city,data.description].filter(Boolean).join(' — '))}</p></div><a href="marketplace.html">Toutes les boutiques</a>`;b.hidden=false;
}
async function loadProducts(){
  const term=$('#search').value.trim();
  let q=sb.from('commerce_products').select('id,store_id,title,description,price,currency,stock_quantity,image_url,media_urls,video_urls,market_type,category_id,created_at')
    .eq('status','active').gt('stock_quantity',0).order('created_at',{ascending:false}).limit(100);
  if(storeFilter)q=q.eq('store_id',storeFilter);
  if(term)q=q.ilike('title','%'+term.replace(/[%_,()]/g,'')+'%');
  if($('#category').value)q=q.eq('category_id',$('#category').value);
  if($('#market').value!=='all')q=q.in('market_type',[$('#market').value,'all']);
  const [{data:products,error:productError},{data:stores,error:storeError},{data:categories,error:categoryError}]=await Promise.all([
    q,
    sb.from('commerce_stores').select('id,store_name,city,phone,verification_status,is_active').eq('verification_status','verified').eq('is_active',true),
    sb.from('commerce_categories').select('id,name').eq('is_active',true)
  ]);
  if(productError)throw productError;if(storeError)throw storeError;
  const storeMap=new Map((stores||[]).map(x=>[String(x.id),x]));
  const categoryMap=new Map((categories||[]).map(x=>[String(x.id),x]));
  items=(products||[]).filter(p=>storeMap.has(String(p.store_id))).map(p=>({...p,commerce_stores:storeMap.get(String(p.store_id)),commerce_categories:categoryMap.get(String(p.category_id))||null}));
  const root=$('#products');root.innerHTML='';
  items.forEach(p=>{const card=document.createElement('article');card.className='product';card.dataset.id=p.id;
    const img=https(p.image_url)||https((p.media_urls||[])[0]);
    card.innerHTML=`<div class="ph">${img?`<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none'">`:''}</div><div class="body"><span class="kicker">${esc(p.commerce_categories?.name||'MARKETPLACE')}</span><h3>${esc(p.title)}</h3><p>${esc(p.description||'')}</p><div class="meta">🏪 ${esc(p.commerce_stores.store_name)}${p.commerce_stores.city?' · '+esc(p.commerce_stores.city):''}</div><strong>${money(p.price)}</strong><button type="button" class="btn" data-open="${esc(p.id)}">Voir le produit</button></div>`;
    card.addEventListener('click',e=>{if(e.target.closest('[data-open]'))openProduct(p.id)});root.append(card);
  });
  if(!items.length)root.innerHTML='<p class="empty">Aucun produit public disponible pour le moment.</p>';
}
function openProduct(id){
  const p=items.find(x=>x.id===id);if(!p)return;
  const imgs=((p.media_urls||[]).length?p.media_urls:[p.image_url]).map(https).filter(Boolean),vids=(p.video_urls||[]).map(https).filter(Boolean);
  $('#pcontent').innerHTML=`<div class="gallery">${imgs.map(u=>`<img src="${esc(u)}" alt="${esc(p.title)}">`).join('')}${vids.map(u=>`<video src="${esc(u)}" controls playsinline preload="metadata"></video>`).join('')}</div>
  <div class="pinfo"><h2>${esc(p.title)}</h2><div class="price">${money(p.price)}</div><div class="meta">Vendu par <a href="marketplace.html?store=${encodeURIComponent(p.store_id)}">${esc(p.commerce_stores.store_name)}</a> · ${esc(p.commerce_stores.city||'')}</div><div class="meta">Stock : ${p.stock_quantity}</div>${p.description?`<p>${esc(p.description)}</p>`:''}<button type="button" id="pbuy">Commander</button></div>`;
  $('#pbuy').addEventListener('click',()=>buy(p.store_id,p.id));
  $('#pmodal').hidden=false;document.body.style.overflow='hidden';
  sb.rpc('commerce_track_view',{p_product:p.id,p_session:sessionKey()}).then(()=>{},()=>{});
}
function closeModal(){$('#pmodal').hidden=true;document.body.style.overflow='';$('#pcontent').innerHTML=''}
$('#pclose').addEventListener('click',closeModal);$('#pmodal').addEventListener('click',e=>{if(e.target.id==='pmodal')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
async function buy(storeId,productId){try{if(!user)throw Error('Connectez-vous d’abord depuis le portail ZUMAYA.');const qty=Number(prompt('Quantité souhaitée :','1'));if(!Number.isInteger(qty)||qty<1)return;const address=prompt('Adresse de livraison (facultatif) :','')||null;const {data,error}=await sb.rpc('commerce_create_order',{p_store_id:storeId,p_items:[{product_id:productId,quantity:qty}],p_delivery_address:address,p_buyer_note:null,p_delivery_fee:0});if(error)throw error;alert('Commande créée : '+data+'. Le vendeur va la confirmer.');closeModal();await loadProducts()}catch(e){alert(e.message||'Commande impossible.')}}
$('#refresh').addEventListener('click',()=>loadProducts().catch(e=>msg(notice,e.message)));
let timer;$('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>loadProducts().catch(e=>msg(notice,e.message)),300)});
$('#category').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));$('#market').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));
init();
})();
