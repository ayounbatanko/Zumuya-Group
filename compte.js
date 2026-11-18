(()=>{'use strict';
const $=s=>document.querySelector(s);
let sb=null,mode='in';
const MIN=8;

function showMsg(text,type='error'){const m=$('#msg');m.textContent=text;m.className='msg '+type;m.hidden=!text}
function setMode(m,init){
  mode=m;const up=m==='up';
  $('#tabIn').classList.toggle('active',!up);$('#tabUp').classList.toggle('active',up);
  $('#tabIn').setAttribute('aria-selected',String(!up));$('#tabUp').setAttribute('aria-selected',String(up));
  $('#nameWrap').hidden=!up;$('#confirmWrap').hidden=!up;$('#pwHelp').hidden=!up;$('#accountTypeWrap').hidden=!up;
  $('#displayName').required=up;$('#passwordConfirm').required=up;$('#accountType').required=up;
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
function showAccount(user){
  const accountType=(user.user_metadata&&user.user_metadata.account_type)||'';
  if(accountType==='restaurant'){location.replace('resto-index.html');return}
  if(['agro_producer','agro_trader'].includes(accountType)){location.replace('agro.html');return}
  if(accountType==='customer'){location.replace('index.html#catalogue-restaurants');return}
  if(accountType==='hotel'){location.replace('hotel.html');return}
  if(accountType==='delivery'){location.replace('livraison.html');return}
  $('#auth').hidden=true;$('#account').hidden=false;
  $('#agroLink').hidden=!['restaurant','agro_producer','agro_trader'].includes(accountType);
  $('#accPhone').textContent=user.phone||user.user_metadata?.phone_e164||'—';
  $('#accName').textContent=(user.user_metadata&&user.user_metadata.name)||'—';
  $('#recovery').hidden=true;
  checkOwner();
  $('#partnerPanel').hidden=true; // Les comptes professionnels sont activés dès leur inscription, sans demande d'approbation.
  initPartner(user);
}
function showAuth(){$('#account').hidden=true;$('#recovery').hidden=true;$('#auth').hidden=false}

function fullPhone(){
  const dial=$('#dialCode').value,raw=$('#phone').value.trim();
  let digits=raw.replace(/\D/g,'');
  if(digits.startsWith('0'))digits=digits.slice(1);
  if(!dial||digits.length<6||digits.length>14)return '';
  return dial+digits;
}
async function submit(e){
  e.preventDefault();showMsg('');
  const phone=fullPhone(),password=$('#password').value,name=$('#displayName').value.trim(),confirm=$('#passwordConfirm').value;
  if(!phone)return showMsg('Saisissez un numéro de téléphone valide avec son indicatif pays.');
  if(mode==='up'){
    if(!name)return showMsg('Saisissez votre nom complet.');
    if(!$('#accountType').value)return showMsg('Choisissez votre type de compte.');
    if(password.length<MIN)return showMsg('Le mot de passe doit contenir au moins '+MIN+' caractères.');
    if(password!==confirm){updateMatch();return showMsg('Les deux mots de passe ne sont pas identiques.')}
  }else if(!password)return showMsg('Saisissez votre mot de passe.');
  if(!sb)return showMsg('Le service de connexion n’est pas configuré. Vérifiez le fichier config.js.');
  const btn=$('#submitBtn');btn.disabled=true;
  try{
    if(mode==='up'){
      const accountType=$('#accountType').value;
      const {data,error}=await sb.auth.signUp({phone,password,options:{data:{name,account_type:accountType,phone_e164:phone,country_dial_code:$('#dialCode').value}}});
      if(error)throw error;
      if(data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0)throw new Error('Un compte existe déjà avec ce numéro. Connectez-vous.');
      if(data.session){showAccount(data.session.user);return}
      showMsg('Compte enregistré. Pour permettre une connexion immédiate par téléphone et mot de passe sans code SMS, désactivez la confirmation téléphonique obligatoire dans Supabase Auth > Providers > Phone. Puis reconnectez-vous.','success');
    }else{
      const {data,error}=await sb.auth.signInWithPassword({phone,password});
      if(error)throw error;
      showAccount(data.user);
    }
  }catch(err){showMsg(translate(err))}
  finally{btn.disabled=false}
}
function translate(err){
  const m=(err&&err.message)||'';
  if(/Invalid login credentials/i.test(m))return 'Numéro de téléphone ou mot de passe incorrect.';
  if(/Phone not confirmed/i.test(m))return 'Votre numéro n’est pas encore confirmé. Vérifiez le code reçu par SMS.';
  if(/already registered|already been registered/i.test(m))return 'Un compte existe déjà avec ce numéro de téléphone. Connectez-vous.';
  if(/rate limit|too many/i.test(m))return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
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
 {id:'agro',icon:'🌾',label:'Agriculture',desc:'Producteurs, coopératives, fournisseurs',fields:[F('organization_name','Nom du producteur ou de la coopérative'),F('city','Localité'),F('crops','Cultures / produits'),F('volume','Volume annuel estimé (ex. 20 tonnes)','text',false),F('members','Nombre de membres','number',false)]},
 {id:'travel',icon:'🧭',label:'Tourisme & voyages',desc:'Agences, guides, hébergements touristiques',fields:[F('organization_name','Nom de l’agence ou du guide'),F('city','Ville'),F('offer_type','Type d’offre','select',true,['Agence de voyages','Guide','Hébergement touristique','Excursions']),F('destinations','Destinations proposées')]},
 {id:'business',icon:'📊',label:'Entreprise / institution',desc:'Entreprises, institutions, partenaires techniques',fields:[F('organization_name','Nom de l’entreprise ou de l’institution'),F('city','Ville'),F('partner_kind','Type de partenariat','select',true,['Commercial','Institutionnel','Technique','Paiement']),F('website','Site web','url',false)]}
];
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
  if(activeFor(currentCat.id))return pShow('Vous avez déjà une demande active dans cette catégorie.');
  const details={};
  currentCat.fields.forEach(f=>{if(!COLS.includes(f.name)){const v=(fd[f.name]||'').trim();if(v)details[f.name]=f.type==='number'?Number(v):v}});
  const btn=$('#pSubmit');btn.disabled=true;
  try{
    const {error}=await sb.from('rg_partner_applications').insert({
      category:currentCat.id,country_code:fd.country_code,city:fd.city.trim(),organization_name:fd.organization_name.trim(),
      contact_phone:fd.contact_phone.trim(),contact_email:null,message:fd.message.trim(),details,status:'pending'});
    if(error)throw error;
    closeFlow();await loadApps();
  }catch(err){
    pShow(/duplicate|unique/i.test(err.message||'')?'Vous avez déjà une demande active dans cette catégorie.':'Votre demande n’a pas pu être envoyée. Réessayez dans un instant.');
  }finally{btn.disabled=false}
}
$('#startPartner').addEventListener('click',()=>{renderCats();$('#partnerFlow').hidden=false;$('#startPartner').hidden=true;$('#stepCat').hidden=false;$('#partnerForm').hidden=true});
$('#catGrid').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b&&!b.disabled)openForm(b.dataset.cat)});
$('#backCat').addEventListener('click',()=>{$('#partnerForm').hidden=true;$('#stepCat').hidden=false});
$('#pCancel').addEventListener('click',closeFlow);
$('#partnerForm').addEventListener('submit',submitPartner);

