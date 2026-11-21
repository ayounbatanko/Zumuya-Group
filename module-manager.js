/* Gestion des pôles du compte unique ZUMAYA — utilise uniquement les tables RLS du projet. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const ICONS={restauration:'🍽️',hotel:'🏨',agro:'🌾',marketplace:'🛍️',livraison:'📦',transport:'🚕',prestations:'🧰',evenements:'🎟️',commerce:'🏪',voyage:'🧭',paiement:'💳',entreprise:'📊'};
const ROUTES={restauration:'resto-client.html',hotel:'hotel.html',agro:'agro.html',marketplace:'marketplace.html',livraison:'livraison.html',transport:'#',prestations:'#',evenements:'#',commerce:'#',voyage:'#',paiement:'#',entreprise:'#'};
let client=null,user=null,catalog=[],enabled=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(t,good=false){const el=$('#moduleMsg');if(el){el.textContent=t;el.className='module-msg '+(good?'good':'');}}
function render(){const root=$('#moduleGrid');if(!root)return;
 root.innerHTML=catalog.map(m=>{const mine=enabled.find(x=>x.module_code===m.module_code);const on=!!mine&&mine.status!=='paused'&&mine.status!=='suspended';const available=m.rollout_status==='available';const state=on?'Activité activée':mine?.status==='paused'?'En pause':m.rollout_status==='maintenance'?'Maintenance':available?'Disponible':'Bientôt disponible';
 return `<article class="module-config-card"><div class="module-config-icon">${ICONS[m.module_code]||'✦'}</div><div class="module-config-body"><h3>${esc(m.label)}</h3><p>${esc(m.description||'Configurez cette activité depuis votre compte unique.')}</p><small>${esc(state)}</small></div><div class="module-config-actions">${on?`<button type="button" data-pause="${esc(m.module_code)}" class="module-config-btn secondary">Mettre en pause</button>`:available?`<button type="button" data-enable="${esc(m.module_code)}" class="module-config-btn">Activer</button>`:`<button type="button" class="module-config-btn secondary" disabled>${m.rollout_status==='maintenance'?'Indisponible':'À venir'}</button>`}${on&&ROUTES[m.module_code]&&ROUTES[m.module_code]!=='#'?`<a href="${ROUTES[m.module_code]}" class="module-open-link">Ouvrir →</a>`:''}</div></article>`}).join('')||'<p>Aucun pôle n’est actuellement disponible.</p>';
}
async function load(){if(!client||!user)return;const root=$('#moduleGrid');if(root)root.innerHTML='<p>Chargement des pôles…</p>';
 try{const [a,b]=await Promise.all([client.from('rg_module_catalog').select('module_code,label,description,rollout_status,sort_order').order('sort_order'),client.from('rg_user_modules').select('module_code,status,configuration').eq('user_id',user.id)]);if(a.error)throw a.error;if(b.error)throw b.error;catalog=a.data||[];enabled=b.data||[];render();}
 catch(e){if(root)root.innerHTML='<p>Impossible de charger les pôles. Vérifiez les autorisations Supabase (RLS) et la connexion.</p>';message(e.message||'Erreur de chargement.');}
}
async function enable(code){message('');try{const existing=enabled.find(x=>x.module_code===code);let q;if(existing)q=await client.from('rg_user_modules').update({status:'active'}).eq('user_id',user.id).eq('module_code',code);else q=await client.from('rg_user_modules').insert({user_id:user.id,module_code:code,status:'active',configuration:{}});if(q.error)throw q.error;await load();message('Pôle activé. Tu peux maintenant accéder à son espace.',true);}catch(e){message(e.message||'Activation impossible.');}}
async function pause(code){message('');try{const r=await client.from('rg_user_modules').update({status:'paused'}).eq('user_id',user.id).eq('module_code',code);if(r.error)throw r.error;await load();message('Pôle mis en pause.',true);}catch(e){message(e.message||'Modification impossible.');}}
document.addEventListener('click',e=>{const a=e.target.closest('[data-enable]'),p=e.target.closest('[data-pause]');if(a)enable(a.dataset.enable);if(p)pause(p.dataset.pause);});
window.ZUMAYA_MODULE_MANAGER={init:(sb,u)=>{client=sb;user=u;load();},refresh:load};
})();
