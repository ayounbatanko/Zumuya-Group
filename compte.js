(()=>{'use strict';
const $=s=>document.querySelector(s);
let sb=null,mode='in';
const ROLE_TYPES=['restaurant','hotel','agro_producer','agro_trader','marketplace','delivery_service','commerce','business'];
const roleToPartner={restaurant:'restaurant',hotel:'hotel',delivery:'delivery',agro_producer:'agro',agro_trader:'agro_trader',marketplace:'marketplace',delivery:'delivery_service',commerce:'commerce',business:'business'};
/* L'identifiant de connexion du portail reste l'adresse e-mail ; le rôle est détecté depuis le profil après connexion. */
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LABEL={customer:'Client',restaurant:'Restaurant partenaire',hotel:'Hôtel / hébergement',delivery:'Livreur (compte créé par un restaurant)',staff:'Employé (compte créé par un restaurant)',agro_producer:'Producteur agricole',agro_trader:'Commerçant agricole',marketplace:'Vendeur Marketplace',delivery_service:'Service de livraison'};
function updateIdentityFields(){$('#email').required=true}
const MIN=8;

function showMsg(text,type='error'){const m=$('#msg');m.textContent=text;m.className='msg '+type;m.hidden=!text}
function setMode(m,init){
  mode=m;const up=m==='up';
  $('#tabIn').classList.toggle('active',!up);$('#tabUp').classList.toggle('active',up);
  $('#tabIn').setAttribute('aria-selected',String(!up));$('#tabUp').setAttribute('aria-selected',String(up));
  $('#nameWrap').hidden=!up;$('#confirmWrap').hidden=!up;$('#pwHelp').hidden=!up;
  const form=$('#authForm');form.hidden=false;
  const categoryWrap=$('#categoryWrap');
  if(categoryWrap)categoryWrap.hidden=true;
  updateIdentityFields();
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
  const routes={customer:'client-espace.html',restaurant:'zrestaurant-restogest.html',hotel:'zrestaurant-restaurant.html?portal=hotel#hotel',staff:'zrestaurant-restogest.html',delivery:'zrestaurant-driver.html',agro_producer:'agro.html',agro_trader:'agro.html',marketplace:'marketplace.html',delivery_service:'livraison-entreprise.html'};
  const managed=type==='delivery'||type==='staff';
  const universal=type==='universal'||!type;   /* comptes gérés : jamais de fiche partenaire */
  const stay=/parametres|stay/.test(location.hash);
  /* Retour au catalogue : un visiteur parti se connecter depuis le panier y revient (clients uniquement, valable 30 min). */
  try{const b=(localStorage.getItem('zg_back')||'').split('|');localStorage.removeItem('zg_back');
    if(!stay&&type==='customer'&&b[0]&&Date.now()-(+b[1]||0)<18e5&&/^[a-z0-9._-]+\.html(#[\w-]*)?$/i.test(b[0])){location.replace(b[0]);return}}catch(e){}
  let owner=false;try{const {data}=await sb.rpc('rg_is_platform_owner');owner=data===true}catch(e){}
  if(owner&&!stay&&!sessionStorage.getItem('zumuya_redirected')){sessionStorage.setItem('zumuya_redirected','1');location.replace('proprietaire.html');return}
  if(!owner&&type&&type!=='universal'&&routes[type]&&!stay&&!sessionStorage.getItem('zumuya_redirected')){sessionStorage.setItem('zumuya_redirected','1');if(type==='restaurant'||type==='hotel')sessionStorage.setItem('zmy_portal','1');location.replace(routes[type]);return}
  sessionStorage.removeItem('zumuya_redirected');
  $('#auth').hidden=true;$('#account').hidden=false;$('#recovery').hidden=true;
  $('#accPhone').textContent=user.email||user.phone||'—';
  $('#accName').textContent=(user.user_metadata&&user.user_metadata.name)||'—';
  const rt=routes[type],ready=rt&&(type==='customer'||user.user_metadata?.organization_id);
  const sp=$('#mySpace');sp.hidden=owner||!ready;if(ready)sp.href=rt;
  $('#clientOrder').hidden=owner||(!universal&&type!=='customer');
  $('#ownerLink').hidden=!owner;$('#ownerNotice').hidden=!owner;
  const lead=$('#roleLead');
  if(owner){lead.hidden=true}
  else if(type==='customer'){lead.hidden=false;lead.textContent='Compte client : consultez les restaurants proches, leurs menus, et passez commande depuis votre espace.'}
  else if(managed&&!ready){lead.hidden=false;lead.textContent='Ce compte est géré par un restaurant partenaire, mais il n’est rattaché à aucun établissement. Contactez votre responsable.'}
  else if(type&&!ready){lead.hidden=false;lead.textContent='Compte '+(LABEL[type]||'professionnel')+' : complétez la fiche de votre activité ci-dessous (« Devenir partenaire ») pour ouvrir votre espace.'}
  else{lead.hidden=true}
  $('#partnerPanel').hidden=owner||managed;
  if(!owner&&!managed) initPartner(user);
  if(universal){lead.hidden=false;lead.textContent='Votre compte unique est actif. Activez et gérez plusieurs activités depuis le même compte.';$('#moduleManager').hidden=true;$('#partnerPanel').hidden=true;if(window.ZDASH)window.ZDASH.show(sb,user);else{$('#moduleManager').hidden=false;if(window.ZUMAYA_MODULE_MANAGER)window.ZUMAYA_MODULE_MANAGER.init(sb,user)}}else{if($('#moduleManager'))$('#moduleManager').hidden=true;if(window.ZDASH)window.ZDASH.hide()}
}
function showAuth(){if(window.ZDASH)window.ZDASH.hide();$('#account').hidden=true;$('#recovery').hidden=true;$('#auth').hidden=false}

async function submit(e){
  e.preventDefault();showMsg('');
  const password=$('#password').value,name=$('#displayName').value.trim(),confirm=$('#passwordConfirm').value;
  const email=$('#email').value.trim().toLowerCase();
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
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{name,account_type:'universal',enabled_modules:[],account_model:'multi_module'},emailRedirectTo:location.origin+location.pathname}});
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
 {id:'marketplace',icon:'🛍️',label:'Vendeur Marketplace',desc:'Boutiques, commerçants, grossistes et vendeurs en ligne',fields:[F('organization_name','Nom de la boutique'),F('city','Ville'),F('address','Adresse','text',false),F('products','Produits vendus'),F('market','Type de clientèle','select',true,['Particuliers (B2C)','Professionnels (B2B)','Entre particuliers (C2C)','Tous']),F('registration','N° d’immatriculation (RCCM / NIF)','text',false)]},
 {id:'delivery',icon:'📦',label:'Service de livraison',desc:'Entreprises de livraison, transporteurs et gestion de flotte',fields:[F('organization_name','Nom de la société ou du coursier'),F('city','Ville'),F('zone','Zone de livraison'),F('vehicle','Moyen de livraison','select',true,['Moto','Vélo','Voiture','Camionnette','Camion']),F('availability','Disponibilité','select',true,['Temps plein','Temps partiel','Week-end uniquement']),F('registration','N° d’immatriculation (RCCM / NIF)','text',false)]},
 {id:'commerce',icon:'🏪',label:'Boutique / commerce',desc:'Boutiques, magasins, grossistes',fields:[F('organization_name','Nom de la boutique'),F('city','Ville'),F('address','Adresse','text',false),F('products','Produits vendus'),F('outlets','Nombre de points de vente','number',false),F('registration','N° d’immatriculation (RCCM / NIF)','text',false)]},
 {id:'transport',icon:'🚕',label:'Transport',desc:'Chauffeurs, taxis, transporteurs',fields:[F('organization_name','Nom complet ou de la société'),F('city','Ville'),F('vehicle','Type de véhicule','select',true,['Taxi','Moto-taxi','Minibus','Bus','Camion']),F('capacity','Capacité (places ou tonnage)'),F('experience','Années d’expérience','number',false)]},
 {id:'services',icon:'🧰',label:'Prestataire de services',desc:'Artisans, techniciens, indépendants',fields:[F('organization_name','Nom ou raison sociale'),F('city','Ville'),F('trade','Métier / type de prestation'),F('experience','Années d’expérience','number',false),F('description','Décrivez vos prestations','textarea',true,null,true)]},
 {id:'events',icon:'🎟️',label:'Événements',desc:'Organisateurs, salles, billetterie',fields:[F('organization_name','Nom de la structure'),F('city','Ville'),F('event_types','Types d’événements'),F('capacity','Capacité maximale (personnes)','number',false)]},
 {id:'agro',icon:'🌾',label:'Producteur agricole',desc:'Producteurs et coopératives agricoles',fields:[F('organization_name','Nom du producteur ou de la coopérative'),F('city','Localité'),F('address','Adresse / quartier'),F('crops','Cultures / produits'),F('volume','Volume annuel estimé (ex. 20 tonnes)','text',false),F('members','Nombre de membres','number',false)]},
 {id:'agro_trader',icon:'🧺',label:'Commerçant agricole',desc:'Vendeurs, grossistes et détaillants de produits agricoles',fields:[F('organization_name','Nom du commerce'),F('city','Localité'),F('address','Adresse / quartier'),F('products','Produits agricoles vendus'),F('market','Marché / zone de vente','text',false)]},
 {id:'travel',icon:'🧭',label:'Tourisme & voyages',desc:'Agences, guides, hébergements touristiques',fields:[F('organization_name','Nom de l’agence ou du guide'),F('city','Ville'),F('offer_type','Type d’offre','select',true,['Agence de voyages','Guide','Hébergement touristique','Excursions']),F('destinations','Destinations proposées')]},
 {id:'business',icon:'📊',label:'Entreprise / institution',desc:'Entreprises, institutions, partenaires techniques',fields:[F('organization_name','Nom de l’entreprise ou de l’institution'),F('city','Ville'),F('partner_kind','Type de partenariat','select',true,['Commercial','Institutionnel','Technique','Paiement']),F('website','Site web','url',false)]}
];
const LIVE=['restaurant','hotel','agro','agro_trader','marketplace','delivery'];   /* Le pôle delivery désigne une entreprise de livraison ; les comptes livreurs sont créés par les organisations autorisées. */
CATS.splice(0,CATS.length,...CATS.filter(c=>LIVE.includes(c.id)));
const COLS=['organization_name','city'];
const STATUS={pending:'En attente',approved:'Acceptée',rejected:'Refusée'};
let apps=[],countries=[['NE','Niger']],currentCat=null,currentUser=null,catFilter=null;

function pShow(t,type='error'){const m=$('#pMsg');m.textContent=t;m.className='msg '+type;m.hidden=!t}
function activeFor(id){return apps.find(a=>a.category===id&&(a.status==='pending'||a.status==='approved'))}
function renderApps(){
  const box=$('#appList');
  if(!apps.length){box.innerHTML='<p class="empty">Vous n’avez pas encore déposé de demande.</p>';return}
  box.innerHTML=apps.map(a=>{const c=CATS.find(x=>x.id===a.category)||{icon:'•',label:a.category};
    return `<article class="app"><div><b>${c.icon} ${esc(c.label)} — ${esc(a.organization_name)}</b><small>Envoyée le ${new Date(a.created_at).toLocaleDateString('fr-FR')} · ${esc(a.city)}</small>${a.status==='rejected'&&a.review_note?`<div class="why">Motif : ${esc(a.review_note)}</div>`:''}</div><span class="badge ${esc(a.status)}">${STATUS[a.status]||esc(a.status)}</span></article>`}).join('');
}
function renderCats(){
  $('#catGrid').innerHTML=CATS.filter(c=>!catFilter||catFilter.includes(c.id)).map(c=>{const a=activeFor(c.id);
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
function closeFlow(){catFilter=null;$('#partnerFlow').hidden=true;$('#startPartner').hidden=false;$('#partnerForm').hidden=true;$('#stepCat').hidden=false;currentCat=null}
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
    const {data:org,error}=await sb.from('rg_organizations').insert({
      legal_name:fd.organization_name.trim(),public_name:fd.organization_name.trim(),country_code:fd.country_code||'CI',
      organization_type:currentCat.id,owner_id:currentUser.id,
      city:fd.city.trim(),address:fd.address||null,latitude:fd.latitude?Number(fd.latitude):null,longitude:fd.longitude?Number(fd.longitude):null,
      contact_phone:fd.contact_phone.trim(),details
    }).select('id').single();
    if(error)throw error;
    const canonicalModule=({restaurant:'restaurant',hotel:'hotel',agro:'agro',agro_trader:'agro',marketplace:'marketplace',delivery:'delivery',delivery_service:'delivery',commerce:'marketplace'})[currentCat.id]||currentCat.id;
    try{const {error:moduleError}=await sb.rpc('rg_ecosystem_set_module',{p_module:canonicalModule,p_org:org.id,p_configuration:{},p_status:'active'});if(moduleError)console.warn('Pôle créé ; synchronisation écosystème à vérifier :',moduleError.message);}catch(moduleSyncError){console.warn('Synchronisation des pôles non disponible avant migration 16.',moduleSyncError);}
    const oldMeta=currentUser.user_metadata||{};
    const modules=[...new Set([...(oldMeta.enabled_modules||[]),currentCat.id])];
    const orgs=[...new Set([...(oldMeta.organization_ids||[]),org.id])];
    const isRH=currentCat.id==='restaurant'||currentCat.id==='hotel';
    const orgMap={...(oldMeta.org_map||{}),[currentCat.id]:org.id};
    /* L'établissement restaurant / hôtel pilote la liaison avec le Service de Restauration : une autre activité ne l'écrase pas. */
    const meta={account_type:'universal',account_model:'multi_module',enabled_modules:modules,organization_ids:orgs,org_map:orgMap};
    if(isRH||!oldMeta.organization_id){Object.assign(meta,{organization_id:org.id,organization_name:fd.organization_name.trim(),org_city:fd.city.trim(),org_address:fd.address||'',org_phone:fd.contact_phone.trim(),org_lat:fd.latitude?Number(fd.latitude):null,org_lng:fd.longitude?Number(fd.longitude):null});if(isRH)meta.portal_type=currentCat.id}
    const {error:metaError}=await sb.auth.updateUser({data:meta});
    if(metaError)throw metaError;
    if(['restaurant','agro','agro_trader'].includes(currentCat.id)){
      const agroRole=currentCat.id==='restaurant'?'restaurant':currentCat.id==='agro'?'agro_producer':'agro_trader';
      const {error:agroError}=await sb.from('rg_agro_profiles').upsert({user_id:currentUser.id,role:agroRole,business_name:fd.organization_name.trim(),country:fd.country_code||'CI',city:fd.city.trim(),address:fd.address||'',phone:fd.contact_phone.trim(),lat:Number(fd.latitude),lng:Number(fd.longitude)},{onConflict:'user_id'});
      if(agroError)console.warn('Profil agricole non enregistré (table rg_agro_profiles absente ?) :',agroError.message);   /* non bloquant : l'espace restaurant / hôtel / livreur n'en dépend pas */
    }
    closeFlow();
    $('#appList').innerHTML='<p class="empty">Activité configurée avec succès. Vous pouvez ajouter une autre activité ou explorer les autres pôles.</p>';
    currentUser={...currentUser,user_metadata:{...(currentUser.user_metadata||{}),account_type:'universal',enabled_modules:[...new Set([...(currentUser.user_metadata?.enabled_modules||[]),currentCat.id])],organization_ids:[...new Set([...(currentUser.user_metadata?.organization_ids||[]),org.id])],organization_id:org.id}};
    await initPartner(currentUser);
    document.dispatchEvent(new Event('zumaya:activity'));
    if(currentCat.id==='restaurant'||currentCat.id==='hotel')sessionStorage.setItem('zmy_portal','1');
    $('#roleLead').hidden=false;$('#roleLead').textContent='Activité activée. Votre compte conserve l’accès à tous les pôles ZUMAYA.';
  }catch(err){
    const m=err.message||'';pShow(/duplicate|unique/i.test(m)?'Vous avez déjà un compte actif dans cette catégorie.':/pays n.est pas/i.test(m)?'Ce pays n’est pas encore disponible.':/Nom invalide/i.test(m)?'Le nom doit contenir entre 2 et 120 caractères.':/Type de pôle/i.test(m)?'Catégorie invalide.':'Votre demande n’a pas pu être envoyée. Réessayez dans un instant.');
  }finally{btn.disabled=false}
}
$('#startPartner').addEventListener('click',()=>{renderCats();$('#partnerFlow').hidden=false;$('#startPartner').hidden=true;$('#stepCat').hidden=false;$('#partnerForm').hidden=true});
$('#catGrid').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b&&!b.disabled)openForm(b.dataset.cat)});
$('#backCat').addEventListener('click',()=>{$('#partnerForm').hidden=true;$('#stepCat').hidden=false});
document.addEventListener('click',e=>{if(e.target&&e.target.id==='partnerLocate'){if(!navigator.geolocation)return pShow('La géolocalisation n’est pas disponible sur cet appareil.');e.target.disabled=true;navigator.geolocation.getCurrentPosition(pos=>{document.querySelector('#partnerLat').value=pos.coords.latitude;document.querySelector('#partnerLng').value=pos.coords.longitude;pShow('Position GPS enregistrée.','success');e.target.disabled=false},()=>{pShow('Autorisez la localisation GPS pour continuer.');e.target.disabled=false},{enableHighAccuracy:true,timeout:15000})}});
window.ZPARTNER={
  async open(ids){
    ids=[].concat(ids||[]).filter(Boolean);
    if(!currentUser&&sb){const {data:{user}}=await sb.auth.getUser();if(user)await initPartner(user)}
    closeFlow();catFilter=ids.length?ids:null;renderCats();
    $('#partnerFlow').hidden=false;$('#startPartner').hidden=true;$('#stepCat').hidden=false;$('#partnerForm').hidden=true;
    const free=(catFilter?CATS.filter(c=>catFilter.includes(c.id)):CATS).filter(c=>!activeFor(c.id));
    if(free.length===1)openForm(free[0].id);
  },
  close(){closeFlow()}
};
$('#pCancel').addEventListener('click',()=>{closeFlow();if(window.ZDASH&&document.body.classList.contains('dash-on'))document.querySelector('#dBack')?.click()});
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
    const identity=currentUser.email?{email:currentUser.email}:currentUser.phone?{phone:currentUser.phone}:null;
    if(!identity)throw new Error('Aucun identifiant de connexion vérifiable sur ce compte.');
    const r=await sb.auth.signInWithPassword({...identity,password:o});
    if(r.error)throw new Error('Mot de passe actuel incorrect.');
    const {error}=await sb.auth.updateUser({password:a});if(error)throw error;
    $('#pwForm').reset();pwMsg('#pwMsg','Mot de passe modifié avec succès.','success');
  }catch(err){pwMsg('#pwMsg',translate(err))}
  finally{$('#pwBtn').disabled=false}
});

/* Onglets Connexion / Créer un compte et liens de bascule (délégation : les liens sont recréés par setMode) */
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('#auth [data-mode]');
  if(!b)return;
  e.preventDefault();
  const m=b.getAttribute('data-mode');
  if(m==='in'||m==='up')setMode(m);
});
$('#authForm').addEventListener('submit',submit);
$('#password').addEventListener('input',updateMatch);
$('#passwordConfirm').addEventListener('input',updateMatch);
$('#logout').addEventListener('click',async()=>{if(sb)await sb.auth.signOut();showAuth();setMode('in')});
$('#moduleRefresh')?.addEventListener('click',()=>window.ZUMAYA_MODULE_MANAGER?.refresh());

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
