/* ZUMUYA GROUP — « Mon équipe » : employés et livreurs d'un restaurant / hôtel.
   Les comptes sont créés UNIQUEMENT ici (Edge Function team-admin) : il n'existe plus d'inscription publique de livreur.
   Les droits réels sont contrôlés côté Supabase (11_equipes_livreurs_approvisionnement.sql) ; cette interface ne fait que les présenter.
   Usage : ZTeam.mount(element,{kind:'staff'|'driver',orgId,onChange}) · ZTeam.mountAudit(element,orgId) */
(()=>{'use strict';
const C=()=>window.ZUMAYA_CONFIG||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sess(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null'),s=v&&(v.currentSession||v);if(s&&s.access_token&&s.user)return s}}}catch(e){}return null}
const H=(extra)=>{const s=sess();return Object.assign({apikey:C().SUPABASE_ANON_KEY,Authorization:'Bearer '+(s?s.access_token:C().SUPABASE_ANON_KEY),'Content-Type':'application/json'},extra||{})};
async function rest(path){const r=await fetch(C().SUPABASE_URL+'/rest/v1/'+path,{headers:H()});if(!r.ok)throw new Error('Lecture impossible ('+r.status+')');return r.json()}
async function rpc(name,args){const r=await fetch(C().SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:H(),body:JSON.stringify(args||{})});
  if(!r.ok){let m='Erreur '+r.status;try{const j=await r.json();m=j.message||j.hint||m}catch(e){}throw new Error(m)}
  const t=await r.text();return t?JSON.parse(t):null}
async function fn(body){const r=await fetch(C().SUPABASE_URL+'/functions/v1/team-admin',{method:'POST',headers:H(),body:JSON.stringify(body)});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok||j.error)throw new Error(j.error||(r.status===404?'La fonction « team-admin » n’est pas encore déployée dans Supabase.':'Erreur '+r.status));return j}

/* Rubriques du restaurant que l'on peut accorder ou retirer à un employé */
const MODULES=[
 ['dash','Tableau de bord','⊞'],['pos','Caisse','🧮'],['orders','Commandes en ligne','🛒'],['menu','Menu et plats','🍴'],
 ['hist','Historique des ventes','🕐'],['report','Rapports','📈'],['drivers','Livreurs (attribution)','🚚'],
 ['supply','Approvisionnement agricole','🌾'],['finance','Finances / portefeuille','👛'],['settings','Paramètres du restaurant','⚙️'],['team','Gestion de l’équipe','👥']];
const PRESETS={
 'Responsable':['dash','pos','orders','menu','hist','report','drivers','supply','finance','settings'],
 'Caissier':['dash','pos','hist'],
 'Cuisinier':['orders','menu'],
 'Gestionnaire de stock':['menu','supply'],
 'Comptable':['report','hist','finance'],
 'Serveur':['orders','pos'],
 'Personnalisé':[]};
const STATUS={active:['Actif','#0b7d3f'],suspended:['Suspendu','#b26a00'],disabled:['Désactivé','#b3261e']};

function css(){if(document.getElementById('zt-css'))return;const s=document.createElement('style');s.id='zt-css';
 s.textContent=`.zt{display:grid;gap:12px}.zt *{box-sizing:border-box}.zt .ztc{background:#fff;border:1px solid #dfe5ec;border-radius:14px;padding:14px}
 .zt h3{margin:0 0 4px;font-size:1.05rem}.zt .m{color:#5b6b7a;font-size:.88rem}.zt label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
 .zt input,.zt select{width:100%;padding:11px 12px;border:1px solid #c9d2dc;border-radius:10px;font:inherit;background:#fff}
 .zt .g2{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:640px){.zt .g2{grid-template-columns:1fr 1fr}}
 .zt button{border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;background:#102b45;color:#fff}
 .zt button.s{background:#e8edf3;color:#102b45}.zt button.w{background:#b26a00}.zt button.d{background:#b3261e}.zt button:disabled{opacity:.5}
 .zt .perms{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}.zt .perms label{flex-direction:row;display:flex;gap:8px;align-items:center;font-weight:500;padding:8px 10px;border:1px solid #e3e8ee;border-radius:10px}
 .zt .perms input{width:auto}.zt .mem{display:grid;gap:8px}.zt .mh{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
 .zt .tag{display:inline-block;padding:2px 9px;border-radius:99px;font-size:.75rem;font-weight:800;color:#fff}.zt .row{display:flex;gap:8px;flex-wrap:wrap}
 .zt .ok{background:#e8f6ee;border:1px solid #9fd3b5;border-radius:12px;padding:12px}.zt .err{background:#fdecea;border:1px solid #f1aea8;border-radius:12px;padding:10px;color:#8a1c14}
 .zt code{background:#f1f4f8;padding:2px 6px;border-radius:6px;user-select:all}.zt table{width:100%;border-collapse:collapse;font-size:.86rem}.zt td,.zt th{padding:7px 6px;border-bottom:1px solid #eef1f5;text-align:left;vertical-align:top}`;
 document.head.appendChild(s)}

function permsHtml(sel,name){return '<div class="perms">'+MODULES.map(([k,l,i])=>`<label><input type="checkbox" name="${name}" value="${k}" ${sel.includes(k)?'checked':''}>${i} ${esc(l)}</label>`).join('')+'</div>'}
const checked=(root,name)=>[...root.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);

async function mount(el,opt){
 css();opt=opt||{};const kind=opt.kind==='driver'?'driver':'staff',orgId=opt.orgId;
 el.classList.add('zt');
 if(!orgId){el.innerHTML='<div class="ztc err">Votre établissement n’est pas encore enregistré sur le portail. Complétez d’abord votre fiche partenaire.</div>';return}
 const isDrv=kind==='driver';
 let members=[],error='',created=null,editing=null;
 async function load(){try{members=await rest('rg_team_members?select=*&org_id=eq.'+encodeURIComponent(orgId)+'&kind=eq.'+kind+'&order=created_at.desc');error=''}
   catch(e){members=[];error='Impossible de charger la liste. Le script 11_equipes_livreurs_approvisionnement.sql a-t-il été exécuté dans Supabase ?'}draw()}
 function draw(){
  el.innerHTML=
  `<div class="ztc"><h3>${isDrv?'🛵 Mes livreurs':'👥 Mon équipe'}</h3><p class="m">${isDrv
    ?'Les livreurs ne peuvent pas s’inscrire eux-mêmes : <b>seul votre restaurant crée leur compte</b>. Un livreur voit uniquement les courses de votre établissement.'
    :'Créez un compte par employé et choisissez précisément les rubriques auxquelles il a accès. Vous pouvez le suspendre à tout moment.'}</p></div>
  ${created?`<div class="ok"><b>✅ Compte créé</b><p class="m">Transmettez ces identifiants à ${esc(created.name)}. Le mot de passe ne sera plus affiché.</p>
    <p>E-mail : <code>${esc(created.email)}</code><br>Mot de passe : <code>${esc(created.password)}</code></p>
    <div class="row"><button class="s" data-a="copy">Copier</button><button class="s" data-a="closeCreated">Fermer</button></div></div>`:''}
  ${error?`<div class="err">${esc(error)}</div>`:''}
  <form class="ztc" id="ztNew"><h3>${isDrv?'Ajouter un livreur':'Ajouter un employé'}</h3><div class="g2">
    <label>Nom complet<input name="name" required maxlength="80" autocomplete="off"></label>
    <label>Adresse e-mail (identifiant de connexion)<input name="email" type="email" required autocomplete="off"></label>
    <label>Téléphone<input name="phone" type="tel" maxlength="30" placeholder="+227 …"></label>
    ${isDrv?`<label>Moyen de livraison<select name="vehicle"><option>Moto</option><option>Vélo</option><option>Voiture</option><option>Camionnette</option></select></label>`
      :`<label>Poste<select name="job">${Object.keys(PRESETS).map(k=>`<option>${esc(k)}</option>`).join('')}</select></label>`}
    <label>Mot de passe initial (facultatif)<input name="password" type="text" minlength="8" placeholder="Laissez vide : généré automatiquement" autocomplete="off"></label></div>
   ${isDrv?'':`<div><b class="m">Rubriques accessibles</b>${permsHtml(PRESETS['Responsable'].slice(0,0),'perm')}</div>`}
   <div class="row" style="margin-top:10px"><button type="submit" id="ztGo">Créer le compte</button></div><div id="ztMsg"></div></form>
  <div class="ztc"><h3>${isDrv?'Livreurs de mon restaurant':'Employés'} (${members.length})</h3><div class="mem">${members.length?members.map(card).join(''):`<p class="m">Aucun ${isDrv?'livreur':'employé'} pour le moment.</p>`}</div></div>`;
  bind()}
 function card(m){const st=STATUS[m.status]||[m.status,'#555'];
  const edit=editing===m.id;
  return `<div class="ztc mem" data-id="${esc(m.id)}"><div class="mh"><div><b>${esc(m.full_name)}</b> <span class="tag" style="background:${st[1]}">${st[0]}</span>
   <div class="m">${esc(m.job_title||m.vehicle||'')}${m.phone?' · '+esc(m.phone):''} · créé le ${new Date(m.created_at).toLocaleDateString('fr-FR')}</div></div>
   <div class="row">${m.status==='active'?`<button class="w" data-a="suspend">Suspendre</button>`:`<button data-a="activate">Réactiver</button>`}
   ${isDrv?'':`<button class="s" data-a="edit">${edit?'Fermer':'Autorisations'}</button>`}<button class="s" data-a="pwd">Nouveau mot de passe</button><button class="d" data-a="del">Supprimer</button></div></div>
   ${!isDrv&&!edit?`<div class="m">Accès : ${(m.permissions||[]).length?(m.permissions||[]).map(p=>esc((MODULES.find(x=>x[0]===p)||[0,p])[1])).join(' · '):'<i>aucune rubrique</i>'}</div>`:''}
   ${edit?`<div>${permsHtml(m.permissions||[],'eperm')}<div class="row" style="margin-top:8px"><button data-a="savePerms">Enregistrer les autorisations</button></div></div>`:''}</div>`}
 function msg(t,bad){const b=el.querySelector('#ztMsg');if(b)b.innerHTML=t?`<div class="${bad?'err':'ok'}" style="margin-top:8px">${esc(t)}</div>`:''}
 function bind(){
  const f=el.querySelector('#ztNew');
  if(!isDrv){const sel=f.querySelector('[name=job]');sel.addEventListener('change',()=>{const p=PRESETS[sel.value]||[];f.querySelectorAll('input[name=perm]').forEach(c=>c.checked=p.includes(c.value))});
    const p0=PRESETS[sel.value]||[];f.querySelectorAll('input[name=perm]').forEach(c=>c.checked=p0.includes(c.value))}
  f.addEventListener('submit',async e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(f).entries()),b=f.querySelector('#ztGo');b.disabled=true;msg('');
   try{const r=await fn({action:'create',kind,org_id:orgId,name:fd.name,email:fd.email,phone:fd.phone,password:fd.password,
        vehicle:fd.vehicle,job_title:fd.job,permissions:isDrv?[]:checked(f,'perm')});
      created={name:fd.name,email:r.email,password:r.password};
      if(opt.onCreated)try{opt.onCreated({member_id:r.member_id,user_id:r.user_id,name:fd.name,email:r.email,phone:fd.phone,vehicle:fd.vehicle,kind})}catch(x){}
      await load()}catch(err){msg(err.message,true)}finally{b.disabled=false}});
  el.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=b.dataset.a,card=b.closest('[data-id]'),id=card&&card.dataset.id,m=members.find(x=>x.id===id);
   try{
    if(a==='copy'){await navigator.clipboard.writeText('E-mail : '+created.email+'\nMot de passe : '+created.password);b.textContent='Copié ✓';return}
    if(a==='closeCreated'){created=null;return draw()}
    if(a==='edit'){editing=editing===id?null:id;return draw()}
    if(a==='savePerms'){await rpc('rg_team_update_member',{p_member:id,p_permissions:checked(card,'eperm')});editing=null;await load();return}
    if(a==='suspend'||a==='activate'){await fn({action:'set_status',member_id:id,status:a==='suspend'?'suspended':'active'});if(opt.onStatus)opt.onStatus(m,a==='suspend'?'suspended':'active');await load();return}
    if(a==='pwd'){if(!confirm('Générer un nouveau mot de passe pour '+m.full_name+' ?'))return;const r=await fn({action:'reset_password',member_id:id});created={name:m.full_name,email:'(identique)',password:r.password};draw();return}
    if(a==='del'){if(!confirm('Supprimer définitivement le compte de '+m.full_name+' ? Cette action est irréversible.'))return;await fn({action:'delete',member_id:id});if(opt.onDeleted)opt.onDeleted(m);await load()}
   }catch(err){error=err.message;draw()}};
 }
 await load()}

