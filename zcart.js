/* ZUMUYA GROUP — panier du catalogue, partagé par l'accueil (catalogue.js) et la page Restauration.
   Règles : consultation libre ; ajout réservé aux comptes « Client » connectés ; un panier = un seul restaurant ;
   « Passer la commande » reprend le panier dans resto-client.html (adresse, paiement, frais de livraison) ; le suivi
   pas à pas se fait dans « Mes commandes ». Dépend de zsession.js (ZS). */
(()=>{'use strict';
if(!window.ZS)return;
const esc=ZS.esc,CK='zg_cart';
let cart=read(),rests=[],loaded=false,pos=null,onChange=()=>{};
function read(){try{const c=JSON.parse(localStorage.getItem(CK)||'null');return c&&c.rid&&Array.isArray(c.items)&&c.items.length?c:null}catch(e){return null}}
function write(){try{cart&&cart.items.length?localStorage.setItem(CK,JSON.stringify(cart)):localStorage.removeItem(CK)}catch(e){}if(cart&&!cart.items.length)cart=null}
const count=()=>cart?cart.items.reduce((a,i)=>a+i.q,0):0;
const sub=()=>cart?cart.items.reduce((a,i)=>a+i.p*i.q,0):0;
const restOf=id=>rests.find(r=>r.id===id);
const isClient=()=>{const w=ZS.portal();return !!w&&w.type==='customer'};
const $=id=>document.getElementById(id);

/* ---------- messages ---------- */
let toastT=0;
function say(html){let t=$('pcToast');if(!t){t=document.createElement('div');t.id='pcToast';t.className='pc-toast';t.setAttribute('role','status');document.body.appendChild(t)}
 t.innerHTML=html+'<button type="button" aria-label="Fermer" data-pc="toast-x">×</button>';t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},9000)}

/* ---------- état du panier ---------- */
/* Remet le panier en phase avec les menus actuels (prix modifiés, plat retiré, restaurant indisponible). */
function sync(){if(!cart||!loaded)return;const r=restOf(cart.rid);
 if(!r){say('Le restaurant « '+esc(cart.name)+' » n’est plus disponible : votre panier a été vidé.');cart=null;write();return}
 let changed=false;cart.cur=r.currency||cart.cur;
 cart.items=cart.items.filter(i=>{const p=(r.menu||[]).find(x=>x.n===i.n);if(!p){changed=true;return false}if((+p.p||0)!==i.p){i.p=+p.p||0;changed=true}return true});
 if(changed)say('Votre panier a été mis à jour : prix ou disponibilité modifiés par le restaurant.');write()}
function add(rid,i,d){
 const w=ZS.portal();
 if(!w){try{const pg=location.pathname.split('/').pop()||'index.html';localStorage.setItem('zg_back',pg+($('catalogue-public')?'#catalogue-public':'')+'|'+Date.now())}catch(e){}
  return say('Connectez-vous avec un compte <b>Client</b> pour ajouter des plats à votre panier. <a href="compte.html">Se connecter</a> · <a href="compte.html?mode=signup">Créer un compte</a>')}
 if(w.type!=='customer')return say('Les commandes en ligne sont réservées aux comptes <b>Client</b>. Votre compte est un compte professionnel : utilisez un compte Client pour commander.');
 const r=restOf(rid),p=r&&(r.menu||[])[i];if(!p)return;
 if(cart&&cart.rid!==rid){
  if(!confirm('Votre panier contient déjà des plats de « '+cart.name+' ».\nUn panier ne peut contenir que les plats d’un seul restaurant.\n\nLe vider et commencer avec « '+r.name+' » ?'))return;
  cart=null}
 if(!cart)cart={rid:r.id,slug:r.slug,name:r.name,cur:r.currency||'XOF',items:[]};
 const it=cart.items.find(x=>x.n===p.n);
 if(it)it.q=Math.min(99,it.q+d);else if(d>0)cart.items.push({n:p.n,p:+p.p||0,q:1});
 cart.items=cart.items.filter(x=>x.q>0);write();refresh()}
function checkout(){
 if(!isClient())return say('Connectez-vous avec un compte <b>Client</b> pour passer commande. <a href="compte.html">Se connecter</a>');
 if(!cart)return;try{localStorage.setItem('rg_target',cart.slug)}catch(e){}location.href='resto-client.html'}
function track(){try{localStorage.setItem('rg_tab','myorders')}catch(e){}location.href='resto-client.html'}

/* ---------- affichage ---------- */
/* Bouton « Ajouter » ou sélecteur de quantité d'un plat (rid = restaurant, i = rang du plat dans son menu). */
function ctl(rid,i,name){const n=cart&&cart.rid===rid?(cart.items.find(x=>x.n===name)||{q:0}).q:0,a='data-pc="add" data-r="'+esc(rid)+'" data-i="'+i+'"';
 return n?'<div class="pc-qty"><button type="button" '+a+' data-d="-1" aria-label="Retirer un">−</button><b>'+n+'</b><button type="button" '+a+' data-d="1" aria-label="Ajouter un">+</button></div>'
  :'<button type="button" class="pc-add" '+a+' data-d="1">＋ Ajouter</button>'}
