/* Gestion des pôles autonomes du compte unique ZUMUYA GROUP. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const ICONS={restaurant:'🍽️',hotel:'🏨',agro:'🌾',marketplace:'🛍️',delivery:'🚚'};
const ROUTES={restaurant:'zrestaurant-restaurant.html?portal=restaurant#home',hotel:'zrestaurant-restaurant.html?portal=hotel#hotel',agro:'agro.html',marketplace:'marketplace.html',delivery:'livraison.html'};
let client=null,user=null,catalog=[],enabled=[],orgs=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(t,good=false){const el=$('#moduleMsg');if(el){el.textContent=t;el.className='module-msg '+(good?'good':'');}}
function currentOrg(code){const types={restaurant:['restaurant','restauration'],hotel:['hotel'],agro:['agro','agro_producer','agro_trader'],marketplace:['marketplace'],delivery:['delivery_service','delivery','logistics']};return orgs.find(o=>(types[code]||[]).includes(o.organization_type))||null;}
function render(){const root=$('#moduleGrid');if(!root)return;
 root.innerHTML=catalog.map(m=>{const mine=enabled.find(x=>x.module_code===m.module_code);const on=!!mine&&mine.status==='active';const available=m.rollout_status==='available';const org=currentOrg(m.module_code);const state=on?'Activité activée':mine?.status==='paused'?'En pause':m.rollout_status==='maintenance'?'Maintenance':available?'Disponible':'Bientôt disponible';
 return `<article class="module-config-card"><div class="module-config-icon">${ICONS[m.module_code]||'✦'}</div><div class="module-config-body"><h3>${esc(m.label)}</h3><p>${esc(m.description||'Espace professionnel autonome et connecté aux autres pôles.')}</p><small>${esc(state)}${org?' · '+esc(org.public_name):''}</small></div><div class="module-config-actions">${on?`<button type="button" data-pause="${esc(m.module_code)}" class="module-config-btn secondary">Mettre en pause</button>`:available?`<button type="button" data-enable="${esc(m.module_code)}" class="module-config-btn">Activer ce pôle</button>`:`<button type="button" class="module-config-btn secondary" disabled>À venir</button>`}${on&&ROUTES[m.module_code]?`<a href="${ROUTES[m.module_code]}" class="module-open-link">Ouvrir l’espace →</a>`:''}</div></article>`}).join('')||'<p>Aucun pôle disponible.</p>';
}
async function load(){if(!client||!user)return;const root=$('#moduleGrid');if(root)root.innerHTML='<p>Chargement des pôles…</p>';
 try{const [a,b,c]=await Promise.all([client.from('rg_module_catalog').select('module_code,label,description,rollout_status,sort_order').order('sort_order'),client.from('rg_user_modules').select('module_code,status,configuration').eq('user_id',user.id),client.from('rg_organizations').select('id,public_name,organization_type').eq('owner_id',user.id)]);if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;catalog=a.data||[];enabled=b.data||[];orgs=c.data||[];render();}
 catch(e){if(root)root.innerHTML='<p>Impossible de charger les pôles. Exécutez la migration 16 de l’écosystème puis actualisez.</p>';message(e.message||'Erreur de chargement.');}
}
async function enable(code){message('');try{const org=currentOrg(code);const r=await client.rpc('rg_ecosystem_set_module',{p_module:code,p_org:org?.id||null,p_configuration:{},p_status:'active'});if(r.error)throw r.error;await load();message('Pôle activé. Son espace reste indépendant et peut collaborer avec les autres pôles.',true);}catch(e){message(e.message||'Activation impossible.');}}
async function pause(code){message('');try{const org=currentOrg(code);const r=await client.rpc('rg_ecosystem_set_module',{p_module:code,p_org:org?.id||null,p_configuration:{},p_status:'paused'});if(r.error)throw r.error;await load();message('Pôle mis en pause. Ses données sont conservées.',true);}catch(e){message(e.message||'Modification impossible.');}}
document.addEventListener('click',e=>{const a=e.target.closest('[data-enable]'),p=e.target.closest('[data-pause]');if(a)enable(a.dataset.enable);if(p)pause(p.dataset.pause);});
window.ZUMAYA_MODULE_MANAGER={init:(sb,u)=>{client=sb;user=u;load();},refresh:load};
})();
