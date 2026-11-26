/* ZUMUYA GROUP — accès rapide aux rapports de l'espace professionnel */
(()=>{'use strict';
 if(document.querySelector('[data-zumuya-analytics-link]')) return;
 const a=document.createElement('a');
 a.href='analytics.html'; a.textContent='↗ Rapports & statistiques';
 a.setAttribute('data-zumuya-analytics-link','');
 a.setAttribute('aria-label','Ouvrir les rapports et statistiques de mon activité');
 a.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9998;background:#102b45;color:#fff;padding:12px 16px;border-radius:999px;text-decoration:none;font:700 13px/1.2 system-ui;box-shadow:0 6px 22px #102b4538;border:1px solid #ffffff30';
 document.body.appendChild(a);
})();
