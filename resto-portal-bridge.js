/* Pont portail -> Service de Restauration.
   Un restaurant (ou hôtel) qui s'est connecté sur le portail avec son e-mail et son mot de passe (Supabase Auth)
   est reconnu ici automatiquement : on retrouve ou on crée son compte local + sa fiche restaurant, puis on ouvre
   la session. Plus de deuxième écran de connexion.
   À charger APRÈS resto-db.js et AVANT le script de la page. */
(function(){'use strict';
var D=window.RGDB;if(!D)return;
var page=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
var isIndex=page===''||page==='resto-index';
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
if(type!=='restaurant'&&type!=='hotel')return;
if(!md.organization_id)return;            /* fiche partenaire pas encore créée : le portail la demande */
var fromPortal=sget('zmy_portal')==='1';
if(isIndex&&!fromPortal)return;           /* sur l'écran de connexion, seulement juste après une connexion portail */
var d=D.get(),cur=sget('uid'),curU=cur&&d.users.find(function(x){return x.id==cur&&!x.disabled});
if(curU&&(curU.portalId===pu.id||!fromPortal))return;   /* session déjà valable : on n'y touche pas */
var email=String(pu.email||'').toLowerCase();
var uid=function(){return Math.random().toString(36).slice(2,9)};
function slug(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
var u=d.users.find(function(x){return x.portalId===pu.id})||d.users.find(function(x){return x.role==='restaurant'&&email&&String(x.phone||'').toLowerCase()===email});
var r=u&&u.restId&&d.rests.find(function(x){return x.id===u.restId})||d.rests.find(function(x){return x.portalOrgId===md.organization_id});
var orgName=md.organization_name||md.name||'Mon restaurant';
var changed=false;
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
  u={id:uid(),role:'restaurant',phone:email,name:nm,restId:r.id,portalId:pu.id,email:email};
  d.users.push(u);changed=true;
}else{
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
