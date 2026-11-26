/* ZUMUYA GROUP — garde-fou par catégorie de compte.
   Chaque page privée déclare les catégories autorisées : <script src="zguard.js" data-roles="restaurant,hotel"></script>
   Une catégorie non autorisée est renvoyée vers son propre espace ; sans session -> compte.html.
   NB : c'est un aiguillage d'interface. La vraie protection des données reste côté Supabase (règles RLS). */
(()=>{'use strict';
const me=document.currentScript,ROLES=(me&&me.dataset.roles||'').split(',').map(s=>s.trim()).filter(Boolean);
const HOME={customer:'client-espace.html',restaurant:'hospitality.html?type=restaurant',hotel:'hospitality.html?type=hotel',staff:'hospitality.html?type=member',delivery:'hospitality.html?type=member',agro_producer:'agro.html',agro_trader:'agro.html',marketplace:'marketplace.html',delivery_service:'livraison-entreprise.html',platform_staff:'proprietaire.html'};
const PRO=['platform_staff','restaurant','hotel','delivery','staff','agro_producer','agro_trader','marketplace','delivery_service'];
function session(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null'),s=v&&(v.currentSession||v);if(s&&s.access_token&&s.user&&s.user.id)return s}}}catch(e){}return null}
const go=u=>{if(location.pathname.split('/').pop()!==u)location.replace(u)};
const s=session();
if(!s){if(ROLES.length&&!ROLES.includes('public'))go('compte.html');return}
const md=s.user.user_metadata||{},type=md.account_type;
function isOwner(){
  const c=sessionStorage.getItem('zg_owner_'+s.user.id);if(c!==null)return Promise.resolve(c==='1');
  const C=window.ZUMAYA_CONFIG;if(!C)return Promise.resolve(false);
  return fetch(C.SUPABASE_URL+'/rest/v1/rpc/rg_is_platform_owner',{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:'{}'})
   .then(r=>r.ok?r.json():false).then(v=>{const o=v===true;try{sessionStorage.setItem('zg_owner_'+s.user.id,o?'1':'0')}catch(e){}return o}).catch(()=>false)}
function decide(owner){
  if(ROLES.includes('any'))return;
  if(md.account_type==='universal' && !ROLES.includes('owner'))return;
  if(owner){if(!ROLES.includes('owner'))go('proprietaire.html');return}
  if(ROLES.includes('owner')&&!ROLES.includes(type)){go(HOME[type]||'compte.html');return}
  if(!ROLES.includes(type)){go(HOME[type]||'compte.html');return}
  if(PRO.includes(type)&&!md.organization_id)go('compte.html#stay');
}
if(ROLES.includes('owner')){/* page réservée au propriétaire : on attend la réponse du serveur */
  document.documentElement.style.visibility='hidden';
  isOwner().then(o=>{if(o)document.documentElement.style.visibility='';else go(HOME[type]||'compte.html')});
}else{
  /* décision immédiate pour les catégories ; le propriétaire (rôle serveur) est vérifié ensuite */
  if(ROLES.includes('any'))return;
  if(md.account_type==='universal' && !ROLES.includes('owner'))return;
  if(ROLES.includes(type)){decide(false);isOwner().then(o=>{if(o)go('proprietaire.html')})}
  else isOwner().then(decide);
}
})();
