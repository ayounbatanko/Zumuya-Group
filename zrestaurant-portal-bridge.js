/* Pont portail -> ZUMUYA Restauration (SEUL point d'entrée : compte.html).
   Gère les comptes client, livreur, restaurant et hôtel. Le propriétaire est géré par zrestaurant-index.html (aiguillage).
   Un restaurant (ou hôtel) qui s'est connecté sur le portail avec son e-mail et son mot de passe (Supabase Auth)
   est reconnu ici automatiquement : on retrouve ou on crée son compte local + sa fiche restaurant, puis on ouvre
   la session. Plus de deuxième écran de connexion.
   À charger APRÈS zrestaurant-db.js et AVANT le script de la page. */
(function(){'use strict';
var D=window.RGDB;if(!D)return;
var page=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
var isIndex=page===''||page==='zrestaurant-index';
var SHw=window;try{if(window.parent!==window&&window.parent.nav)SHw=window.parent}catch(e){}
SHw.__m=SHw.__m||{l:{},s:{}};
function sget(k){try{var v=sessionStorage.getItem(k);if(v!==null)return v}catch(e){}return SHw.__m.s[k]==null?null:SHw.__m.s[k]}
function sset(k,v){try{sessionStorage.setItem(k,v)}catch(e){}SHw.__m.s[k]=v}
/* Session Supabase du portail (stockée par supabase-js dans le navigateur) */
function portal(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);
  if(/^sb-.*-auth-token$/.test(k)){var v=JSON.parse(localStorage.getItem(k)||'null'),s=v&&(v.currentSession||v);
   if(s&&s.access_token&&s.user&&s.user.id)return s}}}catch(e){}return null}
var s=portal();if(!s)return;
var pu=s.user,md=pu.user_metadata||{},type=md.account_type;
/* Le tableau de bord transmet le pôle explicitement (?portal=restaurant|hotel).
   Cela évite qu'un compte universel ouvrant ses deux établissements soit toujours aiguillé vers le dernier pôle configuré. */
var requestedPortal='';
try{var qp=new URLSearchParams(location.search),rp=qp.get('portal');if(rp==='restaurant'||rp==='hotel')requestedPortal=rp}catch(e){}
/* Compte universel : retrouver l'établissement demandé dans Supabase. Les anciens comptes restaurant/hôtel
   sans organization_id dans user_metadata sont également réparés à partir de owner_id. */
if(type==='universal'||((type==='restaurant'||type==='hotel')&&!md.organization_id)){
  var mods=md.enabled_modules||[],om=md.org_map||{};
  var want=requestedPortal||(type==='restaurant'||type==='hotel'?type:(md.portal_type||(om.restaurant?'restaurant':om.hotel?'hotel':'')));
  if(want||mods.indexOf('restaurant')>-1||mods.indexOf('restauration')>-1||mods.indexOf('hotel')>-1||md.organization_id){
    try{var C0=window.ZUMAYA_CONFIG,x0=new XMLHttpRequest();
      x0.open('GET',C0.SUPABASE_URL+'/rest/v1/rg_organizations?owner_id=eq.'+encodeURIComponent(pu.id)+'&organization_type=in.(restaurant,hotel)&select=id,organization_type,public_name,legal_name,city,address,contact_phone,latitude,longitude',false);
      x0.setRequestHeader('apikey',C0.SUPABASE_ANON_KEY);x0.setRequestHeader('Authorization','Bearer '+s.access_token);x0.send();
      if(x0.status===200){var os=JSON.parse(x0.responseText)||[];
        var og=os.filter(function(o){return o.organization_type===want})[0]||os.filter(function(o){return o.id===md.organization_id})[0]||os[0];
        if(og){type=og.organization_type;
          md=Object.assign({},md,{organization_id:og.id,organization_name:og.public_name||og.legal_name||md.organization_name,org_city:og.city||md.org_city,org_address:og.address||md.org_address,org_phone:og.contact_phone||md.org_phone,org_lat:og.latitude!=null?og.latitude:md.org_lat,org_lng:og.longitude!=null?og.longitude:md.org_lng})}}
    }catch(e){}
  }
}
/* Si aucun établissement ne correspond au pôle demandé, ne pas ouvrir un espace vide ou celui d'un autre pôle. */
if(((type==='restaurant'||type==='hotel')&&!md.organization_id)||(pu.user_metadata&&pu.user_metadata.account_type==='universal'&&requestedPortal&&!md.organization_id)){
  location.replace('compte.html#stay');return;
}
var ROLE={restaurant:'restaurant',hotel:'restaurant',staff:'restaurant',customer:'client',delivery:'driver'}[type];
if(!ROLE)return;
var isStaff=type==='staff';
if((type==='restaurant'||type==='hotel'||isStaff||type==='delivery')&&!md.organization_id)return;   /* livreur / employé : uniquement s'ils ont été rattachés par un restaurant */
/* Rattachement officiel (serveur) : statut + permissions d'un employé ou d'un livreur créé par un restaurant.
   Appel synchrone : la page doit démarrer avec les bons droits. Une réponse absente = aucun accès accordé. */
