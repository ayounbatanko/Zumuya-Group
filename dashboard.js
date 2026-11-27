/* ZUMAYA GROUP — tableau de bord du compte unique : menu latéral, activités à configurer, activités configurées. */
(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* cats = catégories du formulaire partenaire ; orgs = types d'organisation qui rendent l'activité « configurée » ; page = espace de gestion ; browse = page publique du pôle */
const MODS=[
 {code:'social',ico:'🌐',title:'Réseau social',desc:'Publications, photos, vidéos et communauté ZUMUYA',cats:[],orgs:[],page:'reseau-social.html',browse:'reseau-social.html',def:'Mon profil social',social:true},
 {code:'marketplace',ico:'🛍️',title:'Marketplace',desc:'Boutique, produits et commandes',cats:['marketplace'],orgs:['marketplace','commerce'],page:'boutique.html',browse:'marketplace.html',def:'Ma boutique'},
 {code:'restaurant',ico:'🍽️',title:'Restauration',desc:'Restaurant, menus et commandes',cats:['restaurant'],orgs:['restaurant'],page:'zrh-portal.html?type=restaurant',browse:'zrestaurant-client.html',def:'Mon restaurant'},
 {code:'agro',ico:'🌱',title:'Agro',desc:'Producteurs, fournisseurs et acheteurs',cats:['agro','agro_trader'],orgs:['agro','agro_trader'],page:'agro.html',browse:'agro.html',def:'Mon activité agricole'},
 {code:'hotel',ico:'🏨',title:'Hôtel',desc:'Chambres et service en chambre',cats:['hotel'],orgs:['hotel'],page:'zrh-portal.html?type=hotel',browse:'hotel.html',def:'Mon hôtel'},
 {code:'delivery',ico:'🚚',title:'Livraison',desc:'Courses et suivi',cats:['delivery'],orgs:['delivery','delivery_service','logistics'],page:'livraison-entreprise.html',browse:'livraison.html',def:'Mon service de livraison'},
 {code:'prestations',ico:'🛠️',title:'Prestations',desc:'Services et rendez-vous',cats:[],orgs:['services'],page:'index.html#services',browse:'index.html#services',def:'Mes prestations',discover:true}
];
let sb=null,user=null,orgs=[],mods=[],busy=false;
const say=(t,good)=>{const m=$('#dashMsg');if(m){m.textContent=t||'';m.className=good?'good':''}};
function view(v){
  $('#vOverview').hidden=v!=='overview';$('#vConfig').hidden=v!=='config';const vw=$('#vWallet');if(vw)vw.hidden=v!=='wallet';const va=$('#vActivities');if(va)va.hidden=v!=='activities';
  $$('#dash .dside [data-view]').forEach(a=>a.classList.toggle('on',a.dataset.view===v||(v==='config'&&a.dataset.view==='activities')));
  closeSide();window.scrollTo({top:0});
}
function openSide(){$('#dSide').classList.add('open');$('#dScrim').classList.add('open')}
function closeSide(){$('#dSide').classList.remove('open');$('#dScrim').classList.remove('open')}
function status(m){
  const o=orgs.find(x=>m.orgs.includes(x.organization_type));
  const row=mods.find(x=>x.module_code===m.code&&x.status!=='paused'&&x.status!=='suspended');
  if(o){
    /* Activation immédiate : aucune validation par un tiers. Seule une suspension décidée par la plateforme est signalée. */
    const sus=o.verification_status==='suspended';
    return{on:true,name:o.public_name||o.legal_name||m.def,cls:sus?'bad':'ok',label:sus?'Suspendu':'Activé',ico:sus?'!':'✔',manage:true};
  }
  if(row)return{on:true,name:m.def,cls:'warn',label:'Activé',ico:'✔',manage:!!m.social};
  return{on:false};
}
function renderCards(){
  const q=($('#dSearch').value||'').trim().toLowerCase();
  const list=MODS.filter(m=>!q||(m.title+' '+m.desc).toLowerCase().includes(q));
  $('#dCards').innerHTML=list.map(m=>{
    const s=status(m);let btn;
    if(m.discover)btn=`<a class="dbtn" href="${m.browse}">Découvrir →</a>`;
    else if(m.openOnly)btn=`<a class="dbtn gold" href="${m.page}">Ouvrir →</a>`;
    else if(s.on&&s.manage)btn=`<a class="dbtn gold" href="${m.page}">Ouvrir →</a>`;
    else btn=`<button type="button" class="dbtn" data-conf="${m.code}">Configurer →</button>`;
    return `<article class="dcard${s.on?' is-'+s.cls:''}${s.on&&s.manage?' go':''}"${s.on&&s.manage?` data-go="${m.page}" tabindex="0" role="link" aria-label="Ouvrir ${esc(m.title)}"`:''}><div class="ico" aria-hidden="true">${m.ico}</div><div><h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p>${s.on?`<span class="pill ${s.cls} dstate">${s.ico} ${esc(s.label)}</span>`:''}${btn}</div>${s.on?`<span class="dtick ${s.cls}" aria-hidden="true">${s.ico}</span>`:''}</article>`}).join('')||'<p class="dempty" style="grid-column:1/-1">Aucune activité ne correspond à votre recherche.</p>';
}
function renderList(){
  const rows=MODS.map(m=>({m,s:status(m)})).filter(x=>x.s.on);
  $('#dList').innerHTML=rows.length?rows.map(({m,s})=>`<div class="drow${s.manage?' go':''}"${s.manage?` data-go="${m.page}" tabindex="0" role="link"`:''}><span class="ico" aria-hidden="true">${m.ico}</span><span class="nm">${esc(s.name)}</span><span class="pill ${s.cls}">${s.ico} ${esc(s.label)}</span>${s.manage?`<a class="dbtn line" href="${m.page}">⚙ Gérer</a>`:`<button type="button" class="dbtn line" data-conf="${m.code}">⚙ Gérer</button>`}</div>`).join(''):'<p class="dempty">Aucune activité configurée pour le moment. Choisissez un pôle ci-dessus et cliquez sur « Configurer ».</p>';
  const todo=rows.filter(x=>x.s.cls!=='ok').length;
  const b=$('#dBell');b.querySelector('i').textContent=todo;b.querySelector('i').hidden=!todo;
}
async function load(){
  try{const r=await sb.from('rg_organizations').select('id,organization_type,public_name,legal_name,verification_status').eq('owner_id',user.id);orgs=r.data||[]}catch(e){orgs=[]}
  try{const r=await sb.from('rg_user_modules').select('module_code,status').eq('user_id',user.id);mods=r.data||[]}catch(e){mods=[]}
  renderCards();renderList();
}
async function configure(code){
  const m=MODS.find(x=>x.code===code);if(!m||busy)return;
  busy=true;say('');
  try{
    if(m.social){const r=await sb.rpc('rg_ecosystem_set_module',{p_module:'social',p_org:null,p_configuration:{},p_status:'active'});if(r.error)throw r.error;await load();say('Pôle Réseau social activé pour votre compte.',true);return;}
    /* Ouvrir d'abord la configuration : la création de l'organisation enregistre ensuite le pôle.
       La synchronisation SQL de l'écosystème est non bloquante dans compte.js. */
    if(!window.ZPARTNER)throw new Error('Le formulaire de configuration n’est pas chargé. Actualisez la page.');
    view('config');
    await window.ZPARTNER.open(m.cats);
  }catch(e){say(e.message||'Configuration impossible pour le moment.')}
  finally{busy=false}
}
function mount(){
  const slot=$('#dPartnerSlot'),p=$('#partnerPanel');
  if(slot&&p&&p.parentNode!==slot){slot.appendChild(p)}
  if(p)p.hidden=false;
}
async function loadPersonalStats(){
 const root=$('#personalStats');if(!root||!sb||!user)return;
 const all=[];const now=new Date();const since=new Date(now);since.setDate(since.getDate()-6);since.setHours(0,0,0,0);
 const push=(kind,status,amount,date)=>{const d=date?new Date(date):now;if(!Number.isFinite(d.getTime()))return;all.push({kind,status:String(status||'en cours').toLowerCase(),amount:Number(amount)||0,date:d})};
 try{
  const D=window.RGDB;if(D&&typeof D.get==='function'){const d=D.get();(d.orders||[]).filter(o=>o.clientAuthId===user.id||o.buyerAuthId===user.id||o.customerAuthId===user.id).forEach(o=>push('Restaurant',o.status,o.total,o.created||o.date))}
 }catch(e){}
 try{const r=await sb.from('commerce_orders').select('id,status,subtotal,delivery_fee,created_at').eq('buyer_id',user.id).order('created_at',{ascending:false}).limit(200);(r.data||[]).forEach(o=>push('Marketplace',o.status,(+o.subtotal||0)+(+o.delivery_fee||0),o.created_at))}catch(e){}
 try{const r=await sb.from('rg_supply_orders').select('id,status,total,created_at').or('buyer_user_id.eq.'+user.id+',placed_by.eq.'+user.id).order('created_at',{ascending:false}).limit(200);(r.data||[]).forEach(o=>push('Agro',o.status,o.total,o.created_at))}catch(e){}
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,''),successful=s=>/^(terminee|livree|received|delivered|completed|paid|payment_received)$/.test(norm(s)),terminal=s=>successful(s)||/^(annulee|refusee|cancelled|canceled|rejected)$/.test(norm(s)),pending=all.filter(o=>!terminal(o.status)).length,completed=all.filter(o=>successful(o.status)).length,total=all.filter(o=>successful(o.status)).reduce((n,o)=>n+o.amount,0);
 const fmt=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(n)+' FCFA';
 $('#psTotal').textContent=all.length;$('#psPending').textContent=pending;$('#psDone').textContent=completed;$('#psAmount').textContent=fmt(total);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(since);d.setDate(since.getDate()+i);return d});
 const counts=days.map(d=>all.filter(o=>o.date.toDateString()===d.toDateString()).length),mx=Math.max(1,...counts);
 $('#psBars').innerHTML='<div class="ps-bars">'+days.map((d,i)=>'<div class="ps-bar"><b>'+counts[i]+'</b><i style="height:'+Math.max(4,counts[i]/mx*76)+'px"></i><small>'+d.toLocaleDateString("fr-FR",{weekday:"short"})+'</small></div>').join('')+'</div>';
}
function init(){
  $$('#dash [data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();view(a.dataset.view)}));
  $('#dBurger').addEventListener('click',()=>$('#dSide').classList.contains('open')?closeSide():openSide());
  $('#dScrim').addEventListener('click',closeSide);
  $('#dSearch').addEventListener('input',()=>{view('overview');renderCards()});
  $('#dAcc').addEventListener('click',e=>{e.stopPropagation();$('#dMenu').classList.toggle('open')});
  document.addEventListener('click',()=>$('#dMenu').classList.remove('open'));
  $('#dash').addEventListener('click',e=>{const b=e.target.closest('[data-conf]');if(b)configure(b.dataset.conf)});
  const go=e=>{if(e.target.closest('a,button'))return;const c=e.target.closest('[data-go]');if(c&&/^[a-z0-9._-]+\.html(?:\?[^#]*)?(?:#[\w-]*)?$/i.test(c.dataset.go))location.href=c.dataset.go};
  $('#dash').addEventListener('click',go);
  $('#dash').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-go]')&&!e.target.closest('a,button')){e.preventDefault();go(e)}});
  $('#dLogout').addEventListener('click',()=>{const l=document.getElementById('logout');if(l)l.click()});
  $('#dBack').addEventListener('click',()=>{if(window.ZPARTNER)window.ZPARTNER.close();view('overview')});
  document.addEventListener('zumaya:activity',async()=>{await load();view('overview');say('Activité enregistrée. Elle apparaît dans « Mes activités configurées ».',true)});
}
let inited=false;
window.ZDASH={
  show(client,u){
    sb=client;user=u;if(!inited){init();inited=true}
    const md=u.user_metadata||{},name=(md.name||u.email||'Mon compte').trim();
    $('#dAv').textContent=name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'Z';
    $('#dWho').innerHTML='<b>'+esc(name)+'</b>'+esc(u.email||u.phone||'');
    mount();say('');
    document.body.classList.add('dash-on');$('#dash').hidden=false;$('#account').hidden=true;
    view('overview');load();loadPersonalStats();
    if(window.RGWalletLoad)window.RGWalletLoad();
  },
  hide(){document.body.classList.remove('dash-on');const d=$('#dash');if(d)d.hidden=true}
};
})();
