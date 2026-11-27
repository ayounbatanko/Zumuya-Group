/* ZUMUYA GROUP — accès communs ajoutés sans dupliquer les liens déjà présents. */
(()=>{'use strict';
 let session=null;
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null');session=v&&(v.currentSession||v);if(session&&session.user)break;}}}catch(e){}
 if(!session||!session.user||document.getElementById('zg-common-shortcuts'))return;
 const page=(location.pathname.split('/').pop()||'').toLowerCase();
 /* Bouton de retour sans déconnexion : conserve la session Supabase. */
 if(!['compte.html','index.html',''].includes(page)&&!document.getElementById('zg-account-back')){
  const back=document.createElement('a');back.id='zg-account-back';back.href='compte.html';back.textContent='← Retour à mon compte ZUMUYA';
  back.style.cssText='position:fixed;top:10px;left:10px;z-index:100001;background:#14213d;color:#fff;border:1px solid #ffffff55;border-radius:12px;padding:10px 14px;text-decoration:none;font:700 12px system-ui;box-shadow:0 4px 14px #0003;max-width:calc(100vw - 20px)';
  document.body.appendChild(back);
 }
 if(['zrestaurant-restaurant.html','zrestaurant-restogest.html','hotel.html','hotel-gestion.html'].includes(page))return;
 const items=[
  {href:'mes-commandes.html',label:'🛍️ Toutes mes commandes',key:'orders',skip:['mes-commandes.html']},
  {href:'portefeuille.html',label:'👛 Portefeuille commun',key:'wallet',skip:['portefeuille.html']},
  {href:'historique.html',label:'📊 Historique global',key:'history',skip:['historique.html']}
 ];
 const hasHref=href=>{const target=new URL(href,location.href).pathname;return [...document.querySelectorAll('a[href]')].some(a=>{try{return new URL(a.getAttribute('href'),location.href).pathname===target}catch(e){return false}})};
 const hasWallet=()=>hasHref('portefeuille.html')||!!document.querySelector('[data-view="wallet"],[data-t="wallet"]');
 const hasHistory=()=>hasHref('historique.html')||!!document.querySelector('[data-view="history"],[data-t="history"]');
 const visible=items.filter(x=>{
  if(x.skip.includes(page))return false;
  if(x.key==='wallet'&&hasWallet())return false;
  if(x.key==='history'&&hasHistory())return false;
  if(x.key==='orders'&&hasHref(x.href))return false;
  return true;
 });
 if(!visible.length)return;
 const css=document.createElement('style');css.textContent=`
 #zg-common-shortcuts{display:flex;gap:7px;flex-wrap:wrap;align-items:center;padding:8px 10px;margin:8px 0;background:#f3f6fa;border:1px solid #dce4ed;border-radius:12px}
 #zg-common-shortcuts .zg-common-label{font:800 10px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#65748b;margin-right:3px}
 #zg-common-shortcuts a{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:9px;text-decoration:none;font:700 12px system-ui;color:#14213d;background:#fff;border:1px solid #dce4ed}
 #zg-common-shortcuts a:focus-visible{outline:2px solid #f4b400;outline-offset:2px}
 @media(max-width:520px){#zg-common-shortcuts{gap:5px;padding:7px}#zg-common-shortcuts a{font-size:11px;padding:7px 8px}}
 `;document.head.appendChild(css);
 const bar=document.createElement('div');bar.id='zg-common-shortcuts';bar.setAttribute('aria-label','Accès communs du compte');
 const label=document.createElement('span');label.className='zg-common-label';label.textContent='Accès communs';bar.appendChild(label);
 visible.forEach(x=>{const a=document.createElement('a');a.href=x.href;a.textContent=x.label;bar.appendChild(a)});
 const nav=document.querySelector('.dside, nav, [role="navigation"], .tabs'),header=document.querySelector('header');
 if(header&&nav&&header.contains(nav)&&header.parentNode)header.parentNode.insertBefore(bar,header.nextSibling);
 else if(nav&&nav.parentNode)nav.parentNode.insertBefore(bar,nav.nextSibling);
 else if(header&&header.parentNode)header.parentNode.insertBefore(bar,header.nextSibling);
 else document.body.insertBefore(bar,document.body.firstChild)
})();