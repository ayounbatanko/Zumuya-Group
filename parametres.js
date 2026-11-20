(()=>{'use strict';
const $=s=>document.querySelector(s);
const MIN=8,EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAT={customer:'Client',restaurant:'Restaurant partenaire',hotel:'Hôtel / hébergement',delivery:'Livreur',agro_producer:'Producteur agricole',agro_trader:'Commerçant agricole'};
const SPACE={customer:'client-espace.html',restaurant:'resto-restaurant.html',hotel:'resto-restaurant.html',delivery:'resto-driver.html',agro_producer:'agro.html',agro_trader:'agro.html'};
let sb=null,user=null;
function msg(id,t,type='error'){const m=$(id);m.textContent=t;m.className='msg '+type;m.hidden=!t}
function tr(err){const m=(err&&err.message)||'';
  if(/Invalid login/i.test(m))return 'Mot de passe incorrect.';
  if(/rate limit|too many/i.test(m))return 'Trop de tentatives. Patientez quelques minutes.';
  if(/already|registered/i.test(m))return 'Cette adresse e-mail est déjà utilisée par un autre compte.';
  if(/Token has expired|invalid/i.test(m))return 'Code invalide ou expiré.';
  return m||'Une erreur est survenue. Réessayez.'}
async function verifyPw(pw){const identity=user&&user.email?{email:user.email}:user&&user.phone?{phone:user.phone}:null;if(!identity)throw new Error('Aucun identifiant de connexion vérifiable sur ce compte.');const r=await sb.auth.signInWithPassword({...identity,password:pw});if(r.error)throw new Error('Mot de passe incorrect.')}

function fill(){
  const md=user.user_metadata||{},type=md.account_type;
  $('#pCat').textContent=CAT[type]||'—';$('#pPhone').textContent=user.email||user.phone||'—';
  $('#pSince').textContent=user.created_at?new Date(user.created_at).toLocaleDateString('fr-FR'):'—';
  $('#pName').value=md.name||'';
  const sp=$('#spaceLink');if(SPACE[type]&&(type==='customer'||md.organization_id)){sp.hidden=false;sp.href=SPACE[type]}
  if(['restaurant','hotel'].includes(type)&&md.organization_id)$('#delWarn').textContent='Cette action est définitive : votre compte, la fiche de votre établissement, votre menu et vos données seront effacés, et votre établissement disparaîtra du catalogue public.';
  else if(type==='delivery')$('#delWarn').textContent='Cette action est définitive : votre compte livreur et vos données seront effacés.';
  notifState();
}
function notifState(){const b=$('#notifBtn'),s=$('#notifState');
  if(!('Notification'in window)){s.textContent='Non pris en charge par ce navigateur.';b.hidden=true;return}
  const p=Notification.permission;s.textContent=p==='granted'?'Activées.':p==='denied'?'Bloquées : autorisez-les dans les réglages du navigateur.':'Désactivées.';b.hidden=p!=='default'}

$('#nameForm').addEventListener('submit',async e=>{e.preventDefault();msg('#nameMsg','');
  const n=$('#pName').value.trim();if(!n)return msg('#nameMsg','Saisissez votre nom.');
  try{const {data,error}=await sb.auth.updateUser({data:{name:n}});if(error)throw error;user=data.user;
    try{await sb.from('rg_profiles').update({display_name:n}).eq('user_id',user.id)}catch(_){}
    msg('#nameMsg','Nom enregistré.','success')}catch(err){msg('#nameMsg',tr(err))}});

$('#emailForm').addEventListener('submit',async e=>{e.preventDefault();msg('#emailMsg','');
  const em=$('#newEmail').value.trim().toLowerCase();
  if(!EMAIL_RE.test(em))return msg('#emailMsg','Saisissez une adresse e-mail valide.');
  if(em===(user.email||'').toLowerCase())return msg('#emailMsg','C’est déjà votre adresse actuelle.');
  try{const {error}=await sb.auth.updateUser({email:em},{emailRedirectTo:location.origin+location.pathname});if(error)throw error;
    $('#newEmail').value='';msg('#emailMsg','Un lien de confirmation a été envoyé. Votre adresse changera après confirmation.','success')}catch(err){msg('#emailMsg',tr(err))}});

$('#pwForm').addEventListener('submit',async e=>{e.preventDefault();msg('#pwMsg','');
  const o=$('#pwOld').value,a=$('#pwNew').value,b=$('#pwNew2').value;
  if(!o)return msg('#pwMsg','Saisissez votre mot de passe actuel.');
  if(a.length<MIN)return msg('#pwMsg','Le nouveau mot de passe doit contenir au moins '+MIN+' caractères.');
  if(a!==b)return msg('#pwMsg','Les deux nouveaux mots de passe ne sont pas identiques.');
  if(a===o)return msg('#pwMsg','Le nouveau mot de passe doit être différent de l’actuel.');
  try{await verifyPw(o);const {error}=await sb.auth.updateUser({password:a});if(error)throw error;$('#pwForm').reset();msg('#pwMsg','Mot de passe modifié.','success')}catch(err){msg('#pwMsg',tr(err))}});

$('#notifBtn').addEventListener('click',async()=>{try{await Notification.requestPermission()}catch(_){}notifState()});

function clearLocal(){try{Object.keys(localStorage).filter(k=>/^sb-.*-auth-token$/.test(k)).forEach(k=>localStorage.removeItem(k));sessionStorage.removeItem('uid');sessionStorage.removeItem('zmy_portal');sessionStorage.removeItem('zumuya_redirected')}catch(_){}}
$('#logout').addEventListener('click',async()=>{try{await sb.auth.signOut()}catch(_){}clearLocal();location.replace('compte.html')});
$('#logoutAll').addEventListener('click',async()=>{try{await sb.auth.signOut({scope:'global'})}catch(_){}clearLocal();location.replace('compte.html')});

$('#exportBtn').addEventListener('click',async()=>{msg('#secMsg','');
  try{
    const out={exporte_le:new Date().toISOString(),compte:{id:user.id,email:user.email,cree_le:user.created_at,profil:user.user_metadata||{}}};
    try{const a=await sb.from('rg_partner_applications').select('*');out.demandes_partenaire=a.data||[]}catch(_){}
    try{const o=await sb.from('rg_organizations').select('*').eq('owner_id',user.id);out.organisations=o.data||[]}catch(_){}
    const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='mes-donnees-zumuya.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
    msg('#secMsg','Fichier téléchargé.','success');
  }catch(err){msg('#secMsg',tr(err))}});

$('#delOpen').addEventListener('click',()=>{$('#delForm').hidden=false;$('#delOpen').hidden=true;$('#delWord').focus()});
$('#delCancel').addEventListener('click',()=>{$('#delForm').hidden=true;$('#delOpen').hidden=false;$('#delForm').reset();msg('#delMsg','')});
$('#delForm').addEventListener('submit',async e=>{e.preventDefault();msg('#delMsg','');
  if($('#delWord').value.trim().toUpperCase()!=='SUPPRIMER')return msg('#delMsg','Tapez le mot SUPPRIMER pour confirmer.');
  const pw=$('#delPw').value;if(!pw)return msg('#delMsg','Saisissez votre mot de passe.');
  const btn=$('#delBtn');btn.disabled=true;
  try{
    await verifyPw(pw);
    const {error}=await sb.rpc('rg_delete_my_account');
    if(error){if(/function|schema cache|does not exist/i.test(error.message||''))throw new Error('La suppression n’est pas encore activée sur le serveur : exécutez le fichier 05_suppression_compte.sql dans Supabase.');throw error}
    try{await sb.auth.signOut()}catch(_){}clearLocal();
    alert('Votre compte a été supprimé.');location.replace('index.html');
  }catch(err){msg('#delMsg',tr(err))}finally{btn.disabled=false}});

document.addEventListener('click',e=>{const eye=e.target.closest('[data-eye]');
  if(eye){const i=document.getElementById(eye.dataset.eye),show=i.type==='password';i.type=show?'text':'password';eye.textContent=show?'Masquer':'Afficher'}});

(async()=>{
  try{
    const c=window.ZUMAYA_CONFIG;if(!c||!window.supabase)throw 0;
    sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.replace('compte.html');return}
    user=session.user;$('#box').hidden=false;fill();
  }catch(_){document.querySelector('main').innerHTML='<section class="card"><p>Le service n’est pas disponible pour le moment.</p></section>'}
})();
})();