/* Bouton d'en-tête de restaurant, visible seulement si le panier est celui de ce restaurant. */
const headBtn=rid=>cart&&cart.rid===rid?'<button type="button" class="btn btn-gold pc-order" data-pc="panel">🛒 Voir mon panier ('+count()+')</button>':'';
function dock(){let d=$('pcDock');
 if(!isClient()&&!cart){if(d)d.hidden=true;return}
 if(!d){d=document.createElement('div');d.id='pcDock';d.className='pc-dock';document.body.appendChild(d)}d.hidden=false;
 d.innerHTML=(cart?'<button type="button" class="pc-cart" data-pc="panel">🛒 <b>'+count()+'</b> · '+ZS.money(sub(),cart.cur)+' <span>Voir le panier</span></button>':'')+
  (isClient()?'<button type="button" class="pc-track" data-pc="track">📦 Suivre mes commandes</button>':'')}
function panel(){let p=$('pcPanel');if(!cart){if(p)p.hidden=true;return}
 if(!p){p=document.createElement('div');p.id='pcPanel';p.className='pc-panel';document.body.appendChild(p)}p.hidden=false;
 const r=restOf(cart.rid),d=r&&pos&&r.lat!=null&&r.lng!=null?ZS.km(pos,[r.lat,r.lng]):null,fee=r?ZS.fee(r,d):null,tot=sub();
 p.innerHTML='<div class="pc-box" role="dialog" aria-modal="true" aria-label="Mon panier"><div class="pc-ph2"><b>🛒 Mon panier</b><button type="button" data-pc="close" aria-label="Fermer">×</button></div>'+
  '<p class="pc-mut" style="margin:0 0 10px">Restaurant : <b>'+esc(cart.name)+'</b> — un panier ne contient que les plats d’un seul restaurant.</p>'+
  cart.items.map(it=>{const idx=r?(r.menu||[]).findIndex(x=>x.n===it.n):-1,a='data-pc="add" data-r="'+esc(cart.rid)+'" data-i="'+idx+'"';
   return '<div class="pc-line"><div class="pc-lg"><b>'+esc(it.n)+'</b><span class="pc-mut">'+ZS.money(it.p,cart.cur)+'</span></div><div class="pc-qty"><button type="button" '+a+' data-d="-1" aria-label="Retirer un">−</button><b>'+it.q+'</b><button type="button" '+a+' data-d="1" aria-label="Ajouter un">+</button></div><b class="pc-lt">'+ZS.money(it.p*it.q,cart.cur)+'</b></div>'}).join('')+
  '<div class="pc-tot"><span>Plats</span><b>'+ZS.money(tot,cart.cur)+'</b></div>'+
  '<div class="pc-tot"><span>Livraison</span><b>'+(fee!=null?ZS.money(fee,cart.cur):'calculée selon votre position')+'</b></div>'+
  (fee!=null?'<div class="pc-tot big"><span>Total estimé</span><b>'+ZS.money(tot+fee,cart.cur)+'</b></div>':'')+
  '<p class="pc-mut">À l’étape suivante : adresse, mode de paiement et frais de livraison exacts. Vous suivrez ensuite votre commande en direct.</p>'+
  '<div class="pc-act"><button type="button" class="pc-clear" data-pc="clear">Vider le panier</button><button type="button" class="btn btn-gold" data-pc="checkout">Passer la commande →</button></div></div>'}
function refresh(){onChange();dock();const p=$('pcPanel');if(p&&!p.hidden)panel()}

document.addEventListener('click',e=>{
 const b=e.target.closest('[data-pc]');
 if(!b){const p=$('pcPanel');if(p&&e.target===p)p.hidden=true;return}
 const a=b.dataset.pc;
 if(a==='add')add(b.dataset.r,+b.dataset.i,+b.dataset.d);
 else if(a==='panel')panel();
 else if(a==='close')$('pcPanel').hidden=true;
 else if(a==='clear'){if(confirm('Vider le panier ?')){cart=null;write();$('pcPanel').hidden=true;refresh()}}
 else if(a==='checkout')checkout();
 else if(a==='track')track();
 else if(a==='toast-x')$('pcToast').hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const p=$('pcPanel');if(p)p.hidden=true}});
addEventListener('storage',e=>{if(e.key===CK){cart=read();refresh()}});
addEventListener('pageshow',()=>{cart=read();refresh()});

window.ZC={
 /* onChange : fonction de la page qui redessine le catalogue après un changement de panier */
 init(o){onChange=(o&&o.onChange)||onChange;dock()},
 /* à appeler après chaque chargement des restaurants (et quand la position change) */
 setData(list,position){rests=list||[];pos=position||null;loaded=true;sync();dock();const p=$('pcPanel');if(p&&!p.hidden)panel()},
 ctl,headBtn,count
};
})();
