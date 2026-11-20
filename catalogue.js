/* ZUMUYA GROUP — catalogue public des restaurants partenaires (accueil). Visible sans compte.
   Le panier (compte Client, un seul restaurant, commande + suivi) est géré par zcart.js. */
(()=>{'use strict';
const root=document.getElementById('pubCatalog');if(!root||!window.ZS)return;
const esc=ZS.esc,ZC=window.ZC||{ctl:()=>'',headBtn:()=>'',init(){},setData(){}};
let rests=[],pos=null,q='',sort='near',open={},err='',loading=true,agroProducts=[],agroCart=readAgroCart();
const $=s=>root.querySelector(s);
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
  '<span class="pc-b grey">'+(r.menu||[]).length+' plat'+((r.menu||[]).length>1?'s':'')+'</span><span class="pc-b '+(window.ZC?.isOpen?.(r)!==false?'':'closed')+'">'+(window.ZC?.isOpen?.(r)!==false?'● Ouvert':'● Fermé · ouvre '+(r.openAt||'08:00'))+'</span></div></div>'+
  ZC.headBtn(r.id)+'</div>'+
  (show.length?'<div class="pc-dishes">'+show.map(m=>dishCard(r,m.p,m.k,fee)).join('')+'</div>':'<p class="pc-mut" style="padding:14px 18px">'+(ql?'Aucun plat ne correspond.':'Catalogue bientôt disponible.')+'</p>')+
  (!all&&menu.length>4?'<button type="button" class="pc-more" data-open="'+esc(r.id)+'">Voir tout le catalogue ('+menu.length+' plats)</button>':'')+'</article>'}
function draw(){
 const ql=q.toLowerCase();let list=rests.map(r=>({r,d:pos&&r.lat!=null&&r.lng!=null?ZS.km(pos,[r.lat,r.lng]):null}));
 if(ql)list=list.filter(x=>(x.r.name||'').toLowerCase().includes(ql)||(x.r.menu||[]).some(p=>((p.n||'')+' '+(p.desc||'')).toLowerCase().includes(ql)));
 if(sort==='fee')list.sort((a,b)=>(ZS.fee(a.r,a.d)??1e12)-(ZS.fee(b.r,b.d)??1e12));else list.sort((a,b)=>(a.d??1e9)-(b.d??1e9));
 const keep=document.activeElement&&document.activeElement.id==='pcSearch'?document.activeElement.selectionStart:null;
 root.innerHTML='<div class="pc-bar"><input id="pcSearch" type="search" placeholder="Rechercher un restaurant ou un plat…" value="'+esc(q)+'" aria-label="Rechercher un restaurant ou un plat"><select id="pcSort" aria-label="Trier"><option value="near"'+(sort==='near'?' selected':'')+'>Les plus proches</option><option value="fee"'+(sort==='fee'?' selected':'')+'>Livraison la moins chère</option></select>'+(pos?'<span class="pc-b">📍 Position active</span>':'<button type="button" class="btn btn-gold" id="pcLoc">📍 Activer ma localisation</button>')+'</div>'+
  (err?'<div class="pc-err">'+esc(err)+'</div>':'')+
  (loading?'<p class="empty">Chargement des catalogues…</p>':list.length?list.map(card).join(''):'<p class="empty">Aucun restaurant ou hôtel partenaire disponible pour le moment.</p>')+agroHTML();
 const s=$('#pcSearch');s.oninput=e=>{q=e.target.value;draw()};if(keep!=null){s.focus();s.setSelectionRange(keep,keep)}
 $('#pcSort').onchange=e=>{sort=e.target.value;draw()};const l=$('#pcLoc');if(l)l.onclick=locate}

root.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){open[b.dataset.open]=1;draw()}});

