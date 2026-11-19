(()=>{'use strict';
const $=s=>document.querySelector(s);
let sb=null,mode='in';
const ROLE_TYPES=['restaurant','hotel','delivery','agro_producer','agro_trader','commerce','business'];
const roleToPartner={restaurant:'restaurant',hotel:'hotel',delivery:'delivery',agro_producer:'agro',agro_trader:'agro_trader',commerce:'commerce',business:'business'};
/* E-mail UNIQUEMENT pour toutes les catégories. */
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LABEL={customer:'Client',restaurant:'Restaurant partenaire',hotel:'Hôtel / hébergement',delivery:'Livreur',agro_producer:'Producteur agricole',agro_trader:'Commerçant agricole'};
function updateIdentityFields(){$('#email').required=true}
const MIN=8;

function showMsg(text,type='error'){const m=$('#msg');m.textContent=text;m.className='msg '+type;m.hidden=!text}
function setMode(m,init){
  mode=m;const up=m==='up';
  $('#tabIn').classList.toggle('active',!up);$('#tabUp').classList.toggle('active',up);
  $('#tabIn').setAttribute('aria-selected',String(!up));$('#tabUp').setAttribute('aria-selected',String(up));
  $('#nameWrap').hidden=!up;$('#confirmWrap').hidden=!up;$('#pwHelp').hidden=!up;
  $('#accountCategory').disabled=false;updateIdentityFields();
  $('#displayName').required=up;$('#passwordConfirm').required=up;
  $('#password').autocomplete=up?'new-password':'current-password';
  $('#submitBtn').textContent=up?'Créer mon compte':'Se connecter';
  $('#authTitle').textContent=up?'Créer un compte':'Bienvenue';
  $('#authLead').textContent=up?'Renseignez vos informations pour rejoindre ZUMUYA GROUP.':'Connectez-vous à votre compte ZUMUYA GROUP.';
  $('#switchText').innerHTML=up?'Vous avez déjà un compte ? <button type="button" class="link" data-mode="in">Se connecter</button>':'Pas encore de compte ? <button type="button" class="link" data-mode="up">Créer un compte</button>';
  $('#password').value='';$('#passwordConfirm').value='';updateMatch();showMsg('');
  if(!init)history.replaceState(null,'',up?'?mode=signup':location.pathname);
}
function updateMatch(){
  const h=$('#matchHelp'),a=$('#password').value,b=$('#passwordConfirm').value;
  h.className='';h.textContent='';$('#passwordConfirm').removeAttribute('aria-invalid');
  if(mode!=='up'||!b)return;
  if(a===b){h.textContent='Les mots de passe correspondent.';h.className='good'}
  else{h.textContent='Les deux mots de passe ne sont pas identiques.';h.className='bad';$('#passwordConfirm').setAttribute('aria-invalid','true')}
}
async function showAccount(user){
  const type=user.user_metadata?.account_type;
  const routes={customer:'client-espace.html',restaurant:'resto-restaurant.html',hotel:'resto-restaurant.html',delivery:'resto-driver.html',agro_producer:'agro.html',agro_trader:'agro.html'};
  const stay=/parametres|stay/.test(location.hash);
  let owner=false;try{const {data}=await sb.rpc('rg_is_platform_owner');owner=data===true}catch(e){}
  if(owner&&!stay&&!sessionStorage.getItem('zumuya_redirected')){sessionStorage.setItem('zumuya_redirected','1');location.replace('proprietaire.html');return}
  if(!owner&&type&&routes[type]&&!stay&&(type==='customer'||user.user_metadata?.organization_id)&&!sessionStorage.getItem('zumuya_redirected')){sessionStorage.setItem('zumuya_redirected','1');if(type==='restaurant'||type==='hotel')sessionStorage.setItem('zmy_portal','1');location.replace(routes[type]);return}
  sessionStorage.removeItem('zumuya_redirected');
  $('#auth').hidden=true;$('#account').hidden=false;$('#recovery').hidden=true;
  $('#accPhone').textContent=user.email||'—';
  $('#accName').textContent=(user.user_metadata&&user.user_metadata.name)||'—';
  const rt=routes[type],ready=rt&&(type==='customer'||user.user_metadata?.organization_id);
  const sp=$('#mySpace');sp.hidden=owner||!ready;if(ready)sp.href=rt;
  $('#clientOrder').hidden=owner||type!=='customer';
  $('#ownerLink').hidden=!owner;$('#ownerResto').hidden=!owner;$('#ownerNotice').hidden=!owner;
  const lead=$('#roleLead');
  if(owner){lead.hidden=true}
  else if(type==='customer'){lead.hidden=false;lead.textContent='Compte client : consultez les restaurants proches, leurs menus, et passez commande depuis votre espace.'}
  else if(type&&!ready){lead.hidden=false;lead.textContent='Compte '+(LABEL[type]||'professionnel')+' : complétez la fiche de votre activité ci-dessous (« Devenir partenaire ») pour ouvrir votre espace.'}
  else{lead.hidden=true}
  $('#partnerPanel').hidden=owner;
  initPartner(user);
}
function showAuth(){$('#account').hidden=true;$('#recovery').hidden=true;$('#auth').hidden=false}

async function submit(e){
  e.preventDefault();showMsg('');
  const password=$('#password').value,name=$('#displayName').value.trim(),confirm=$('#passwordConfirm').value;
  const email=$('#email').value.trim().toLowerCase(),accountType=$('#accountCategory').value;
  if(!EMAIL_RE.test(email))return showMsg('Saisissez une adresse e-mail valide.');
  if(mode==='up'){
    if(!name)return showMsg('Saisissez votre nom complet.');
    if(password.length<MIN)return showMsg('Le mot de passe doit contenir au moins '+MIN+' caractères.');
    if(password!==confirm){updateMatch();return showMsg('Les deux saisies du mot de passe ne sont pas identiques.')}
  }else if(!password)return showMsg('Saisissez votre mot de passe.');
  if(!sb)return showMsg('Le service de connexion n’est pas configuré. Vérifiez le fichier config.js.');
  const btn=$('#submitBtn');btn.disabled=true;
  try{
    if(mode==='up'){
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{name,account_type:accountType,requested_account_type:accountType},emailRedirectTo:location.origin+location.pathname}});
      if(error)throw error;
      if(data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0)throw new Error('Un compte existe déjà avec cette adresse e-mail. Connectez-vous.');
      $('#password').value='';$('#passwordConfirm').value='';updateMatch();
      if(data.session){await showAccount(data.session.user);return}
      showMsg('Compte créé. Ouvrez le lien de confirmation reçu par e-mail (pensez aux courriers indésirables), puis connectez-vous.','success');
    }else{
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error)throw error;
      await showAccount(data.user);
    }
  }catch(err){showMsg(translate(err))}
  finally{btn.disabled=false}
}
function translate(err){
  const m=(err&&err.message)||'';
  if(/Invalid login credentials/i.test(m))return 'Adresse e-mail ou mot de passe incorrect.';
  if(/Email not confirmed/i.test(m))return 'Confirmez d’abord votre adresse e-mail grâce au lien reçu dans votre boîte de réception.';
  if(/already registered|already been registered/i.test(m))return 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous.';
  if(/rate limit|too many|security purposes/i.test(m))return 'Trop de tentatives ou d’e-mails envoyés. Patientez quelques minutes puis réessayez.';
  if(/Password should be|weak/i.test(m))return 'Mot de passe trop faible. Utilisez au moins 8 caractères.';
  if(/fetch|network/i.test(m))return 'Connexion impossible. Vérifiez votre accès Internet.';
  return m||'Une erreur est survenue. Réessayez.';
}


