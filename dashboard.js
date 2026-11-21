/* ZUMAYA GROUP — tableau de bord du compte unique : menu latéral, activités à configurer, activités configurées. */
(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* cats = catégories du formulaire partenaire ; orgs = types d'organisation qui rendent l'activité « configurée » ; page = espace de gestion ; browse = page publique du pôle */
const MODS=[
 {code:'marketplace',ico:'🛍️',title:'Marketplace',desc:'Boutique, produits et commandes',cats:['marketplace'],orgs:['marketplace','commerce'],page:'marketplace.html',browse:'marketplace.html',def:'Ma boutique'},
 {code:'restauration',ico:'🍽️',title:'Restauration',desc:'Restaurant, menus et commandes',cats:['restaurant'],orgs:['restaurant'],page:'resto-restaurant.html',browse:'resto-client.html',def:'Mon restaurant'},
 {code:'agro',ico:'🌱',title:'Agro',desc:'Producteurs, fournisseurs et acheteurs',cats:['agro','agro_trader'],orgs:['agro','agro_trader'],page:'agro.html',browse:'agro.html',def:'Mon activité agricole'},
 {code:'hotel',ico:'🏨',title:'Hôtel',desc:'Chambres et service en chambre',cats:['hotel'],orgs:['hotel'],page:'resto-restaurant.html',browse:'hotel.html',def:'Mon hôtel'},
 {code:'livraison',ico:'🚚',title:'Livraison',desc:'Courses et suivi',cats:['delivery'],orgs:['delivery','delivery_service'],page:'livraison.html',browse:'livraison.html',def:'Mon service de livraison',openOnly:true},
 {code:'prestations',ico:'🛠️',title:'Prestations',desc:'Services et rendez-vous',cats:[],orgs:['services'],page:'index.html#services',browse:'index.html#services',def:'Mes prestations',discover:true}
];
let sb=null,user=null,orgs=[],mods=[],busy=false;
const say=(t,good)=>{const m=$('#dashMsg');if(m){m.textContent=t||'';m.className=good?'good':''}};
function view(v){
  $('#vOverview').hidden=v!=='overview';$('#vConfig').hidden=v!=='config';
  $$('#dash .dside [data-view]').forEach(a=>a.classList.toggle('on',a.dataset.view===v||(v==='config'&&a.dataset.view==='activities')));
  closeSide();window.scrollTo({top:0});
}
function openSide(){$('#dSide').classList.add('open');$('#dScrim').classList.add('open')}
function closeSide(){$('#dSide').classList.remove('open');$('#dScrim').classList.remove('open')}
function status(m){
  const o=orgs.find(x=>m.orgs.includes(x.organization_type));
  const row=mods.find(x=>x.module_code===m.code&&x.status!=='paused'&&x.status!=='suspended');
  if(o){
    const v=o.verification_status;
    return{on:true,name:o.public_name||o.legal_name||m.def,cls:v==='pending'?'warn':v==='rejected'?'bad':'ok',label:v==='pending'?'En validation':v==='rejected'?'Refusée':'Active',ico:v==='pending'?'⏳':v==='rejected'?'!':'✔',manage:true};
  }
  if(row)return{on:true,name:m.def,cls:'warn',label:'Informations à compléter',ico:'!',manage:false};
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
    return `<article class="dcard"><div class="ico" aria-hidden="true">${m.ico}</div><div><h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p>${btn}</div></article>`}).join('')||'<p class="dempty" style="grid-column:1/-1">Aucune activité ne correspond à votre recherche.</p>';
}
function renderList(){
  const rows=MODS.map(m=>({m,s:status(m)})).filter(x=>x.s.on);
  $('#dList').innerHTML=rows.length?rows.map(({m,s})=>`<div class="drow"><span class="ico" aria-hidden="true">${m.ico}</span><span class="nm">${esc(s.name)}</span><span class="pill ${s.cls}">${s.ico} ${esc(s.label)}</span>${s.manage?`<a class="dbtn line" href="${m.page}">⚙ Gérer</a>`:`<button type="button" class="dbtn line" data-conf="${m.code}">⚙ Gérer</button>`}</div>`).join(''):'<p class="dempty">Aucune activité configurée pour le moment. Choisissez un pôle ci-dessus et cliquez sur « Configurer ».</p>';
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
    /* activation du pôle sur le compte (sans effet bloquant si la table n'est pas accessible) */
    const ex=mods.find(x=>x.module_code===code);
    try{if(ex)await sb.from('rg_user_modules').update({status:'active'}).eq('user_id',user.id).eq('module_code',code);
        else await sb.from('rg_user_modules').insert({user_id:user.id,module_code:code,status:'active',configuration:{}})}catch(e){}
    if(!window.ZPARTNER)throw new Error('Le formulaire n’est pas disponible.');
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
function init(){
  $$('#dash [data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();view(a.dataset.view)}));
  $('#dBurger').addEventListener('click',()=>$('#dSide').classList.contains('open')?closeSide():openSide());
  $('#dScrim').addEventListener('click',closeSide);
  $('#dSearch').addEventListener('input',()=>{view('overview');renderCards()});
  $('#dAcc').addEventListener('click',e=>{e.stopPropagation();$('#dMenu').classList.toggle('open')});
  document.addEventListener('click',()=>$('#dMenu').classList.remove('open'));
  $('#dash').addEventListener('click',e=>{const b=e.target.closest('[data-conf]');if(b)configure(b.dataset.conf)});
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
    view('overview');load();
  },
  hide(){document.body.classList.remove('dash-on');const d=$('#dash');if(d)d.hidden=true}
};
})();