function readAgroCart(){try{return JSON.parse(localStorage.getItem('zg_agro_cart')||'null')}catch(_){return null}}
function writeAgroCart(){try{localStorage.setItem('zg_agro_cart',JSON.stringify(agroCart))}catch(_){}}
function agroHTML(){
 const products=agroProducts.filter(p=>p.availability!=='unavailable'&&(!q||((p.product_name+' '+p.category+' '+(p.owner?.business_name||'')).toLowerCase().includes(q.toLowerCase()))));
 if(!products.length)return '<section class="market-section"><h3>🌾 Catalogue des producteurs agricoles</h3><p class="pc-mut">Aucun produit agricole public disponible pour le moment.</p></section>';
 return '<section class="market-section"><div class="market-heading"><div><span class="market-kicker">PÔLE AGRICOLE</span><h3>Produits des producteurs partenaires</h3><p>Choisissez les produits d’un seul fournisseur par panier.</p></div><span class="market-count">'+products.length+' produits</span></div><div class="market-grid">'+products.map(p=>{const owner=p.owner||{},qty=agroCart&&agroCart.owner_id===p.owner_id?((agroCart.items||[]).find(x=>x.id===p.id)?.qty||0):0;return '<article class="market-product">'+(p.photo_url?'<img loading="lazy" src="'+esc(p.photo_url)+'" alt="">':'<div class="market-photo">🌱</div>')+'<div class="market-product-body"><span class="market-kicker">'+esc(p.category||'PRODUIT AGRICOLE')+'</span><h4>'+esc(p.product_name)+'</h4><p>'+esc(p.description||'')+'</p><div class="market-owner">🏡 '+esc(owner.business_name||'Producteur partenaire')+' · '+esc(owner.city||'')+'</div><strong>'+ZS.money(p.price,'XOF')+' / '+esc(p.unit||'unité')+'</strong><button type="button" class="pc-add" data-agro-add="'+esc(p.id)+'">＋ Ajouter au panier'+(qty?' ('+qty+')':'')+'</button></div></article>'}).join('')+'</div></section>'+
 (agroCart?'<div class="market-cart"><b>🛒 Panier · '+esc(agroCart.owner_name)+'</b><span>'+agroCart.items.reduce((n,x)=>n+x.qty,0)+' article(s)</span><button type="button" class="btn btn-gold" data-agro-chat>Contacter le fournisseur et commander →</button><button type="button" class="pc-clear" data-agro-clear>Vider</button></div>':'');
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
function addAgro(id){
 const w=ZS.portal();if(!w)return sayAgro('Connectez-vous avec un compte Client pour ajouter des produits au panier.');
 if(w.type!=='customer')return sayAgro('Les achats sont réservés aux comptes Client.');
 const p=agroProducts.find(x=>x.id===id);if(!p)return;
 if(agroCart&&agroCart.owner_id!==p.owner_id){if(!confirm('Votre panier contient déjà des produits d’un autre fournisseur. Le vider pour continuer ?'))return;agroCart=null}
 if(!agroCart)agroCart={owner_id:p.owner_id,owner_name:p.owner.business_name||'Producteur',items:[]};
 const it=agroCart.items.find(x=>x.id===id);if(it)it.qty++;else agroCart.items.push({id:p.id,name:p.product_name,price:+p.price||0,unit:p.unit||'unité',qty:1});
 writeAgroCart();draw();
}
function sayAgro(t){let n=document.getElementById('pcToast');if(!n){n=document.createElement('div');n.id='pcToast';n.className='pc-toast';document.body.appendChild(n)}n.textContent=t;n.hidden=false;setTimeout(()=>n.hidden=true,6500)}
root.addEventListener('click',e=>{
 const a=e.target.closest('[data-agro-add]');if(a){addAgro(a.dataset.agroAdd);return}
 if(e.target.closest('[data-agro-clear]')){agroCart=null;writeAgroCart();draw();return}
 if(e.target.closest('[data-agro-chat]')){
  if(!agroCart)return;const lines=agroCart.items.map(x=>x.name+' x'+x.qty+' ('+ZS.money(x.price*x.qty,'XOF')+')').join(', ');
  const profile=agroProducts.find(x=>x.owner_id===agroCart.owner_id)?.owner;
  const uid=agroCart.owner_id;if(uid){location.href='messagerie.html?to='+encodeURIComponent(uid)+'&subject='+encodeURIComponent('Commande - '+agroCart.owner_name+' : '+lines);return}
 }
});
async function locate(){try{pos=await ZS.locate();err=''}catch(e){err='Position indisponible : autorisez la localisation pour trier les restaurants et calculer les frais de livraison.'}ZC.setData(rests,pos);draw()}
async function load(){try{rests=(await ZS.rests()).filter(r=>ZS.subOk(r));err='';ZC.setData(rests,pos)}catch(e){err='Impossible de charger les restaurants. Vérifiez votre connexion.'}loading=false;draw()}
ZC.init({onChange:draw});draw();load();loadAgro();setInterval(load,60000);setInterval(loadAgro,120000);
})();
