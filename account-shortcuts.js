/* ZUMUYA GROUP — raccourcis communs dans tous les espaces connectés */
(()=>{'use strict';
const path=(location.pathname.split('/').pop()||'').toLowerCase();
if(['index.html','resto-index.html','resto-card.html','compte.html'].includes(path)){} 
let session=null;
try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k)||'null');session=v&&(v.currentSession||v);if(session&&session.user)break;}}}catch(e){}
if(!session||!session.user)return;
/* Ne pas ajouter une seconde barre aux pages qui possèdent déjà leur propre navigation. */
if(document.querySelector('nav, [role="navigation"], .dside, .tabs'))return;
if(document.getElementById('zg-common-shortcuts'))return;
const css=document.createElement('style');css.textContent=`
#zg-common-shortcuts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 12px;background:#f3f6fa;border-bottom:1px solid #dce4ed;z-index:40}
#zg-common-shortcuts a{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;text-decoration:none;font:700 13px system-ui;color:#14213d;background:#fff;border:1px solid #dce4ed}
#zg-common-shortcuts a.primary{background:#14213d;color:#fff;border-color:#14213d}
@media(max-width:520px){#zg-common-shortcuts{gap:6px;padding:7px}#zg-common-shortcuts a{font-size:12px;padding:7px 9px}}
`;document.head.appendChild(css);
const bar=document.createElement('nav');bar.id='zg-common-shortcuts';bar.setAttribute('aria-label','Raccourcis du compte');
bar.innerHTML='<a class="primary" href="mes-commandes.html">🛍️ Mes commandes</a><a href="portefeuille.html">👛 Portefeuille</a><a href="historique.html">📊 Historique & rapports</a><a href="catalogues.html">📚 Catalogues publics</a>';
const header=document.querySelector('header');
if(header&&header.parentNode)header.parentNode.insertBefore(bar,header.nextSibling);
else document.body.insertBefore(bar,document.body.firstChild);
})();