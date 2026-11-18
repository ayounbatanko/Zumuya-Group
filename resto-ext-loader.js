/* Service de Restauration v2 - chargeur unique des extensions. Ajouter dans chaque page, APRÈS resto-db.js :
   <script src="resto-ext-loader.js"></script>                                                       */
(function(){
/* ===== CONFIGURATION ===== */
window.RGX_SUPABASE_URL=(window.ZUMAYA_CONFIG||{}).SUPABASE_URL;
window.RGX_ANON_KEY=(window.ZUMAYA_CONFIG||{}).SUPABASE_ANON_KEY;  /* clé publique anon, lue dans config.js */
window.RGX_VAPID='';                                      /* clé publique VAPID (voir README_V2) ; vide = push désactivé */
window.RGX_PUSH_URL=window.RGX_SUPABASE_URL+'/functions/v1/push-notify';
var ON={reviews:1,promo:1,dispatch:1,tracking:1,kds:1,stock:1,'room-billing':1,theme:1,stats:1,realtime:1,push:0,'auth-bridge':0};
/* ========================= */
var base=document.currentScript.src.replace(/[^\/]*$/,'');
function load(n,cb){var s=document.createElement('script');s.src=base+'resto-ext-'+n+'.js';s.onload=cb;s.onerror=cb;document.head.appendChild(s)}
load('core',function(){Object.keys(ON).forEach(function(k){if(ON[k])load(k)})});
})();