function membership(){try{var C=window.ZUMAYA_CONFIG,x=new XMLHttpRequest();x.open('POST',C.SUPABASE_URL+'/rest/v1/rpc/rg_my_membership',false);
  x.setRequestHeader('apikey',C.SUPABASE_ANON_KEY);x.setRequestHeader('Authorization','Bearer '+s.access_token);x.setRequestHeader('Content-Type','application/json');x.send('{}');
  if(x.status===200)return JSON.parse(x.responseText)}catch(e){}return undefined}
var MB=(isStaff||type==='delivery')?membership():null;
if((isStaff||type==='delivery')&&(!MB||MB.org_id!==md.organization_id||MB.kind!==(isStaff?'staff':'driver'))){window.ZPERM={denied:true};
  try{var d0=D.get(),b0=d0.users.find(function(x){return x.portalId===pu.id});if(b0&&!b0.disabled){b0.disabled=true;D.save(d0)}}catch(e){}return}
window.ZPERM=MB?{kind:MB.kind,status:MB.status,permissions:MB.permissions||[],job_title:MB.job_title||'',org_id:MB.org_id}:null;
var memberOff=!!MB&&MB.status!=='active';
if(memberOff){try{var d1=D.get(),b1=d1.users.find(function(x){return x.portalId===pu.id});if(b1&&!b1.disabled){b1.disabled=true;D.save(d1)}}catch(e){}window.ZPERM.denied=true;return}
   /* fiche partenaire pas encore créée : le portail la demande */