/* ===== Propriétaire, mot de passe ===== */
async function checkOwner(){
  $('#ownerLink').hidden=true;$('#ownerNotice').hidden=true;
  try{const {data}=await sb.rpc('rg_is_platform_owner');if(data===true){$('#ownerLink').hidden=false;$('#ownerNotice').hidden=false}}catch(e){}
}
function pwMsg(id,t,type='error'){const m=$(id);m.textContent=t;m.className='msg '+type;m.hidden=!t}
$('#forgotBtn').addEventListener('click',async()=>{
  const phone=fullPhone();
  if(!phone)return showMsg('Saisissez votre numéro avec son indicatif pays avant de demander la réinitialisation.');
  if(!sb)return;
  try{const {error}=await sb.auth.signInWithOtp({phone,options:{shouldCreateUser:false}});if(error)throw error;
    const token=prompt('Saisissez le code reçu par SMS :');if(!token)return;
    const {data,error:verifyError}=await sb.auth.verifyOtp({phone,token:token.trim(),type:'sms'});if(verifyError)throw verifyError;
    $('#auth').hidden=true;$('#recovery').hidden=false;currentUser=data.user;
    showMsg('Code vérifié. Définissez votre nouveau mot de passe ci-dessous.','success')}
  catch(err){showMsg(translate(err))}
});
$('#recForm').addEventListener('submit',async e=>{
  e.preventDefault();pwMsg('#recMsg','');
  const a=$('#recPw').value,b=$('#recPw2').value;
  if(a.length<MIN)return pwMsg('#recMsg','Le mot de passe doit contenir au moins '+MIN+' caractères.');
  if(a!==b)return pwMsg('#recMsg','Les deux mots de passe ne sont pas identiques.');
  $('#recBtn').disabled=true;
  try{const {data,error}=await sb.auth.updateUser({password:a});if(error)throw error;
    history.replaceState(null,'',location.pathname);showAccount(data.user);
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
    const phone=currentUser&&currentUser.phone;
    const r=await sb.auth.signInWithPassword({phone,password:o});
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
  setMode(new URLSearchParams(location.search).get('mode')==='signup'?'up':'in',true);
  try{
    const c=window.ZUMAYA_CONFIG;
    if(!c||!c.SUPABASE_URL||c.SUPABASE_URL.includes('VOTRE-PROJET'))throw new Error('config');
    sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange((ev,session)=>{if(ev==='PASSWORD_RECOVERY'){$('#auth').hidden=true;$('#account').hidden=true;$('#recovery').hidden=false}});
    const {data:{session}}=await sb.auth.getSession();
    if(session&&!/type=recovery/.test(location.hash))showAccount(session.user);
  }catch(e){showMsg('Le service de connexion n’est pas disponible pour le moment.')}
})();
})();
