/* ZUMUYA GROUP — service worker commun au portail et au module Restauration.
   Cache versionné : toutes les pages et dépendances statiques du dépôt sont préchargées.
   Stratégie réseau d’abord, cache en secours hors ligne. */
const CACHE='zumuya-v33-20261124-hospitality-native';
const FILES=[
  './agro-collaboration.js',
  './agro.css',
  './agro.html',
  './agro.js',
  './analytics.html',
  './zanalytics.css',
  './zanalytics.js',
  './app.js',
  './catalogue.js',
  './client-espace.html',
  './client-espace.js',
  './compte.css',
  './compte.html',
  './compte.js',
  './dashboard.css',
  './dashboard.js',
  './hospitality.html',
  './hospitality.css',
  './hospitality.js',
  './hospitality-catalog.html',
  './hospitality-catalog.js',
  './config.js',
  './hotel.html',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './index.html',
  './livraison.html',
  './messagerie.html',
  './marketplace.html',
  './market.js',
  './market.css',
  './boutique.html',
  './boutique.js',
  './boutique.css',
  './messagerie.js',
  './logo.svg',
  './manifest.webmanifest',
  './modules.js',
  './parametres.html',
  './parametres.js',
  './proprietaire.css',
  './proprietaire.html',
  './proprietaire.js',
  './restauration.html',
  './zrestaurant-apercu-facebook.jpg',
  './zrestaurant-card.html',
  './zrestaurant-charts.js',
  './zrestaurant-chat.js',
  './zrestaurant-client.html',
  './zrestaurant-db.js',
  './zrestaurant-driver.html',
  './zrestaurant-ext-core.js',
  './zrestaurant-ext-dispatch.js',
  './zrestaurant-ext-kds.js',
  './zrestaurant-ext-loader.js',
  './zrestaurant-ext-realtime.js',
  './zrestaurant-ext-room-billing.js',
  './zrestaurant-ext-tracking.js',
  './zrestaurant-icon-192.png',
  './zrestaurant-icon-512.png',
  './zrestaurant-icon-maskable-192.png',
  './zrestaurant-icon-maskable-512.png',
  './zrestaurant-index.html',
  './zrestaurant-manifest.webmanifest',
  './zrestaurant-notif.js',
  './zrestaurant-owner-pro.js',
  './zrestaurant-owner.html',
  './zrestaurant-portal-bridge.js',
  './zrestaurant-qr.js',
  './zrestaurant-rest-report.js',
  './zrestaurant-restaurant.html',
  './zrestaurant-splash.js',
  './zrestaurant-version.json',
  './styles.css',
  './wallet.js',
  './sw.js',
  './zcart.css',
  './zcart.js',
  './zteam.js',
  './zsupply.js',
  './zdelivery.js',
  './zchat.js',
  './livraison-pro.js',
  './livraison-entreprise.html',
  './zguard.js',
  './zservice.css',
  './zsession.js'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>null)))));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('zumaya-portal-')||k.startsWith('zumuya-restaurant-static-')||k.startsWith('zumuya-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==self.location.origin)return;
  e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
    return res;
  }).catch(()=>caches.match(r).then(hit=>{
    if(hit)return hit;
    if(r.mode==='navigate'){
      const path=u.pathname.split('/').pop()||'index.html';
      const fallback=path.startsWith('zrestaurant-')?'./zrestaurant-index.html':'./index.html';
      return caches.match(fallback);
    }
    return Response.error();
  })));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c)return c.focus()}
    return self.clients.openWindow('./zrestaurant-index.html');
  }));
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data.json()}catch(_){}
  e.waitUntil(self.registration.showNotification(d.title||'ZUMUYA', {body:d.body||'',icon:'./icon-192.png',badge:'./icon-192.png',data:d}));
});