/* ===== Demande d'adhésion partenaire ===== */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const F=(name,label,type='text',req=true,opts=null,full=false)=>({name,label,type,req,opts,full});
const CATS=[
 {id:'restaurant',icon:'🍽️',label:'Restaurant',desc:'Restaurants, maquis, fast-foods',fields:[F('organization_name','Nom du restaurant'),F('city','Ville'),F('address','Adresse',"text",false),F('cuisine','Type de cuisine'),F('seats','Nombre de places','number',false),F('registration','N° d’immatriculation (RCCM / NIF)','text',false)]},
 {id:'hotel',icon:'🏨',label:'Hôtel',desc:'Hôtels, auberges, résidences',fields:[F('organization_name','Nom de l’établissement'),F('city','Ville'),F('address','Adresse','text',false),F('hotel_type','Type d’hébergement','select',true,['Hôtel','Auberge','Résidence meublée','Maison d’hôtes']),F('rooms','Nombre de chambres','number'),F('registration','N° d’immatriculation (RCCM / NIF)','text',false)]},
 {id:'delivery',icon:'📦',label:'Livreur',desc:'Livreurs indépendants ou sociétés de livraison',fields:[F('organization_name','Nom complet ou de la société'),F('city','Ville'),F('zone','Zone de livraison'),F('vehicle','Moyen de livraison','select',true,['Moto','Vélo','Voiture','Camionnette','Camion']),F('availability','Disponibilité','select',true,['Temps plein','Temps partiel','Week-end uniquement']),F('experience','Années d’expérience','number',false)]},
 {id:'commerce',icon:'🏪',label:'Boutique / commerce',desc:'Boutiques, magasins, grossistes',fields:[F('organization_name','Nom de la boutique'),F('city','Ville'),F('address','Adresse','text',false),F('products','Produits vendus'),F('outlets','Nombre de points de vente','number',false),F('registration','N° d’immatriculation (RCCM / NIF)','text',false)]},
 {id:'transport',icon:'🚕',label:'Transport',desc:'Chauffeurs, taxis, transporteurs',fields:[F('organization_name','Nom complet ou de la société'),F('city','Ville'),F('vehicle','Type de véhicule','select',true,['Taxi','Moto-taxi','Minibus','Bus','Camion']),F('capacity','Capacité (places ou tonnage)'),F('experience','Années d’expérience','number',false)]},
 {id:'services',icon:'🧰',label:'Prestataire de services',desc:'Artisans, techniciens, indépendants',fields:[F('organization_name','Nom ou raison sociale'),F('city','Ville'),F('trade','Métier / type de prestation'),F('experience','Années d’expérience','number',false),F('description','Décrivez vos prestations','textarea',true,null,true)]},
 {id:'events',icon:'🎟️',label:'Événements',desc:'Organisateurs, salles, billetterie',fields:[F('organization_name','Nom de la structure'),F('city','Ville'),F('event_types','Types d’événements'),F('capacity','Capacité maximale (personnes)','number',false)]},
 {id:'agro',icon:'🌾',label:'Producteur agricole',desc:'Producteurs et coopératives agricoles',fields:[F('organization_name','Nom du producteur ou de la coopérative'),F('city','Localité'),F('address','Adresse / quartier'),F('crops','Cultures / produits'),F('volume','Volume annuel estimé (ex. 20 tonnes)','text',false),F('members','Nombre de membres','number',false)]},
 {id:'agro_trader',icon:'🧺',label:'Commerçant agricole',desc:'Vendeurs, grossistes et détaillants de produits agricoles',fields:[F('organization_name','Nom du commerce'),F('city','Localité'),F('address','Adresse / quartier'),F('products','Produits agricoles vendus'),F('market','Marché / zone de vente','text',false)]},
 {id:'travel',icon:'🧭',label:'Tourisme & voyages',desc:'Agences, guides, hébergements touristiques',fields:[F('organization_name','Nom de l’agence ou du guide'),F('city','Ville'),F('offer_type','Type d’offre','select',true,['Agence de voyages','Guide','Hébergement touristique','Excursions']),F('destinations','Destinations proposées')]},
 {id:'business',icon:'📊',label:'Entreprise / institution',desc:'Entreprises, institutions, partenaires techniques',fields:[F('organization_name','Nom de l’entreprise ou de l’institution'),F('city','Ville'),F('partner_kind','Type de partenariat','select',true,['Commercial','Institutionnel','Technique','Paiement']),F('website','Site web','url',false)]}
];
const LIVE=['restaurant','hotel','delivery','agro','agro_trader'];
CATS.splice(0,CATS.length,...CATS.filter(c=>LIVE.includes(c.id)));
const COLS=['organization_name','city'];
const STATUS={pending:'En attente',approved:'Acceptée',rejected:'Refusée'};
let apps=[],countries=[['NE','Niger']],currentCat=null,currentUser=null;

