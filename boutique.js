(()=>{'use strict';
const $=s=>document.querySelector(s);let sb,user,org,products=[];
function msg(t){$('#formMessage').textContent=t||''}
function switchTab(name){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='tab-'+name)}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)switchTab(b.dataset.tab)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)switchTab(b.dataset.go)});
async function init(){
 if(!window.ZUMAYA_CONFIG?.SUPABASE_URL||!window.supabase)throw new Error('Configuration Supabase absente.');
 sb=window.supabase.createClient(ZUMAYA_CONFIG.SUPABASE_URL,ZUMAYA_CONFIG.SUPABASE_ANON_KEY);
 const {data,error}=await sb.auth.getUser();if(error||!data.user){location.replace('compte.html');return}user=data.user;
 const {data:rows,error:orgError}=await sb.from('rg_organizations').select('id,public_name,city,address,organization_type,verification_status').eq('owner_id',user.id).eq('organization_type','commerce').order('created_at',{ascending:false}).limit(1);
 if(orgError)throw orgError;org=rows?.[0];if(!org){location.replace('compte.html');return}
 $('#storeName').textContent=org.public_name||'Ma boutique';$('#storeMeta').textContent=[org.city,org.address].filter(Boolean).join(' · ')||'Votre espace commerçant';$('#storeStatus').textContent='Espace actif';
 $('#settingName').textContent=org.public_name||'—';$('#settingCity').textContent=org.city||'—';$('#settingAddress').textContent=org.address||'—';
 await loadProducts();
}
async function loadProducts(){const {data,error}=await sb.from('rg_commerce_products').select('*').eq('organization_id',org.id).order('created_at',{ascending:false});if(error)throw error;products=data||[];render();}
function render(){
 $('#statProducts').textContent=products.length;$('#statActive').textContent=products.filter(p=>p.is_active).length;$('#statStock').textContent=products.reduce((n,p)=>n+(Number(p.stock_quantity)||0),0);
 $('#productList').innerHTML=products.length?products.map(p=>`<article class="product"><div><b>${esc(p.title)}</b><small>${money(p.price)} · Stock : ${p.stock_quantity} · ${p.is_active?'Visible':'Masqué'}</small></div><div class="product-actions"><button data-edit="${p.id}">Modifier</button><button data-delete="${p.id}">Supprimer</button></div></article>`).join(''):'<p class="empty">Aucun produit. Ajoutez votre premier article.</p>';
 $('#stockList').innerHTML=products.length?products.map(p=>`<article class="stock-row"><div><b>${esc(p.title)}</b><small>${money(p.price)}</small></div><b>${p.stock_quantity} unité(s)</b></article>`).join(''):'<p class="empty">Aucun stock enregistré.</p>';
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(v){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(v)||0)+' XOF'}
function openProduct(p){$('#productForm').reset();$('#productId').value=p?.id||'';$('#dialogTitle').textContent=p?'Modifier le produit':'Ajouter un produit';$('#productTitle').value=p?.title||'';$('#productDescription').value=p?.description||'';$('#productPrice').value=p?.price??'';$('#productStock').value=p?.stock_quantity??0;$('#productActive').checked=p?.is_active??true;msg('');$('#productDialog').showModal()}
$('#addProduct').addEventListener('click',()=>openProduct());$('#closeDialog').addEventListener('click',()=>$('#productDialog').close());
$('#productList').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit){openProduct(products.find(p=>p.id===edit.dataset.edit));return}if(del&&confirm('Supprimer ce produit ?')){const {error}=await sb.from('rg_commerce_products').delete().eq('id',del.dataset.delete).eq('organization_id',org.id);if(error){alert(error.message);return}await loadProducts()}});
$('#productForm').addEventListener('submit',async e=>{e.preventDefault();msg('');const id=$('#productId').value;const payload={organization_id:org.id,title:$('#productTitle').value.trim(),description:$('#productDescription').value.trim()||null,price:Number($('#productPrice').value),stock_quantity:Number($('#productStock').value),is_active:$('#productActive').checked,updated_at:new Date().toISOString()};if(!payload.title||payload.price<0||payload.stock_quantity<0)return msg('Vérifiez le nom, le prix et le stock.');$('#saveProduct').disabled=true;try{const q=id?sb.from('rg_commerce_products').update(payload).eq('id',id).eq('organization_id',org.id):sb.from('rg_commerce_products').insert(payload);const {error}=await q;if(error)throw error;$('#productDialog').close();await loadProducts()}catch(err){msg(err.message||'Enregistrement impossible.')}finally{$('#saveProduct').disabled=false}});
$('#logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('compte.html')});
init().catch(err=>{console.error(err);$('#storeMeta').textContent=err.message||'Impossible de charger la boutique.'});
})();
