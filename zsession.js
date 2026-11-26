/* ZUMUYA GROUP — aide commune : session (portail + service), position, données publiques des restaurants. */
(()=>{'use strict';
const ZS=window.ZS={};
ZS.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Session du portail (Supabase Auth) : lue dans le stockage local, sans charger de bibliothèque. */
ZS.portal=()=>{try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null'),s=v&&(v.currentSession||v);
   if(s&&s.access_token&&s.refresh_token){const u=s.user||{};return{kind:'portal',type:(u.user_metadata&&u.user_metadata.account_type)||'',email:u.email||'',phone:u.phone||'',name:(u.user_metadata&&u.user_metadata.name)||u.phone||u.email||'Mon compte'}}}}}catch(e){}return null};
/* Session du Service (restaurant, hôtel, client, livreur) : ouverte dans cet onglet uniquement. */
ZS.resto=()=>{try{const id=sessionStorage.getItem('uid');if(!id)return null;const d=JSON.parse(localStorage.getItem('rm_db')||'null');
  const u=d&&(d.users||[]).find(x=>x.id==id);if(!u||u.disabled)return null;const r=u.restId?(d.rests||[]).find(x=>x.id==u.restId):null;
  return{kind:'resto',id:u.id,name:u.name,role:u.role,rest:r||null,isHotel:!!(r&&(r.businessType==='hotel'||(r.hotel&&r.hotel.enabled)))}}catch(e){return null}};
ZS.who=()=>ZS.portal()||ZS.resto();
ZS.connected=()=>!!ZS.who();
/* Données (lecture publique des restaurants et des commandes) */
const CF=()=>window.ZUMAYA_CONFIG||{};
async function rows(table,extra){const c=CF();if(!c.SUPABASE_URL)throw Error('Configuration Supabase absente');
  const r=await fetch(c.SUPABASE_URL+'/rest/v1/'+table+'?select=id,data'+(extra||''),{headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:'Bearer '+c.SUPABASE_ANON_KEY}});
  if(!r.ok)throw Error('Lecture impossible ('+r.status+')');return(await r.json()).map(x=>x.data).filter(Boolean)}
ZS.rests=()=>rows('rg_rests','&order=seq.asc');
ZS.orders=()=>rows('rg_orders','&order=seq.desc&limit=300').then(a=>a.filter(o=>o&&o.restId));
ZS.subOk=r=>{const n=Date.now();if(r.sub==='suspended')return false;if(r.sub==='active')return r.subEnd>n;return r.trialEnd>n};
ZS.isHotel=r=>!!(r&&(r.businessType==='hotel'||(r.hotel&&r.hotel.enabled)));
ZS.km=(a,b)=>{const R=6371,q=x=>x*Math.PI/180,dl=q(b[0]-a[0]),dn=q(b[1]-a[1]),h=Math.sin(dl/2)**2+Math.cos(q(a[0]))*Math.cos(q(b[0]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
ZS.money=(v,c)=>{v=+v||0;if(!c||c==='XOF'||c==='XAF')return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(v)+' FCFA';try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(v)}catch(e){return v+' '+c}};
ZS.fee=(r,d)=>{const kp=+r.kmPrice||0;if(d==null||!(kp>0))return null;const dec=(!r.currency||r.currency==='XOF'||r.currency==='XAF')?0:2;return+(d*kp).toFixed(dec)};
ZS.locate=()=>new Promise((ok,ko)=>{if(!navigator.geolocation)return ko(Error('nogeo'));navigator.geolocation.getCurrentPosition(p=>ok([p.coords.latitude,p.coords.longitude]),ko,{enableHighAccuracy:true,timeout:15000,maximumAge:60000})});
ZS.dist=d=>d==null?'':d<1?Math.round(d*1000)+' m':d.toFixed(1)+' km';
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
