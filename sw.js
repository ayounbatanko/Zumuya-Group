/* ZUMUYA GROUP — service worker commun au portail et aux pôles métier.
   Précharge uniquement les pages et dépendances natives ZUMUYA.
   Réseau d'abord, cache en secours hors ligne. */
const CACHE='zumuya-v62-20261127';;;;;;;
const FILES=[
 './index.html','./reseau-social.html','./reseau-social.css','./reseau-social.js','./compte.html','./compte.css','./compte.js','./config.js','./zguard.js','./zsession.js',
 './dashboard.css','./dashboard.js','./module-manager.js','./modules.js','./parametres.html','./parametres.js',
 './proprietaire.html','./proprietaire.css','./proprietaire.js',
 './client-espace.html','./client-espace.js','./mes-commandes.html','./historique.html','./portefeuille.html','./catalogues.html','./catalogue.js',
 './marketplace.html','./market.js','./market.css','./boutique.html','./boutique.js','./boutique.css',
 './agro.html','./agro.js','./agro.css','./agro-collaboration.js','./zsupply.js',
 './restauration.html','./hotels-public.html','./hotel.html','./zrestaurant-restogest.html','./hospitality.html','./hospitality.css','./hospitality.js','./hospitality-catalog.html','./hospitality-catalog.js','./livraison.html','./livraison-entreprise.html','./livraison-pro.js',
 './messagerie.html','./messagerie.js','./ecosysteme.html',
 './wallet.js','./account-shortcuts.js','./catalogue.js','./zcart.js','./zcart.css','./zchat.js','./zteam.js','./zdelivery.js','./zservice.css','./logo.svg',
 './manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./icon-maskable-512.png',
 './restaurant-gestion.html','./hotel-gestion.html','./zrh.css','./zrh-native.js','./zrestaurant-index.html','./zrestaurant-restaurant.html','./zrestaurant-client.html','./zrestaurant-driver.html','./zrestaurant-card.html',
 './zrestaurant-db.js','./zrestaurant-portal-bridge.js','./zrestaurant-notif.js','./zrestaurant-chat.js','./zrestaurant-charts.js','./zrestaurant-qr.js','./zrestaurant-rest-report.js',
 './zrestaurant-ext-loader.js','./zrestaurant-ext-core.js','./zrestaurant-ext-dispatch.js','./zrestaurant-ext-tracking.js','./zrestaurant-ext-kds.js','./zrestaurant-ext-room-billing.js','./zrestaurant-ext-realtime.js',
 './zrestaurant-splash.js','./zrestaurant-version.json','./zrestaurant-manifest.webmanifest','./zrestaurant-icon-192.png','./zrestaurant-icon-512.png','./zrestaurant-icon-maskable-192.png','./zrestaurant-icon-maskable-512.png','./zrestaurant-apercu-facebook.jpg',
 './styles.css','./app.js','./sw.js'
];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>null)))));
 self.skipWaiting();
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('zumuya-')||/^resto.*static-/.test(k))).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==self.location.origin)return;
 e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{
  if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
  return res;
 }).catch(()=>caches.match(r,{ignoreSearch:true}).then(hit=>{
  if(hit)return hit;
  if(r.mode==='navigate' && (u.pathname.endsWith('/index.html')||u.pathname.endsWith('/')))return caches.match('./index.html');
  if(r.mode==='navigate')return new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page indisponible</title><body style="font:16px system-ui;padding:24px"><h2>Page temporairement indisponible</h2><p>Vérifiez votre connexion Internet puis rechargez cette page.</p><a href="./index.html">Retour à ZUMUYA GROUP</a></body></html>',{status:503,headers:{'Content-Type':'text/html;charset=utf-8'}});
  return Response.error();
 })));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  for(const c of list){if('focus' in c)return c.focus()}
  return self.clients.openWindow('./compte.html');
 }));
});
self.addEventListener('push',e=>{
 let d={};try{d=e.data.json()}catch(_){}
 e.waitUntil(self.registration.showNotification(d.title||'ZUMUYA GROUP',{body:d.body||'',icon:'./icon-192.png',badge:'./icon-192.png',data:d}));
});
