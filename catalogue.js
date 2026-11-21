/* ZUMUYA GROUP — catalogue public des restaurants partenaires (accueil). Visible sans compte.
   Le panier (compte Client, un seul restaurant, commande + suivi) est géré par zcart.js. */
(()=>{'use strict';
const root=document.getElementById('pubCatalog');if(!root||!window.ZS)return;
const esc=ZS.esc,ZC=window.ZC||{ctl:()=>'',headBtn:()=>'',init(){},setData(){}};
let rests=[],pos=null,q='',sort='near',open={},err='',loading=true;
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
  '<span class="pc-b grey">'+(r.menu||[]).length+' plat'+((r.menu||[]).length>1?'s':'')+'</span></div></div>'+
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
  (loading?'<p class="empty">Chargement des restaurants…</p>':list.length?list.map(card).join(''):'<p class="empty">Aucun restaurant partenaire disponible pour le moment.</p>');
 const s=$('#pcSearch');s.oninput=e=>{q=e.target.value;draw()};if(keep!=null){s.focus();s.setSelectionRange(keep,keep)}
 $('#pcSort').onchange=e=>{sort=e.target.value;draw()};const l=$('#pcLoc');if(l)l.onclick=locate}

root.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){open[b.dataset.open]=1;draw()}});
async function locate(){try{pos=await ZS.locate();err=''}catch(e){err='Position indisponible : autorisez la localisation pour trier les restaurants et calculer les frais de livraison.'}ZC.setData(rests,pos);draw()}
async function load(){try{rests=(await ZS.rests()).filter(r=>ZS.subOk(r)&&!ZS.isHotel(r));err='';ZC.setData(rests,pos)}catch(e){err='Impossible de charger les restaurants. Vérifiez votre connexion.'}loading=false;draw()}
ZC.init({onChange:draw});draw();load();setInterval(load,60000);
})();