function pShow(t,type='error'){const m=$('#pMsg');m.textContent=t;m.className='msg '+type;m.hidden=!t}
function activeFor(id){return apps.find(a=>a.category===id&&(a.status==='pending'||a.status==='approved'))}
function renderApps(){
  const box=$('#appList');
  if(!apps.length){box.innerHTML='<p class="empty">Vous n’avez pas encore déposé de demande.</p>';return}
  box.innerHTML=apps.map(a=>{const c=CATS.find(x=>x.id===a.category)||{icon:'•',label:a.category};
    return `<article class="app"><div><b>${c.icon} ${esc(c.label)} — ${esc(a.organization_name)}</b><small>Envoyée le ${new Date(a.created_at).toLocaleDateString('fr-FR')} · ${esc(a.city)}</small>${a.status==='rejected'&&a.review_note?`<div class="why">Motif : ${esc(a.review_note)}</div>`:''}</div><span class="badge ${esc(a.status)}">${STATUS[a.status]||esc(a.status)}</span></article>`}).join('');
}
function renderCats(){
  $('#catGrid').innerHTML=CATS.map(c=>{const a=activeFor(c.id);
    return `<button type="button" class="cat" data-cat="${c.id}" ${a?'disabled':''}><span class="ic">${c.icon}</span><span><b>${esc(c.label)}</b><small>${a?'Demande '+(a.status==='approved'?'acceptée':'en attente'):esc(c.desc)}</small></span></button>`}).join('');
}
function fieldHtml(f){
  const id='pf_'+f.name,req=f.req?'required':'';
  const ctl=f.type==='select'?`<select id="${id}" name="${f.name}" ${req}><option value="">Choisir…</option>${f.opts.map(o=>`<option>${esc(o)}</option>`).join('')}</select>`
   :f.type==='textarea'?`<textarea id="${id}" name="${f.name}" maxlength="1000" ${req}></textarea>`
   :`<input id="${id}" name="${f.name}" type="${f.type}" ${f.type==='number'?'min="0" step="1"':'maxlength="160"'} ${req}>`;
  return `<label class="${f.full?'full':''}">${esc(f.label)}${f.req?'':' (facultatif)'}${ctl}</label>`;
}
function openForm(id){
  currentCat=CATS.find(c=>c.id===id);if(!currentCat)return;
  const countryCtl=`<label>Pays<select id="pf_country_code" name="country_code" required>${countries.map(([c,n])=>`<option value="${c}">${esc(n)}</option>`).join('')}</select></label>`;
  $('#formTitle').textContent='2. '+currentCat.icon+' '+currentCat.label;
  $('#formFields').innerHTML=countryCtl+currentCat.fields.map(fieldHtml).join('')+
    fieldHtml(F('contact_phone','Téléphone (avec indicatif)','tel'))+
    ((['restaurant','hotel','agro','agro_trader'].includes(id))?`<label class="full">Position GPS obligatoire<div class="row"><input id="partnerLat" name="latitude" type="number" step="any" placeholder="Latitude" required><input id="partnerLng" name="longitude" type="number" step="any" placeholder="Longitude" required><button type="button" id="partnerLocate" class="btn ghost">Me localiser</button></div></label>`:'')+
    fieldHtml(F('message','Pourquoi souhaitez-vous devenir partenaire ?','textarea',true,null,true));
  pShow('');$('#stepCat').hidden=true;$('#partnerForm').hidden=false;
  $('#formFields select').focus();
}
function closeFlow(){$('#partnerFlow').hidden=true;$('#startPartner').hidden=false;$('#partnerForm').hidden=true;$('#stepCat').hidden=false;currentCat=null}
async function loadApps(){
  try{
    const {data,error}=await sb.from('rg_partner_applications').select('id,category,organization_name,city,status,review_note,created_at').order('created_at',{ascending:false});
    if(error)throw error;apps=data||[];renderApps();renderCats();
  }catch(e){$('#appList').innerHTML='<p class="empty">Impossible de charger vos demandes pour le moment.</p>'}
}
async function initPartner(user){
  currentUser=user;closeFlow();apps=[];$('#appList').innerHTML='<p class="empty">Chargement…</p>';
  if(!sb)return;
  try{const {data}=await sb.from('rg_countries').select('code,name').eq('enabled',true).order('name');if(data&&data.length)countries=data.map(x=>[x.code,x.name])}catch(e){}
  await loadApps();
}
async function submitPartner(e){
  e.preventDefault();pShow('');
  if(!currentCat||!currentUser)return;
  const form=$('#partnerForm'),fd=Object.fromEntries(new FormData(form).entries());
  for(const f of [...currentCat.fields,F('contact_phone','Téléphone'),F('message','Message'),F('country_code','Pays')]){
    const v=(fd[f.name]||'').trim();
    if(f.req&&!v)return pShow('Renseignez le champ « '+f.label+' ».');
  }
  if(!/^[+()\d\s.-]{6,30}$/.test(fd.contact_phone.trim()))return pShow('Saisissez un numéro de téléphone valide, par exemple +227 90 00 00 00.');
  if(['restaurant','hotel','agro','agro_trader'].includes(currentCat.id)&&(!fd.latitude||!fd.longitude))return pShow('La position GPS est obligatoire pour ce type de compte. Cliquez sur « Me localiser ».');
  if(activeFor(currentCat.id))return pShow('Vous avez déjà un compte actif dans cette catégorie.');
  const details={};
  currentCat.fields.forEach(f=>{if(!COLS.includes(f.name)){const v=(fd[f.name]||'').trim();if(v)details[f.name]=f.type==='number'?Number(v):v}});
  const btn=$('#pSubmit');btn.disabled=true;
  try{
    const roleMap={restaurant:'restaurant',hotel:'hotel',delivery:'delivery',agro:'agro_producer',agro_trader:'agro_trader',commerce:'commerce',business:'business'};
    const accountType=roleMap[currentCat.id]||'business';
    const {data:org,error}=await sb.from('rg_organizations').insert({
      legal_name:fd.organization_name.trim(),public_name:fd.organization_name.trim(),country_code:fd.country_code||'CI',
      organization_type:currentCat.id,verification_status:'verified',owner_id:currentUser.id,
      city:fd.city.trim(),address:fd.address||null,latitude:fd.latitude?Number(fd.latitude):null,longitude:fd.longitude?Number(fd.longitude):null,
      contact_phone:fd.contact_phone.trim(),details
    }).select('id').single();
    if(error)throw error;
    const {error:metaError}=await sb.auth.updateUser({data:{account_type:accountType,organization_id:org.id,organization_name:fd.organization_name.trim(),org_city:fd.city.trim(),org_address:fd.address||'',org_phone:fd.contact_phone.trim(),org_lat:fd.latitude?Number(fd.latitude):null,org_lng:fd.longitude?Number(fd.longitude):null}});
    if(metaError)throw metaError;
    if(['restaurant','agro','agro_trader'].includes(currentCat.id)){
      const agroRole=currentCat.id==='restaurant'?'restaurant':currentCat.id==='agro'?'agro_producer':'agro_trader';
      const {error:agroError}=await sb.from('rg_agro_profiles').upsert({user_id:currentUser.id,role:agroRole,business_name:fd.organization_name.trim(),country:fd.country_code||'CI',city:fd.city.trim(),address:fd.address||'',phone:fd.contact_phone.trim(),lat:Number(fd.latitude),lng:Number(fd.longitude)},{onConflict:'user_id'});
      if(agroError)throw agroError;
    }
    closeFlow();
    $('#appList').innerHTML='<p class="empty">Compte professionnel activé. Votre espace est disponible.</p>';
    const destinations={restaurant:'resto-restaurant.html',hotel:'resto-restaurant.html',delivery:'resto-driver.html',agro:'agro.html',agro_trader:'agro.html'};
    if(currentCat.id==='restaurant'||currentCat.id==='hotel')sessionStorage.setItem('zmy_portal','1');
    if(destinations[currentCat.id])location.href=destinations[currentCat.id];
  }catch(err){
    pShow(/duplicate|unique/i.test(err.message||'')?'Vous avez déjà une demande active dans cette catégorie.':'Votre demande n’a pas pu être envoyée. Réessayez dans un instant.');
  }finally{btn.disabled=false}
}
$('#startPartner').addEventListener('click',()=>{renderCats();$('#partnerFlow').hidden=false;$('#startPartner').hidden=true;$('#stepCat').hidden=false;$('#partnerForm').hidden=true});
$('#catGrid').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b&&!b.disabled)openForm(b.dataset.cat)});
$('#backCat').addEventListener('click',()=>{$('#partnerForm').hidden=true;$('#stepCat').hidden=false});
document.addEventListener('click',e=>{if(e.target&&e.target.id==='partnerLocate'){if(!navigator.geolocation)return pShow('La géolocalisation n’est pas disponible sur cet appareil.');e.target.disabled=true;navigator.geolocation.getCurrentPosition(pos=>{document.querySelector('#partnerLat').value=pos.coords.latitude;document.querySelector('#partnerLng').value=pos.coords.longitude;pShow('Position GPS enregistrée.','success');e.target.disabled=false},()=>{pShow('Autorisez la localisation GPS pour continuer.');e.target.disabled=false},{enableHighAccuracy:true,timeout:15000})}});
$('#pCancel').addEventListener('click',closeFlow);
$('#partnerForm').addEventListener('submit',submitPartner);

