/* ZUMUYA GROUP — catalogue public des partenaires (accueil). Visible sans compte.
   Tous les comptes connectés peuvent commander ; le panier et le suivi sont gérés par zcart.js. */
(()=>{'use strict';
const root=document.getElementById('pubCatalog');if(!root||!window.ZS)return;
const esc=ZS.esc,ZC=window.ZC||{ctl:()=>'',headBtn:()=>'',init(){},setData(){}};
let rests=[],pos=null,q='',sort='near',open={},err='',loading=true,agroProducts=[],mktProducts=[],orgs=[],agroCart=readAgroCart();
const $=s=>root.querySelector(s);
const chatHref=(k,ref,sub)=>'messagerie.html?kind='+k+'&ref='+encodeURIComponent(ref)+'&subject='+encodeURIComponent(sub||'');
let cat=(()=>{try{const v=sessionStorage.getItem('zg_cat');return ['social','resto','hotel','agro','market','delivery'].includes(v)?v:'none'}catch(_){return 'none'}})();
function phRests(){const known=new Set(rests.map(r=>r.portalOrgId).filter(Boolean)),names=new Set(rests.map(r=>(r.name||'').trim().toLowerCase()));
 return orgs.filter(o=>(o.organization_type==='restaurant'||o.organization_type==='hotel')&&!known.has(o.id)&&!names.has((o.public_name||'').trim().toLowerCase()));}
function phCard(o){const h=o.organization_type==='hotel';
 return '<article class="pc-rest"><div class="pc-head"><div class="pc-logo">'+(h?'🏨':'🍽️')+'</div><div class="pc-g"><h3>'+esc(o.public_name)+'</h3><span class="pc-mut">'+esc([o.address,o.city].filter(Boolean).join(', ')||'Adresse non renseignée')+'</span><div class="pc-badges"><span class="pc-b">'+(h?'Hôtel':'Restaurant')+'</span><span class="pc-b grey">0 plat</span><a class="pc-b gold" href="'+chatHref('org',o.id,'Question à '+o.public_name)+'">💬 Écrire</a></div></div></div><p class="pc-mut" style="padding:14px 18px">Catalogue bientôt disponible.</p></article>'}
function catBar(){const ph=phRests(),nph=ph.length,nph_h=ph.filter(o=>o.organization_type==='hotel').length,nh=rests.filter(r=>ZS.isHotel(r)).length+nph_h,nr=rests.length-rests.filter(r=>ZS.isHotel(r)).length+(nph-nph_h),na=agroProducts.filter(p=>p.availability!=='unavailable').length,nm=mktProducts.length;
 const nd=orgs.filter(o=>['delivery','delivery_service','logistics'].includes(o.organization_type)).length;return '<div class="pc-cats" role="tablist" aria-label="Catégorie de catalogue">'+[['social','🌐 Réseau social',''],['resto','🍽️ Restaurant',nr],['hotel','🏨 Hôtel',nh],['agro','🌾 Agro',na],['market','🛍️ Marketplace',nm],['delivery','🚚 Livraison',nd]].map(x=>'<button type="button" role="tab" data-cat="'+x[0]+'" class="'+(cat===x[0]?'on':'')+'" aria-selected="'+(cat===x[0])+'">'+x[1]+' <i>'+x[2]+'</i></button>').join('')+'</div>'}
function dishCard(r,p,k,fee){
 const img=p.imgs&&p.imgs[0]?'<img loading="lazy" src="'+esc(p.imgs[0])+'" alt="">':'<div class="pc-ph">🍽️</div>',act=ZC.ctl(r.id,k,p.n);
 return '<div class="pc-dish">'+img+'<div class="pc-in"><b>'+esc(p.n)+'</b><span class="pc-d">'+esc(p.desc||'')+'</span><span class="pc-pr">'+ZS.money(p.p,r.currency)+'</span>'+
  (fee!=null?'<span class="pc-dl">🛵 + livraison '+ZS.money(fee,r.currency)+'</span>':'')+act+'</div></div>'}
function card(x){
 const r=x.r,d=x.d,fee=ZS.fee(r,d),ql=q.toLowerCase();let menu=(r.menu||[]).map((p,k)=>({p,k}));
 if(ql&&!(r.name||'').toLowerCase().includes(ql))menu=menu.filter(m=>((m.p.n||'')+' '+(m.p.desc||'')).toLowerCase().includes(ql));
 const all=open[r.id]||ql,show=all?menu:menu.slice(0,4);
 return '<article class="pc-rest"><div class="pc-head">'+(r.logo?'<img class="pc-logo" src="'+esc(r.logo)+'" alt="">':'<div class="pc-logo">🍽️</div>')+
  '<div class="pc-g"><h3>'+esc(r.name)+'</h3><span class="pc-mut">'+esc(r.address||'Adresse non renseignée')+'</span><div class="pc-badges">'+
  (d!=null?'<span class="pc-b">📍 '+ZS.dist(d)+'</span>':'')+
  (fee!=null?'<span class="pc-b gold">🛵 livraison '+ZS.money(fee,r.currency)+'</span>':(+r.kmPrice>0?'<span class="pc-b grey">🛵 '+ZS.money(r.kmPrice,r.currency)+' / km</span>':''))+
  '<a class="pc-b gold" href="'+(r.portalOrgId?chatHref('org',r.portalOrgId,'Question à '+r.name):chatHref('rest',r.id,'Question à '+r.name))+'">💬 Écrire</a><span class="pc-b grey">'+(r.menu||[]).length+' plat'+((r.menu||[]).length>1?'s':'')+'</span><span class="pc-b '+(window.ZC?.isOpen?.(r)!==false?'':'closed')+'">'+(window.ZC?.isOpen?.(r)!==false?'● Ouvert':'● Fermé · ouvre '+(r.openAt||'08:00'))+'</span></div></div>'+
  ZC.headBtn(r.id)+'</div>'+
  (show.length?'<div class="pc-dishes">'+[...new Map(show.map(m=>[String(m.p.category||m.p.section||'Menu'),show.filter(x=>String(x.p.category||x.p.section||'Menu')===String(m.p.category||m.p.section||'Menu'))])).entries()].map(([name,items])=>'<section class="pc-menu-category"><h4>'+esc(name)+'</h4><div class="pc-dishes">'+items.map(m=>dishCard(r,m.p,m.k,fee)).join('')+'</div></section>').join('')+'</div>':'<p class="pc-mut" style="padding:14px 18px">'+(ql?'Aucun plat ne correspond.':'Catalogue bientôt disponible.')+'</p>')+
  (!all&&menu.length>4?'<button type="button" class="pc-more" data-open="'+esc(r.id)+'">Voir tout le catalogue ('+menu.length+' plats)</button>':'')+'</article>'}
function draw(){
 const ql=q.toLowerCase();let list=rests.filter(r=>cat==='all'?true:cat==='hotel'?ZS.isHotel(r):cat==='resto'?!ZS.isHotel(r):false).map(r=>({r,d:pos&&r.lat!=null&&r.lng!=null?ZS.km(pos,[r.lat,r.lng]):null}));
 if(ql)list=list.filter(x=>(x.r.name||'').toLowerCase().includes(ql)||(x.r.menu||[]).some(p=>((p.n||'')+' '+(p.desc||'')).toLowerCase().includes(ql)));
 if(sort==='fee')list.sort((a,b)=>(ZS.fee(a.r,a.d)??1e12)-(ZS.fee(b.r,b.d)??1e12));else list.sort((a,b)=>(a.d??1e9)-(b.d??1e9));
 const keep=document.activeElement&&document.activeElement.id==='pcSearch'?document.activeElement.selectionStart:null;
 root.innerHTML=catBar()+(cat==='none'?'<section class="market-section pc-category-prompt"><h3>Choisissez une catégorie</h3><p class="pc-mut">Les catalogues et leurs produits s’afficheront uniquement après votre sélection.</p></section>':'<div class="pc-bar"><input id="pcSearch" type="search" placeholder="'+(cat==='all'?'Rechercher un restaurant, un plat ou un produit…':cat==='market'?'Rechercher un produit ou une boutique…':cat==='agro'?'Rechercher un produit agricole…':cat==='hotel'?'Rechercher un hôtel ou un plat…':'Rechercher un restaurant ou un plat…')+'" value="'+esc(q)+'" aria-label="Rechercher un restaurant ou un plat">'+(cat==='agro'||cat==='market'?'':'<select id="pcSort" aria-label="Trier"><option value="near"'+(sort==='near'?' selected':'')+'>Les plus proches</option><option value="fee"'+(sort==='fee'?' selected':'')+'>Livraison la moins chère</option></select>')+(pos?'<span class="pc-b">📍 Position active</span>':'<button type="button" class="btn btn-gold" id="pcLoc">📍 Activer ma localisation</button>')+'</div>'+
  (err?'<div class="pc-err">'+esc(err)+'</div>':'')+
  (()=>{const showR=['resto','hotel'].includes(cat),showA=cat==='agro',showM=cat==='market';let out='';
  const phl=phRests().filter(o=>(cat==='hotel')===(o.organization_type==='hotel')&&(!ql||(o.public_name||'').toLowerCase().includes(ql)));
  if(showR){if(loading)out+='<p class="empty">Chargement des catalogues…</p>';else if(list.length||phl.length)out+=list.map(card).join('')+phl.map(phCard).join('');else if(cat!=='all')out+='<p class="empty">Aucun '+(cat==='hotel'?'hôtel':'restaurant')+' partenaire disponible pour le moment.</p>'}
  if(showA){const a=agroHTML(cat==='all');out+=a}
  if(showM){out+=marketHTML(cat==='all')}
  if(cat==='social')out='<section class="market-section"><div class="market-heading"><div><span class="market-kicker">PÔLE 1</span><h3>🌐 Réseau social ZUMUYA</h3><p>Publications, photos, vidéos, réactions et échanges avec la communauté.</p></div></div><a class="btn btn-gold" href="reseau-social.html">Ouvrir le réseau social →</a></section>';\n  if(cat==='delivery'){const ds=orgs.filter(o=>['delivery','delivery_service','logistics'].includes(o.organization_type));out=ds.length?'<section class="market-section"><div class="market-heading"><h3>🚚 Services de livraison partenaires</h3></div><div class="market-grid">'+ds.map(o=>'<article class="market-product"><div class="market-photo">🚚</div><div class="market-product-body"><h4>'+esc(o.public_name||'Service de livraison')+'</h4><p>'+esc([o.address,o.city].filter(Boolean).join(', '))+'</p><a class="pc-add" href="messagerie.html?kind=org&ref='+encodeURIComponent(o.id)+'">💬 Contacter</a></div></article>').join('')+'</div></section>':'<p class="empty">Aucun service de livraison partenaire disponible.</p>'}\n  if(!out.trim())out='<p class="empty">Aucun contenu disponible pour le moment.</p>';return out})());
 const s=$('#pcSearch');s.oninput=e=>{q=e.target.value;draw()};if(keep!=null){s.focus();s.setSelectionRange(keep,keep)}
 if($('#pcSort'))$('#pcSort').onchange=e=>{sort=e.target.value;draw()};const l=$('#pcLoc');if(l)l.onclick=locate}

root.addEventListener('click',e=>{const c=e.target.closest('[data-cat]');if(c){cat=c.dataset.cat;try{sessionStorage.setItem('zg_cat',cat)}catch(_){}draw();return}const b=e.target.closest('[data-open]');if(b){open[b.dataset.open]=1;draw()}});

function readAgroCart(){try{return JSON.parse(localStorage.getItem('zg_agro_cart')||'null')}catch(_){return null}}
function writeAgroCart(){try{localStorage.setItem('zg_agro_cart',JSON.stringify(agroCart))}catch(_){}}
function categoryGroups(items,keyFn,renderFn){const groups=new Map();items.forEach(x=>{const k=(keyFn(x)||'Autres').trim()||'Autres';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'fr')).map(([k,arr])=>'<section class="pc-product-category"><h4>'+esc(k)+' <small>('+arr.length+')</small></h4><div class="market-grid">'+arr.map(renderFn).join('')+'</div></section>').join('')}
function agroHTML(hideEmpty){
 const products=agroProducts.filter(p=>p.availability!=='unavailable'&&(!q||((p.product_name+' '+p.category+' '+(p.owner?.business_name||'')).toLowerCase().includes(q.toLowerCase()))));
 const prods=orgs.filter(o=>o.organization_type==='agro'||o.organization_type==='agro_trader');
 if(!products.length&&prods.length)return '<section class="market-section"><div class="market-heading"><div><span class="market-kicker">PÔLE AGRICOLE</span><h3>Producteurs partenaires</h3><p>Les produits seront affichés dès leur publication.</p></div><span class="market-count">'+prods.length+' producteur'+(prods.length>1?'s':'')+'</span></div><div class="market-grid">'+prods.map(o=>'<article class="market-product"><div class="market-photo">🌱</div><div class="market-product-body"><span class="market-kicker">'+(o.organization_type==='agro'?'PRODUCTEUR':'COMMERÇANT AGRICOLE')+'</span><h4>'+esc(o.public_name)+'</h4><p>'+esc([o.address,o.city].filter(Boolean).join(', '))+'</p></div></article>').join('')+'</div></section>';
 if(!products.length)return hideEmpty?'':'<section class="market-section"><h3>🌾 Catalogue des producteurs agricoles</h3><p class="pc-mut">Aucun produit agricole public disponible pour le moment.</p></section>';
 return '<section class="market-section"><div class="market-heading"><div><span class="market-kicker">PÔLE AGRICOLE</span><h3>Produits des producteurs partenaires</h3><p>Produits classés par catégorie. Choisissez les produits d’un seul fournisseur par panier.</p></div><span class="market-count">'+products.length+' produits</span></div>'+categoryGroups(products,p=>p.category,p=>{const owner=p.owner||{},qty=agroCart&&agroCart.owner_id===p.owner_id?((agroCart.items||[]).find(x=>x.id===p.id)?.qty||0):0;return '<article class="market-product">'+(p.photo_url?'<img loading="lazy" src="'+esc(p.photo_url)+'" alt="">':'<div class="market-photo">🌱</div>')+'<div class="market-product-body"><h4>'+esc(p.product_name)+'</h4><p>'+esc(p.description||'')+'</p><div class="market-owner">🏡 '+esc(owner.business_name||'Producteur partenaire')+' · '+esc(owner.city||'')+'</div><strong>'+ZS.money(p.price,'XOF')+' / '+esc(p.unit||'unité')+'</strong><button type="button" class="pc-add" data-agro-add="'+esc(p.id)+'">＋ Ajouter au panier'+(qty?' ('+qty+')':'')+'</button> <a class="pc-add" style="text-decoration:none;display:inline-block" href="'+chatHref('user',p.owner_id,'Question sur : '+p.product_name)+'">💬 Contacter</a></div></article>'})+'</section>'+
 (agroCart?'<div class="market-cart"><b>🛒 Panier · '+esc(agroCart.owner_name)+'</b><div class="market-cart-lines">'+agroCart.items.map(x=>'<div class="market-cart-line"><span>'+esc(x.name)+' · '+ZS.money(x.price*x.qty,'XOF')+'</span><span><button type="button" data-agro-qty="-" data-id="'+esc(x.id)+'">−</button> '+x.qty+' <button type="button" data-agro-qty="+" data-id="'+esc(x.id)+'">＋</button> <button type="button" data-agro-remove="'+esc(x.id)+'">Retirer</button></span></div>').join('')+'</div><b>Total : '+ZS.money(agroCart.items.reduce((n,x)=>n+x.price*x.qty,0),'XOF')+'</b><button type="button" class="btn btn-gold" data-agro-order>Valider la commande →</button><button type="button" class="pc-add" data-agro-chat>💬 Contacter le fournisseur</button><button type="button" class="pc-clear" data-agro-clear>Vider</button></div>':'');
}
function marketHTML(hideEmpty){
 const ql=q.toLowerCase(),items=mktProducts.filter(p=>!ql||((p.title||'')+' '+(p.description||'')+' '+(p.commerce_stores?.store_name||'')+' '+(p.commerce_categories?.name||'')).toLowerCase().includes(ql));
 if(!items.length)return hideEmpty?'':'<section class="market-section"><h3>🛍️ Marketplace</h3><p class="pc-mut">Aucun produit Marketplace disponible pour le moment.</p></section>';
 return '<section class="market-section"><div class="market-heading"><div><span class="market-kicker">PÔLE MARKETPLACE</span><h3>Produits des boutiques partenaires</h3><p>Catalogues classés par catégorie.</p></div><span class="market-count">'+items.length+' produits</span></div>'+categoryGroups(items,p=>p.commerce_categories?.name||'Autres',p=>'<article class="market-product">'+(p.image_url?'<img loading="lazy" src="'+esc(p.image_url)+'" alt="">':'<div class="market-photo">🛍️</div>')+'<div class="market-product-body"><h4>'+esc(p.title)+'</h4><p>'+esc(p.description||'')+'</p><div class="market-owner">🏪 '+esc(p.commerce_stores?.store_name||'Boutique')+(p.commerce_stores?.city?' · '+esc(p.commerce_stores.city):'')+'</div><div class="market-buy"><b>'+ZS.money(p.price,p.currency||'XOF')+'</b><a class="btn btn-gold" href="marketplace.html?product='+encodeURIComponent(p.id)+'">＋ Ajouter au panier →</a> <a class="pc-add" style="text-decoration:none;display:inline-block" href="'+chatHref('store',p.store_id,'Question sur : '+p.title)+'">💬 Contacter</a></div></div></article>')+'</section>'}
async function loadMarket(){
 const c=window.ZUMAYA_CONFIG||{};if(!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)return;
 try{const r=await fetch(c.SUPABASE_URL+'/rest/v1/commerce_products?select=id,title,description,price,currency,image_url,stock_quantity,store_id,commerce_stores(store_name,city),commerce_categories(name)&status=eq.active&stock_quantity=gt.0&order=created_at.desc&limit=60',{headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:'Bearer '+c.SUPABASE_ANON_KEY}});
  if(!r.ok)return;mktProducts=await r.json();draw()}catch(_){}
}
async function loadOrgs(){
 const c=window.ZUMAYA_CONFIG||{};if(!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)return;
 try{const r=await fetch(c.SUPABASE_URL+'/rest/v1/rg_organizations?select=id,organization_type,public_name,city,address,latitude,longitude&organization_type=in.(restaurant,hotel,agro,agro_trader,delivery,delivery_service,logistics)&order=created_at.desc',{headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:'Bearer '+c.SUPABASE_ANON_KEY}});
  if(!r.ok)return;orgs=await r.json();draw()}catch(_){}
}
async function loadAgro(){
 const c=window.ZUMAYA_CONFIG||{};if(!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)return;
 try{
  const h={apikey:c.SUPABASE_ANON_KEY,Authorization:'Bearer '+c.SUPABASE_ANON_KEY};
  const [pr,profiles]=await Promise.all([
   fetch(c.SUPABASE_URL+'/rest/v1/rg_agro_products?select=id,owner_id,product_name,description,category,quantity,unit,price,photo_url,availability&availability=neq.unavailable&order=created_at.desc',{headers:h}),
   fetch(c.SUPABASE_URL+'/rest/v1/rg_agro_profiles?select=user_id,business_name,city,role,is_active&is_active=eq.true',{headers:h})
  ]);
  if(!pr.ok||!profiles.ok)return;
  const [ps,owners]=await Promise.all([pr.json(),profiles.json()]);const map=new Map(owners.map(x=>[x.user_id,x]));
  agroProducts=ps.filter(x=>map.has(x.owner_id)).map(x=>({...x,owner:map.get(x.owner_id)}));draw();
 }catch(_){}
}
function changeAgroQty(id,action){if(!agroCart)return;const x=agroCart.items.find(v=>v.id===id);if(!x)return;if(action==='+')x.qty++;else if(action==='-')x.qty--;else x.qty=0;agroCart.items=agroCart.items.filter(v=>v.qty>0);if(!agroCart.items.length)agroCart=null;writeAgroCart();draw()}
function addAgro(id){
 const w=ZS.portal();if(!w)return sayAgro('Connectez-vous à votre compte ZUMUYA pour ajouter des produits au panier.');
 const p=agroProducts.find(x=>x.id===id);if(!p)return;
 if(agroCart&&agroCart.owner_id!==p.owner_id){if(!confirm('Votre panier contient déjà des produits d’un autre fournisseur. Le vider pour continuer ?'))return;agroCart=null}
 if(!agroCart)agroCart={owner_id:p.owner_id,owner_name:p.owner.business_name||'Producteur',items:[]};
 const it=agroCart.items.find(x=>x.id===id);if(it)it.qty++;else agroCart.items.push({id:p.id,name:p.product_name,price:+p.price||0,unit:p.unit||'unité',qty:1});
 writeAgroCart();draw();
}
async function orderAgro(){
 if(!agroCart||!agroCart.items.length)return;
 const session=ZS.portal();if(!session)return sayAgro('Connectez-vous à votre compte ZUMUYA pour commander.');
 const address=prompt('Adresse complète de livraison (ville, quartier, repère) :');
 if(address===null)return;
 if(!address.trim())return sayAgro('Saisissez une adresse de livraison.');
 let auth=null;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null');auth=v&&(v.currentSession||v);if(auth&&auth.access_token)break}}}catch(e){}
 if(!auth||!auth.access_token)return sayAgro('Votre session a expiré. Reconnectez-vous.');
 const c=window.ZUMAYA_CONFIG||{};
 try{const r=await fetch(c.SUPABASE_URL+'/rest/v1/rpc/rg_supply_place_order',{method:'POST',headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_items:agroCart.items.map(x=>({product_id:x.id,quantity:x.qty})),p_org:null,p_address:address.trim(),p_note:null})});
  const t=await r.text();if(!r.ok)throw Error((()=>{try{return JSON.parse(t).message||t}catch(e){return t}})());
  agroCart=null;writeAgroCart();sayAgro('Commande agricole enregistrée. Retrouvez son suivi dans « Mes commandes ».');draw();
 }catch(e){sayAgro('Commande non envoyée : '+(e.message||'réessayez'))}
}
function sayAgro(t){let n=document.getElementById('pcToast');if(!n){n=document.createElement('div');n.id='pcToast';n.className='pc-toast';document.body.appendChild(n)}n.textContent=t;n.hidden=false;setTimeout(()=>n.hidden=true,6500)}
root.addEventListener('click',e=>{
 const a=e.target.closest('[data-agro-add]');if(a){addAgro(a.dataset.agroAdd);return}
 if(e.target.closest('[data-agro-clear]')){agroCart=null;writeAgroCart();draw();return}
 const aq=e.target.closest('[data-agro-qty]');if(aq){changeAgroQty(aq.dataset.id,aq.dataset.agroQty);return}
 const ar=e.target.closest('[data-agro-remove]');if(ar){changeAgroQty(ar.dataset.agroRemove,'remove');return}
 if(e.target.closest('[data-agro-order]')){orderAgro();return}
 if(e.target.closest('[data-agro-chat]')){
  if(!agroCart)return;const lines=agroCart.items.map(x=>x.name+' x'+x.qty+' ('+ZS.money(x.price*x.qty,'XOF')+')').join(', ');
  const profile=agroProducts.find(x=>x.owner_id===agroCart.owner_id)?.owner;
  const uid=agroCart.owner_id;if(uid){location.href='messagerie.html?to='+encodeURIComponent(uid)+'&subject='+encodeURIComponent('Commande - '+agroCart.owner_name+' : '+lines);return}
 }
});
async function locate(){try{pos=await ZS.locate();err=''}catch(e){err='Position indisponible : autorisez la localisation pour trier les restaurants et calculer les frais de livraison.'}ZC.setData(rests,pos);draw()}
async function load(){try{rests=(await ZS.rests()).filter(r=>ZS.subOk(r));err='';ZC.setData(rests,pos)}catch(e){err='Impossible de charger les restaurants. Vérifiez votre connexion.'}loading=false;draw()}
ZC.init({onChange:draw});draw();load();loadAgro();loadMarket();loadOrgs();setInterval(loadOrgs,120000);setInterval(load,60000);setInterval(loadAgro,120000);setInterval(loadMarket,120000);
})();