var fromPortal=true;
var d=D.get(),cur=sget('uid'),curU=cur&&d.users.find(function(x){return x.id==cur&&!x.disabled});
if(curU&&curU.portalId===pu.id&&curU.role===ROLE)return;   /* session déjà liée à ce compte portail */
var email=String(pu.email||pu.phone||md.phone_display||'').toLowerCase();
var uid=function(){return Math.random().toString(36).slice(2,9)};
function slug(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
var u=d.users.find(function(x){return x.portalId===pu.id&&x.role==='restaurant'})||d.users.find(function(x){return x.role==='restaurant'&&email&&String(x.phone||'').toLowerCase()===email});
var r=u&&u.restId&&d.rests.find(function(x){return x.id===u.restId})||d.rests.find(function(x){return x.portalOrgId===md.organization_id});
if(ROLE==='driver'){
  /* Livreur : il n'existe que parce qu'un restaurant l'a créé (Mon équipe). Il est toujours rattaché à CE restaurant. */
  var rr=d.rests.find(function(x){return x.portalOrgId===md.organization_id});
  var du=d.users.find(function(x){return x.portalId===pu.id&&x.role==='driver'});
  if(!rr&&!(du&&du.restId))return;
  if(!du){du={id:uid(),role:'driver',phone:email,name:String(md.name||email||'Livreur'),portalId:pu.id,email:email,created:Date.now(),managed:true,restId:rr.id};d.users.push(du);D.save(d)}
  else{var ch=false;if(rr&&du.restId!==rr.id){du.restId=rr.id;ch=true}if(!du.managed){du.managed=true;ch=true}if(du.disabled){du.disabled=false;ch=true}if(ch)D.save(d)}
  sset('uid',du.id);window.ZBRIDGE={fresh:true,userId:du.id};return}
if(ROLE==='client'){
  var uu=d.users.find(function(x){return x.portalId===pu.id&&x.role===ROLE});
  if(!uu){uu={id:uid(),role:ROLE,phone:email,name:String(md.name||email||'Utilisateur'),portalId:pu.id,email:email,created:Date.now()};
    if(String(uu.name).trim().toLocaleLowerCase('fr')==='ayouba tanko')uu.name=email||'Utilisateur';
    d.users.push(uu);D.save(d)}
  sset('uid',uu.id);window.ZBRIDGE={fresh:true,userId:uu.id};return}
var orgName=md.organization_name||md.name||'Mon restaurant';
var changed=false;
if(!r&&isStaff)return;   /* un employé ne crée jamais d'établissement */
if(!r){
  var sl=slug(orgName)||'resto',b=sl,i=2;while(d.rests.some(function(x){return x.slug==sl}))sl=b+'-'+i++;
  var hotel=type==='hotel';
  r={id:uid(),slug:sl,name:orgName,phone:md.org_phone||'',address:md.org_address||md.org_city||'',logo:'',currency:'XOF',lang:'fr',
     businessType:hotel?'hotel':'restaurant',
     hotel:hotel?{enabled:true,name:orgName,category:'Hôtel',manager:'',rooms:0,services:['Restaurant','Service en chambre','Petit-déjeuner','Bar / Café','Banquets et séminaires','À emporter'],hours:'07:00 - 23:00',instructions:''}:undefined,
     sub:'trial',trialEnd:Date.now()+30*864e5,subEnd:0,pay:[],menu:[],sales:[],portalOrgId:md.organization_id};
  if(isFinite(md.org_lat)&&md.org_lat!==null&&isFinite(md.org_lng)&&md.org_lng!==null){r.lat=Number(md.org_lat);r.lng=Number(md.org_lng);r.locationCapturedAt=Date.now()}
  d.rests.push(r);changed=true;
}else if(!r.portalOrgId){r.portalOrgId=md.organization_id;changed=true}
if(!u){
  /* « Ayouba Tanko » est réservé au propriétaire de la plateforme : jamais attribué à un compte partenaire */
  var nm=String(md.name||orgName).trim();if(nm.toLocaleLowerCase('fr')==='ayouba tanko')nm=orgName;
  u={id:uid(),role:'restaurant',phone:email,name:nm,restId:r.id,portalId:pu.id,email:email,staff:isStaff||undefined};
  d.users.push(u);changed=true;
}else{
  if(isStaff&&(!u.staff||u.disabled)){u.staff=true;u.disabled=false;changed=true}
  if(u.portalId!==pu.id){u.portalId=pu.id;changed=true}
  if(u.restId!==r.id){u.restId=r.id;changed=true}
}
if(changed)D.save(d);
sset('uid',u.id);
window.ZBRIDGE={fresh:true,userId:u.id};
/* Position GPS manquante (comptes créés avant ce correctif) : on la récupère en arrière-plan, sans bloquer la page */
if(r.lat==null&&s.access_token&&window.ZUMAYA_CONFIG){
  try{fetch(ZUMAYA_CONFIG.SUPABASE_URL+'/rest/v1/rg_organizations?id=eq.'+encodeURIComponent(md.organization_id)+'&select=latitude,longitude,address,contact_phone',
    {headers:{apikey:ZUMAYA_CONFIG.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access_token}})
   .then(function(x){return x.ok?x.json():[]}).then(function(a){var o=a&&a[0];if(!o||o.latitude==null)return;
     var d2=D.get(),r2=d2.rests.find(function(x){return x.id===r.id});if(!r2)return;
     r2.lat=Number(o.latitude);r2.lng=Number(o.longitude);r2.locationCapturedAt=Date.now();if(!r2.address&&o.address)r2.address=o.address;if(!r2.phone&&o.contact_phone)r2.phone=o.contact_phone;D.save(d2)}).catch(function(){})}catch(e){}
}
})();