/* ===== Propriétaire, mot de passe ===== */
async function checkOwner(){
  $('#ownerLink').hidden=true;$('#ownerNotice').hidden=true;
  try{const {data}=await sb.rpc('rg_is_platform_owner');if(data===true){$('#ownerLink').hidden=false;$('#ownerNotice').hidden=false}}catch(e){}
}
function pwMsg(id,t,type='error'){const m=$(id);m.textContent=t;m.className='msg '+type;m.hidden=!t}
$('#forgotBtn').addEventListener('click',async()=>{
  if(!sb)return;
  try{
    const email=$('#email').value.trim().toLowerCase();
    if(!EMAIL_RE.test(email))return showMsg('Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.');
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;
    showMsg('Un lien de réinitialisation a été envoyé à votre adresse e-mail.','success');
  }catch(err){showMsg(translate(err))}
});
$('#recForm').addEventListener('submit',async e=>{
  e.preventDefault();pwMsg('#recMsg','');
  const a=$('#recPw').value,b=$('#recPw2').value;
  if(a.length<MIN)return pwMsg('#recMsg','Le mot de passe doit contenir au moins '+MIN+' caractères.');
  if(a!==b)return pwMsg('#recMsg','Les deux mots de passe ne sont pas identiques.');
  $('#recBtn').disabled=true;
  try{const {data,error}=await sb.auth.updateUser({password:a});if(error)throw error;
    history.replaceState(null,'',location.pathname);await showAccount(data.user);
  }catch(err){pwMsg('#recMsg',translate(err))}
  finally{$('#recBtn').disabled=false}
});
$('#togglePw').addEventListener('click',()=>{$('#pwForm').hidden=false;$('#togglePw').hidden=true});
$('#pwCancel').addEventListener('click',()=>{$('#pwForm').hidden=true;$('#togglePw').hidden=false;$('#pwForm').reset();pwMsg('#pwMsg','')});
$('#pwForm').addEventListener('submit',async e=>{
  e.preventDefault();pwMsg('#pwMsg','');
  const o=$('#pwOld').value,a=$('#pwNew').value,b=$('#pwNew2').value;
  if(!o)return pwMsg('#pwMsg','Saisissez votre mot de passe actuel.');
  if(a.length<MIN)return pwMsg('#pwMsg','Le nouveau mot de passe doit contenir au moins '+MIN+' caractères.');
  if(a!==b)return pwMsg('#pwMsg','Les deux nouveaux mots de passe ne sont pas identiques.');
  if(a===o)return pwMsg('#pwMsg','Le nouveau mot de passe doit être différent de l’actuel.');
  $('#pwBtn').disabled=true;
  try{
    const identity={email:currentUser.email};
    const r=await sb.auth.signInWithPassword({...identity,password:o});
    if(r.error)throw new Error('Mot de passe actuel incorrect.');
    const {error}=await sb.auth.updateUser({password:a});if(error)throw error;
    $('#pwForm').reset();pwMsg('#pwMsg','Mot de passe modifié avec succès.','success');
  }catch(err){pwMsg('#pwMsg',translate(err))}
  finally{$('#pwBtn').disabled=false}
});

