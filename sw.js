/* ZUMUYA GROUP — service worker UNIQUE (portail + Service de Restauration).
   Réseau d'abord, cache en secours hors ligne. Gère aussi les notifications push. */
const CACHE='zumuya-v2';
const FILES=['./','./index.html','./compte.html','./styles.css?v=4','./modules.js?v=5','./app.js?v=5','./compte.css?v=4','./compte.js?v=4','./logo.svg','./icon-192.png','./manifest.webmanifest','./config.js','./proprietaire.html','./proprietaire.css','./proprietaire.js','./resto-index.html','./resto-owner.html','./resto-restaurant.html','./resto-client.html','./resto-driver.html','./resto-card.html','./resto-manifest.webmanifest','./resto-icon-192.png','./resto-icon-512.png','./resto-version.json','./resto-db.js','./resto-notif.js','./resto-chat.js','./resto-owner-pro.js','./resto-splash.js','./resto-charts.js','./resto-qr.js','./resto-rest-report.js','./resto-ext-loader.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>(x.startsWith('zumaya-portal-')||x.startsWith('restogest-static-')||x.startsWith('zumuya-'))&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  const resto=/\/resto-[^/]*$/.test(u.pathname);
  e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res})
    .catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match(resto?'./resto-index.html':'./index.html'):Response.error()))));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c)return c.focus()}return self.clients.openWindow('./resto-index.html')}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){}e.waitUntil(self.registration.showNotification(d.title||'Service de Restauration',{body:d.body||'',icon:'./resto-icon-192.png',badge:'./resto-icon-192.png',data:d}))});
