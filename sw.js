/* ZUMUYA GROUP — service worker (réseau d'abord, cache en secours hors ligne) */
const CACHE='zumaya-portal-v7';
const FILES=['./','./index.html','./compte.html','./styles.css?v=4','./modules.js?v=4','./app.js?v=4','./compte.css?v=3','./compte.js?v=3','./logo.svg','./icon-192.png','./manifest.webmanifest','./config.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('zumaya-portal-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res})
    .catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