document.addEventListener('click',e=>{
  const t=e.target.closest('[data-mode]');if(t){setMode(t.dataset.mode);return}
  const eye=e.target.closest('[data-eye]');
  if(eye){const i=document.getElementById(eye.dataset.eye),show=i.type==='password';i.type=show?'text':'password';eye.textContent=show?'Masquer':'Afficher'}
});
$('#authForm').addEventListener('submit',submit);
$('#password').addEventListener('input',updateMatch);
$('#passwordConfirm').addEventListener('input',updateMatch);
$('#logout').addEventListener('click',async()=>{if(sb)await sb.auth.signOut();showAuth();setMode('in')});

(async()=>{
  setMode(new URLSearchParams(location.search).get('mode')==='signup'?'up':'in',true);updateIdentityFields();
  try{
    const c=window.ZUMAYA_CONFIG;
    if(!c||!c.SUPABASE_URL||c.SUPABASE_URL.includes('VOTRE-PROJET'))throw new Error('config');
    sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange((ev,session)=>{if(ev==='PASSWORD_RECOVERY'){$('#auth').hidden=true;$('#account').hidden=true;$('#recovery').hidden=false}});
    const {data:{session}}=await sb.auth.getSession();
    if(session&&!/type=recovery/.test(location.hash))await showAccount(session.user);
  }catch(e){showMsg('Le service de connexion n’est pas disponible pour le moment.')}
})();
})();