async function mountAudit(el,orgId){
 css();el.classList.add('zt');el.innerHTML='<div class="ztc"><h3>🧾 Journal des actions</h3><p class="m">Chargement…</p></div>';
 try{const [rows,mem]=await Promise.all([rest('rg_audit_log?select=*&org_id=eq.'+encodeURIComponent(orgId)+'&order=created_at.desc&limit=100'),
     rest('rg_team_members?select=user_id,full_name&org_id=eq.'+encodeURIComponent(orgId))]);
   const nm={};mem.forEach(x=>nm[x.user_id]=x.full_name);const s=sess();
   const L={'team.create':'Création de compte','team.update':'Modification d’autorisations','team.status':'Changement de statut','team.password_reset':'Mot de passe réinitialisé','team.delete':'Suppression de compte','supply.order':'Commande d’approvisionnement','supply.received':'Réception d’approvisionnement'};
   el.innerHTML=`<div class="ztc"><h3>🧾 Journal des actions</h3><p class="m">Les 100 dernières actions sensibles de votre équipe.</p>
    <div style="overflow:auto"><table><thead><tr><th>Date</th><th>Qui</th><th>Action</th><th>Détail</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('fr-FR')}</td><td>${esc(nm[r.actor_id]||(s&&r.actor_id===s.user.id?'Vous (compte principal)':'Compte principal'))}</td><td>${esc(L[r.action]||r.action)}</td><td class="m">${esc(Object.entries(r.details||{}).map(([k,v])=>k+' : '+(Array.isArray(v)?v.join(', '):v)).join(' · '))}</td></tr>`).join(''):'<tr><td colspan="4" class="m">Aucune action enregistrée.</td></tr>'}</tbody></table></div></div>`;
 }catch(e){el.innerHTML='<div class="ztc err">Journal indisponible (réservé au compte principal).</div>'}}

/* Enregistrer une action métier (menu, commande…) : jamais bloquant */
function log(orgId,action,target,details){if(!orgId||!sess())return;rpc('rg_audit',{p_org:orgId,p_action:action,p_target:target==null?null:String(target),p_details:details||{}}).catch(()=>{})}

window.ZTeam={mount,mountAudit,log,MODULES,rpc,rest};
})();
