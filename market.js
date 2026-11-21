(()=>{'use strict';
const $=s=>document.querySelector(s),cfg=window.ZUMAYA_CONFIG||{};
const notice=$('#notice');let sb=null,user=null,stores=[],categories=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FCFA';
function msg(el,t){el.textContent=t}
function formObj(form){return Object.fromEntries(new FormData(form).entries())}
async function init(){try{if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)throw Error('Configuration Supabase absente.');if(!window.supabase?.createClient)throw Error('Bibliothèque Supabase indisponible.');sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);const {data,error}=await sb.auth.getSession();if(error)throw error;user=data.session?.user||null;await Promise.all([loadCategories(),loadProducts()]);if(user)await loadStores();else msg($('#storeState'),'Connectez-vous d’abord depuis le portail ZUMAYA. La connexion est partagée avec ce module.');msg(notice,user?'Marketplace prêt.':'Catalogue public. Connectez-vous via ZUMAYA pour acheter ou vendre.');}catch(e){msg(notice,e.message||'Impossible de charger ZUMAYA MARKET.')}}
async function loadCategories(){const {data,error}=await sb.from('commerce_categories').select('id,name').eq('is_active',true).order('name');if(error)throw error;categories=data||[];for(const id of ['category','productCategory']){const el=$('#'+id);if(!el)continue;categories.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;el.append(o)})}}
async function loadProducts(){const term=$('#search').value.trim();let q=sb.from('commerce_products').select('id,store_id,title,description,price,currency,stock_quantity,image_url,media_urls,video_urls,market_type,commerce_stores!inner(store_name,city,verification_status,is_active)').eq('status','active').eq('commerce_stores.verification_status','verified').eq('commerce_stores.is_active',true).gt('stock_quantity',0).order('created_at',{ascending:false}).limit(80);if(term)q=q.ilike('title','%'+term.replace(/[%_]/g,'')+'%');if($('#category').value)q=q.eq('category_id',$('#category').value);if($('#market').value!=='all')q=q.in('market_type',[$('#market').value,'all']);const {data,error}=await q;if(error)throw error;const root=$('#products');root.innerHTML='';(data||[]).forEach(p=>{const card=document.createElement('article');card.className='product';const image=p.image_url&&/^https:\/\//i.test(p.image_url)?p.image_url:'';card.innerHTML=`<img src="${esc(image)}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none'"><div class="body"><h3>${esc(p.title)}</h3><div class="price">${money(p.price)}</div><div class="meta">${esc(p.commerce_stores.store_name)} · ${esc(p.commerce_stores.city||'Niger')}</div><div class="meta">Stock : ${p.stock_quantity}</div><button type="button" data-buy="${p.id}" data-store="${p.store_id}">Commander</button></div>`;root.append(card)});if(!data?.length)root.innerHTML='<p class="muted">Aucun produit disponible pour cette recherche.</p>';root.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.store,b.dataset.buy)));}
async function loadStores(){const {data,error}=await sb.from('commerce_stores').select('id,store_name,verification_status').eq('owner_id',user.id).order('created_at',{ascending:false});if(error)throw error;stores=data||[];const sel=$('#myStores');sel.innerHTML='<option value="">Sélectionner ma boutique</option>';stores.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.store_name+' ('+s.verification_status+')';sel.append(o)});msg($('#storeState'),stores.length?'Vos boutiques sont chargées. Création et activation automatiques.':'Aucune boutique enregistrée pour ce compte.')}
$('#storeForm').addEventListener('submit',async e=>{e.preventDefault();try{if(!user)throw Error('Connectez-vous avec votre compte ZUMAYA.');const form=e.currentTarget,f=formObj(form);const {error}=await sb.from('commerce_stores').insert({...f,owner_id:user.id,country_code:'CI',verification_status:'verified',is_active:true});if(error)throw error;form.reset();await loadStores();msg($('#storeState'),'Boutique créée et activée automatiquement. Vous pouvez publier vos produits.');}catch(x){msg($('#storeState'),x.message)}});
async function uploadMedia(files,folder,kind){
  const urls=[];
  for(const file of files){
    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const {error}=await sb.storage.from('commerce-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error)throw error;
    const {data}=sb.storage.from('commerce-media').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
$('#productForm').addEventListener('submit',async e=>{e.preventDefault();try{
 if(!user)throw Error('Connectez-vous avec votre compte ZUMAYA.');
 const form=e.currentTarget,f=formObj(form);
 if(!stores.some(s=>s.id===f.store_id))throw Error('Sélectionnez une boutique qui vous appartient.');
 const imgs=[...$('#productImages').files],vids=[...$('#productVideos').files];
 if(imgs.length>8)throw Error('Maximum 8 images par produit.');
 if(vids.length>3)throw Error('Maximum 3 vidéos par produit.');
 const folder=crypto.randomUUID?crypto.randomUUID():String(Date.now());
 msg($('#productState'),'Téléversement des médias et enregistrement…');
 const media_urls=imgs.length?await uploadMedia(imgs,folder,'image'):[];
 const video_urls=vids.length?await uploadMedia(vids,folder,'video'):[];
 const payload={store_id:f.store_id,title:f.title,description:f.description||null,category_id:f.category_id||null,price:Number(f.price),stock_quantity:Number(f.stock_quantity),market_type:f.market_type,image_url:media_urls[0]||null,media_urls,video_urls,currency:'XOF',status:'active'};
 const {error}=await sb.from('commerce_products').insert(payload);if(error)throw error;
 form.reset();$('#imagePreview').innerHTML='';$('#videoPreview').innerHTML='';
 const st=stores.find(x=>x.id===f.store_id);
 msg($('#productState'),st&&st.verification_status==='verified'?'Produit publié.':'Produit publié dans votre boutique.');
 await loadProducts();
 }catch(x){msg($('#productState'),x.message||'Publication impossible.')}}); 
async function buy(storeId,productId){try{if(!user)throw Error('Connectez-vous d’abord depuis le portail ZUMAYA.');const qty=Number(prompt('Quantité souhaitée :','1'));if(!Number.isInteger(qty)||qty<1)return;const address=prompt('Adresse de livraison (facultatif) :','')||null;const {data,error}=await sb.rpc('commerce_create_order',{p_store_id:storeId,p_items:[{product_id:productId,quantity:qty}],p_delivery_address:address,p_buyer_note:null,p_delivery_fee:0});if(error)throw error;alert('Commande créée : '+data+'. Le paiement reste en attente de configuration.');await loadProducts()}catch(e){alert(e.message||'Commande impossible.')}}
const LBL={pending:'En attente',confirmed:'Confirmée',shipped:'Expédiée',delivered:'Livrée',cancelled:'Annulée'};
function actions(o){const n={pending:[['confirmed','Confirmer'],['cancelled','Refuser']],confirmed:[['shipped','Expédiée'],['cancelled','Annuler']],shipped:[['delivered','Livrée']]}[o.status]||[];return n.length?'<div class="acts">'+n.map(a=>`<button type="button" data-o="${o.id}" data-st="${a[0]}">${a[1]}</button>`).join('')+'</div>':''}
async function loadOrders(){const root=$('#orders');try{if(!user)throw Error('Connectez-vous avec votre compte ZUMAYA.');if(!stores.length)await loadStores();const ids=stores.map(s=>s.id);if(!ids.length){root.textContent='Aucune boutique.';return}const {data,error}=await sb.from('commerce_orders').select('id,order_number,status,subtotal,currency,created_at,commerce_stores(store_name)').in('store_id',ids).order('created_at',{ascending:false}).limit(50);if(error)throw error;root.innerHTML=(data||[]).map(o=>`<div class="order"><strong>${esc(o.order_number)}</strong> — ${esc(LBL[o.status]||o.status)}<br><span class="meta">${esc(o.commerce_stores?.store_name||'Boutique')} · ${money(o.subtotal)} · ${new Date(o.created_at).toLocaleDateString('fr-FR')}</span>${actions(o)}</div>`).join('')||'Aucune commande pour le moment.';root.querySelectorAll('[data-st]').forEach(b=>b.addEventListener('click',async()=>{try{const {error:er}=await sb.rpc('commerce_set_order_status',{p_order:b.dataset.o,p_status:b.dataset.st});if(er)throw er;await loadOrders()}catch(x){alert(x.message)}}))}catch(e){root.textContent=e.message}}
$('#loadOrders').addEventListener('click',loadOrders);
$('#refresh').addEventListener('click',()=>loadProducts().catch(e=>msg(notice,e.message)));let timer;$('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>loadProducts().catch(e=>msg(notice,e.message)),300)});$('#category').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));$('#market').addEventListener('change',()=>loadProducts().catch(e=>msg(notice,e.message)));// Navigation du tableau de bord vendeur
document.querySelectorAll('.seller-tab').forEach(t=>t.addEventListener('click',()=>{
 document.querySelectorAll('.seller-tab').forEach(x=>x.classList.toggle('active',x===t));
 document.querySelectorAll('.seller-pane').forEach(p=>p.classList.toggle('active',p.id==='pane-'+t.dataset.pane));
}));
function previewFiles(input,target,isVideo){const box=$(target);input.addEventListener('change',()=>{box.innerHTML='';[...input.files].slice(0,isVideo?3:8).forEach(file=>{const url=URL.createObjectURL(file);const el=document.createElement(isVideo?'video':'img');el.src=url;if(isVideo){el.controls=true;el.muted=true}else el.alt=file.name;box.append(el)});});}
previewFiles($('#productImages'),'#imagePreview',false);previewFiles($('#productVideos'),'#videoPreview',true);
init();
})();
