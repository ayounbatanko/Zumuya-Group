(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let activeFilter='all',lastFocus=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderModules(){
 const q=$('#search').value.trim().toLocaleLowerCase('fr');
 const list=ZUMAYA_MODULES.filter(m=>(activeFilter==='all'||(activeFilter==='live'&&m.status==='live')||m.group===activeFilter)&&(!q||(m.name+' '+m.description+' '+m.label).toLocaleLowerCase('fr').includes(q)));
 $('#modules').innerHTML=list.length?list.map(m=>`<article class="module">
 <div class="module-top"><span class="module-icon">${m.icon}</span><span class="module-code">Pôle ${m.code}</span></div>
 <h3>${esc(m.name)}</h3><p>${esc(m.description)}</p>
 <div class="module-bottom"><span class="module-tag">${esc(m.label)}</span><span class="module-state ${m.status}">${m.status==='live'?'Disponible':'Bientôt disponible'}</span>
 <button type="button" data-module="${m.id}">En savoir plus</button></div></article>`).join(''):'<p class="empty">Aucun service ne correspond à votre recherche.</p>';
}
function openModal(m){
 lastFocus=document.activeElement;
 $('#modalIcon').textContent=m.icon;$('#modalCode').textContent='Pôle '+m.code+' · '+m.label;
 $('#modalTitle').textContent=m.name;$('#modalDescription').textContent=m.description;
 $('#modalNotice').textContent=m.note;$('#modalAction').href=m.href||'compte.html?mode=signup';$('#modalAction').textContent=m.href?'Ouvrir le service →':'Créer un compte →';$('#modalNotice').className='notice '+m.status;
 const modal=$('#moduleModal');modal.classList.add('open');modal.setAttribute('aria-hidden','false');
 modal.querySelector('.modal-x').focus();
}
function closeModal(){const modal=$('#moduleModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');if(lastFocus&&lastFocus.focus)lastFocus.focus()}
$('#filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;$$('#filters button').forEach(x=>x.classList.toggle('active',x===b));renderModules()});
$('#search').addEventListener('input',renderModules);
$('#modules').addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(b){const m=ZUMAYA_MODULES.find(x=>x.id===b.dataset.module);if(m)openModal(m)}});
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeModal()});
$('#moduleModal').addEventListener('click',e=>{if(e.target===$('#moduleModal'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('#menuBtn').addEventListener('click',()=>{const nav=$('#mainNav'),open=nav.classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',String(open))});
$$('#mainNav a').forEach(a=>a.addEventListener('click',()=>{$('#mainNav').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false')}));

/* Bouton « Connecté » : visible dès qu'un utilisateur est connecté (portail ou service). */
function applyAuth(){
 const w=window.ZS&&ZS.who(),login=$('#navLogin'),signup=document.querySelector('.nav-signup'),hero=$('#heroActions'),foot=$('#footLogin');
 if(w){
  login.textContent='Connecté';login.className='nav-connected';login.title=(w.name||w.email||'')+' — ouvrir mon compte';
  login.href=w.kind==='resto'?'resto-index.html':'compte.html';
  if(signup)signup.hidden=true;
  if(hero)hero.innerHTML='<a class="btn btn-gold" href="#services">Découvrir les services <span>→</span></a><a class="btn btn-glass" href="'+login.href+'">Mon compte</a>';
  document.querySelectorAll('.steps-cta,.cta .btn').forEach(e=>e.hidden=true);
  if(foot){foot.textContent='Mon compte';foot.href=login.href}
 }else{
  login.textContent='Se connecter';login.className='nav-login';login.href='compte.html';if(signup)signup.hidden=false;
 }
}
applyAuth();addEventListener('storage',applyAuth);addEventListener('pageshow',applyAuth);
$('#year').textContent=new Date().getFullYear();renderModules();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js?v=64').catch(()=>{});
})();
