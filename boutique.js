(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const cfg=window.ZUMAYA_CONFIG||{},BUCKET='commerce-media';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0);
const money=n=>num(n)+' FCFA';
const compact=v=>{v=Number(v)||0;return v>=1e6?(v/1e6).toFixed(v%1e6?1:0).replace('.',',')+' M':v>=1e3?(v/1e3).toFixed(v%1e3?1:0).replace('.',',')+' k':String(Math.round(v))};
const fdate=d=>new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
const LBL={pending:'En attente',confirmed:'Confirmée',shipped:'Expédiée',delivered:'Livrée',cancelled:'Annulée'};
const SCOL={pending:'#c89d50',confirmed:'#1d57a6',shipped:'#7a4bb8',delivered:'#12a36b',cancelled:'#c0392b'};
const PST={active:['Publié',''],draft:['Brouillon','warn'],archived:['Archivé','off']};
let sb,user,stores=[],store=null,products=[],categories=[],period=30,stats=null,pstats=null,statProduct='',editing=null,keep={images:[],videos:[]},orderFilter='all',draws=[];
const notice=$('#notice');
const say=(el,t)=>{el.textContent=t||''};
const show=(id,on)=>{$(id).hidden=!on};
const fobj=f=>Object.fromEntries(new FormData(f).entries());

/* ---------- Démarrage ---------- */
async function init(){
  try{
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)throw Error('Configuration Supabase absente.');
    if(!window.supabase?.createClient)throw Error('Bibliothèque Supabase indisponible. Vérifiez votre connexion.');
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data,error}=await sb.auth.getSession();if(error)throw error;
    user=data.session?.user||null;
    if(!user){say(notice,'');notice.hidden=true;show('#gate',true);return}
    await Promise.all([loadCategories(),loadStores()]);
    notice.hidden=true;
  }catch(e){say(notice,e.message||'Chargement impossible.')}
}
async function loadCategories(){
  const {data}=await sb.from('commerce_categories').select('id,name').eq('is_active',true).order('name');
  categories=data||[];
  $('#productCategory').innerHTML='<option value="">Sans catégorie</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
async function loadStores(selectId){
  const {data,error}=await sb.from('commerce_stores').select('*').eq('owner_id',user.id).order('created_at',{ascending:false});
  if(error)throw error;stores=data||[];
  if(!stores.length){show('#app',false);show('#create',true);return}
  show('#create',false);show('#app',true);
  const saved=selectId||localStorage.getItem('zm_store');
  store=stores.find(s=>s.id===saved)||stores[0];
  try{localStorage.setItem('zm_store',store.id)}catch(_){}
  $('#storeSelect').innerHTML=stores.map(s=>`<option value="${s.id}" ${s.id===store.id?'selected':''}>${esc(s.store_name)}</option>`).join('');
  $('#storeSelect').hidden=stores.length<2;
  renderStoreHead();fillProfile();
  await Promise.all([loadProducts(),loadStats()]);
  renderOverview();renderStatsPane();loadPendingBadge();
}
function renderStoreHead(){
  $('#storeName').textContent=store.store_name;
  $('#storeCity').textContent=[store.city,store.phone].filter(Boolean).join(' · ');
  const b=$('#storeBadge');
  if(!store.is_active){b.textContent='Fermée';b.className='chip off'}else if(store.verification_status==='verified'){b.textContent='Active';b.className='chip'}else{b.textContent='En attente';b.className='chip warn'}
  const l=$('#storeLogo');if(store.logo_url){l.src=store.logo_url;l.hidden=false}else l.hidden=true;
  $('#viewShop').href='marketplace.html?store='+encodeURIComponent(store.id);
}

/* ---------- Onglets ---------- */
$$('.tab').forEach(t=>t.addEventListener('click',()=>go(t.dataset.pane)));
function go(p){
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.pane===p));
  $$('.pane').forEach(x=>x.classList.toggle('active',x.id==='pane-'+p));
  if(p==='orders')loadOrders();
  if(p==='overview')renderOverview();
  if(p==='stats')renderStatsPane();
  requestAnimationFrame(redraw);
  window.scrollTo({top:0,behavior:'smooth'});
}
$('#storeSelect').addEventListener('change',e=>{statProduct='';loadStores(e.target.value).catch(x=>say(notice,x.message))});
$('#newStore').addEventListener('click',()=>{show('#app',false);show('#create',true);window.scrollTo(0,0)});

/* ---------- Création de boutique ---------- */
$('#createForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=fobj(e.currentTarget),st=$('#createState'),btn=e.submitter;
  try{
    btn.disabled=true;say(st,'Création…');
    const {data,error}=await sb.from('commerce_stores').insert({store_name:f.store_name.trim(),store_type:f.store_type,market_type:f.market_type,city:f.city||null,phone:f.phone||null,description:f.description||null,owner_id:user.id,country_code:'CI',is_active:true}).select('id').single();
    if(error)throw error;
    e.currentTarget.reset();say(st,'');await loadStores(data.id);go('edit');startEdit(null);
  }catch(x){say(st,x.message)}finally{btn.disabled=false}
});

/* ---------- Statistiques ---------- */
async function loadStats(){
  const {data,error}=await sb.rpc('commerce_store_stats',{p_store:store.id,p_days:period,p_product:null});
  if(error){say(notice,'Statistiques indisponibles : '+error.message);notice.hidden=false;stats=null;pstats=null;return}
  stats=data;pstats=data;
  if(statProduct){const r=await sb.rpc('commerce_store_stats',{p_store:store.id,p_days:period,p_product:statProduct});if(!r.error)pstats=r.data}
}
$$('.period').forEach(box=>box.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-p]');if(!b)return;
  period=Number(b.dataset.p);$$('.period button').forEach(x=>x.classList.toggle('on',Number(x.dataset.p)===period));
  await loadStats();renderOverview();renderStatsPane();
}));
function trend(cur,prev){
  if(!prev&&!cur)return '<i class="flat">—</i>';
  if(!prev)return '<i class="up">▲ nouveau</i>';
  const p=Math.round((cur-prev)/prev*100);
  return p>0?`<i class="up">▲ +${p}%</i>`:p<0?`<i class="down">▼ ${p}%</i>`:'<i class="flat">= stable</i>';
}
function kpiHTML(s){
  const t=s.totals,p=s.previous,conv=t.views?Math.min(100,t.orders/t.views*100):null,avg=t.orders?t.revenue/t.orders:0;
  const k=[['Chiffre d’affaires',money(t.revenue),trend(t.revenue,p.revenue)],['Commandes',num(t.orders),trend(t.orders,p.orders)],['Visites produits',num(t.views),trend(t.views,p.views)],
    ['Taux de conversion',conv===null?'—':conv.toFixed(1).replace('.',',')+' %','<i class="flat">commandes / visites</i>'],['Panier moyen',money(avg),'<i class="flat">par commande</i>'],['Unités vendues',num(t.units),'<i class="flat">sur la période</i>'],
    ['Commandes à traiter',num(t.pending),'<i class="flat">en attente</i>'],['Produits actifs',num(t.active_products)+' / '+num(t.products),t.low_stock?`<i class="down">${t.low_stock} stock faible</i>`:'<i class="up">stock OK</i>']];
  return k.map(x=>`<div class="kpi"><span>${x[0]}</span><b>${x[1]}</b>${x[2]}</div>`).join('');
}
function renderOverview(){
  if(!stats)return;draws=draws.filter(d=>d.pane!=='overview');
  $('#kpis').innerHTML=kpiHTML(stats);
  const L=stats.daily.map(d=>fdate(d.d));
  addChart('overview','#chRevenue',L,stats.daily.map(d=>d.revenue),'area','#c89d50',v=>money(v));
  addChart('overview','#chViews',L,stats.daily.map(d=>d.views),'bar','#1d57a6',v=>num(v)+' visite(s)');
  addChart('overview','#chOrders',L,stats.daily.map(d=>d.orders),'bar','#12a36b',v=>num(v)+' commande(s)');
  renderDonut();
  const top=[...stats.products].sort((a,b)=>b.revenue-a.revenue||b.views-a.views).slice(0,5),mx=Math.max(1,...top.map(p=>p.revenue));
  $('#topProducts').innerHTML=top.length?top.map(p=>`<div class="hb"><span>${esc(p.title)}</span><b>${money(p.revenue)}</b><i style="width:${Math.max(3,p.revenue/mx*100)}%"></i></div>`).join(''):'<p class="muted">Publiez votre premier produit pour voir ses performances.</p>';
  renderAlerts();
}
function renderDonut(){
  const st=stats.statuses||[],tot=st.reduce((a,x)=>a+x.count,0),box=$('#donut');
  if(!tot){box.innerHTML='<p class="muted">Aucune commande sur la période.</p>';return}
  let off=0;const R=48,C=2*Math.PI*R;
  const arcs=st.map(x=>{const len=x.count/tot*C,s=`<circle r="${R}" cx="60" cy="60" fill="none" stroke="${SCOL[x.status]||'#999'}" stroke-width="20" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`;off+=len;return s}).join('');
  box.innerHTML=`<div class="donut"><svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Statuts des commandes">${arcs}<text x="60" y="65" text-anchor="middle" font-size="20" font-weight="800" fill="#10283d">${tot}</text></svg><ul>${st.map(x=>`<li><i style="background:${SCOL[x.status]||'#999'}"></i>${LBL[x.status]||x.status} — <b>${x.count}</b></li>`).join('')}</ul></div>`;
}
function renderAlerts(){
  const out=[],t=stats.totals;
  if(t.pending)out.push(`<div class="alert">🧾 ${t.pending} commande(s) à traiter — <a href="#" data-go="orders">Ouvrir</a></div>`);
  stats.products.filter(p=>p.status==='active'&&p.stock<=3).slice(0,4).forEach(p=>out.push(`<div class="alert">📦 Stock faible : <b>${esc(p.title)}</b> (${p.stock})</div>`));
  products.filter(p=>!p.image_url).slice(0,3).forEach(p=>out.push(`<div class="alert">📸 Ajoutez une photo à <b>${esc(p.title)}</b></div>`));
  products.filter(p=>p.status!=='active').slice(0,3).forEach(p=>out.push(`<div class="alert">👁️ « ${esc(p.title)} » n’est pas visible des clients</div>`));
  if(!products.length)out.push('<div class="alert">➕ Publiez votre premier produit — <a href="#" data-go="edit">Commencer</a></div>');
  $('#alerts').innerHTML=out.join('')||'<div class="alert ok">✅ Tout est en ordre.</div>';
  $$('#alerts [data-go]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const g=a.dataset.go;go(g);if(g==='edit')startEdit(null)}));
}
async function loadPendingBadge(){
  const {count}=await sb.from('commerce_orders').select('id',{count:'exact',head:true}).eq('store_id',store.id).eq('status','pending');
  const b=$('#pendingBadge');b.hidden=!count;b.textContent=count||'';
}

/* Pane statistiques */
function renderStatsPane(){
  if(!stats)return;draws=draws.filter(d=>d.pane!=='stats');
  const sel=$('#statProduct');
  const prods=products;
  sel.innerHTML='<option value="">Toute la boutique</option>'+prods.map(p=>`<option value="${p.id}" ${p.id===statProduct?'selected':''}>${esc(p.title)}</option>`).join('');
  $('#kpis2').innerHTML=kpiHTML(pstats);
  const L=pstats.daily.map(d=>fdate(d.d));
  addChart('stats','#chRevenue2',L,pstats.daily.map(d=>d.revenue),'area','#c89d50',v=>money(v));
  addChart('stats','#chViews2',L,pstats.daily.map(d=>d.views),'bar','#1d57a6',v=>num(v)+' visite(s)');
  loadPerfTable();
}
function loadPerfTable(){
  // Le tableau compare toujours tous les produits
  const rows=stats.products;
  $('#perfTable').innerHTML='<thead><tr><th>Produit</th><th class="n">Visites</th><th class="n">Ventes</th><th class="n">CA</th><th class="n">Conv.</th><th class="n">Stock</th></tr></thead><tbody>'+
   (rows.length?rows.map(p=>{const c=p.views?Math.min(100,p.units/p.views*100):null;return `<tr data-id="${p.product_id}" class="${p.product_id===statProduct?'sel':''}"><td>${esc(p.title)}</td><td class="n">${num(p.views)}</td><td class="n">${num(p.units)}</td><td class="n">${money(p.revenue)}</td><td class="n">${c===null?'—':c.toFixed(1).replace('.',',')+'%'}</td><td class="n">${p.stock}</td></tr>`}).join(''):'<tr><td colspan="6">Aucun produit.</td></tr>')+'</tbody>';
  $$('#perfTable tbody tr[data-id]').forEach(tr=>tr.addEventListener('click',async()=>{statProduct=statProduct===tr.dataset.id?'':tr.dataset.id;await loadStats();renderStatsPane()}));
}
$('#statProduct').addEventListener('change',async e=>{statProduct=e.target.value;await loadStats();renderStatsPane()});

/* ---------- Graphiques SVG ---------- */
function niceMax(v){if(v<=0)return 4;const q=v/4,p=10**Math.floor(Math.log10(q)),f=q/p;return(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p*4}
function addChart(pane,sel,labels,values,type,color,fmt){draws=draws.filter(d=>!(d.pane===pane&&d.sel===sel));const d={pane,sel,labels,values,type,color,fmt};draws.push(d);drawChart(d)}
function redraw(){draws.forEach(d=>{if($(d.sel).offsetParent!==null)drawChart(d)})}
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(redraw,150)});
function drawChart({sel,labels,values,type,color,fmt}){
  const el=$(sel);if(!el)return;
  const w=Math.max(240,el.clientWidth||320),h=190,pl=42,pr=8,pt=10,pb=24,iw=w-pl-pr,ih=h-pt-pb,n=values.length||1;
  const mx=niceMax(Math.max(0,...values)),xc=i=>pl+(i+.5)*iw/n,y=v=>pt+ih-(v/mx)*ih;
  let s=`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">`;
  for(let k=0;k<=4;k++){const v=mx*k/4,yy=y(v);s+=`<line x1="${pl}" x2="${w-pr}" y1="${yy}" y2="${yy}" stroke="#e2e8ed"/><text x="${pl-6}" y="${yy+4}" text-anchor="end" font-size="11" fill="#687887">${compact(v)}</text>`}
  const step=Math.max(1,Math.ceil(n/5));labels.forEach((l,i)=>{if(i%step===0||i===n-1&&n<8)s+=`<text x="${xc(i)}" y="${h-6}" text-anchor="middle" font-size="11" fill="#687887">${esc(l)}</text>`});
  if(type==='bar'){const bw=Math.max(2,Math.min(26,iw/n*.7));values.forEach((v,i)=>{const hh=ih-(y(v)-pt);s+=`<rect x="${xc(i)-bw/2}" y="${y(v)}" width="${bw}" height="${Math.max(v>0?2:0,hh)}" rx="3" fill="${color}"/>`})}
  else{const pts=values.map((v,i)=>[xc(i),y(v)]);const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    s+=`<path d="${path} L${pts.at(-1)[0]} ${pt+ih} L${pts[0][0]} ${pt+ih} Z" fill="${color}" opacity=".16"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;if(n<=31)pts.forEach(p=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="${color}"/>`)}
  s+=`<line id="gl" x1="0" x2="0" y1="${pt}" y2="${pt+ih}" stroke="#10283d" stroke-opacity=".3" visibility="hidden"/><rect x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent" class="hit"/></svg><div class="tip" hidden></div>`+(Math.max(0,...values)===0?'<div class="empty">Pas encore de données</div>':'');
  el.innerHTML=s;
  const hit=$('.hit',el),tip=$('.tip',el),gl=$('#gl',el);
  const mv=e=>{const r=el.getBoundingClientRect(),i=Math.max(0,Math.min(n-1,Math.floor((e.clientX-r.left-pl)/(iw/n))));const x=xc(i);gl.setAttribute('x1',x);gl.setAttribute('x2',x);gl.setAttribute('visibility','visible');tip.hidden=false;tip.textContent=labels[i]+' : '+fmt(values[i]);tip.style.left=Math.max(60,Math.min(w-60,x))+'px';tip.style.top=y(values[i])+'px'};
  hit.addEventListener('pointermove',mv);hit.addEventListener('pointerdown',mv);hit.addEventListener('pointerleave',()=>{tip.hidden=true;gl.setAttribute('visibility','hidden')});
}

/* ---------- Produits ---------- */
async function loadProducts(){
  const {data,error}=await sb.from('commerce_products').select('*').eq('store_id',store.id).order('created_at',{ascending:false});
  if(error)throw error;products=data||[];renderProducts();
}
function renderProducts(){
  const sm=Object.fromEntries((stats?.products||[]).map(p=>[p.product_id,p]));
  $('#productList').innerHTML=products.map(p=>{const st=PST[p.status]||['?','off'],x=sm[p.id]||{};
    return `<article class="pcard"><div class="ph">${p.image_url?`<img src="${esc(p.image_url)}" alt="" loading="lazy">`:''}<span class="chip ${st[1]}">${st[0]}</span></div><div class="pb"><h4>${esc(p.title)}</h4><b>${money(p.price)}</b><span class="stat">Stock : ${p.stock_quantity} · 👁 ${num(x.views)} · 🛒 ${num(x.units)} vendu(s)</span>
    <div class="acts"><button class="btn sm primary" data-a="edit" data-id="${p.id}">Modifier</button><button class="btn sm ghost" data-a="toggle" data-id="${p.id}">${p.status==='active'?'Masquer':'Publier'}</button><button class="btn sm ghost" data-a="stat" data-id="${p.id}">📈</button><button class="btn sm danger" data-a="del" data-id="${p.id}">Supprimer</button></div></div></article>`}).join('')||'<div class="card"><p class="muted">Aucun produit pour l’instant.</p></div>';
}
$('#productList').addEventListener('click',async e=>{
  const b=e.target.closest('button[data-a]');if(!b)return;const p=products.find(x=>x.id===b.dataset.id);if(!p)return;
  try{
    if(b.dataset.a==='edit'){startEdit(p);go('edit')}
    else if(b.dataset.a==='stat'){statProduct=p.id;await loadStats();go('stats')}
    else if(b.dataset.a==='toggle'){const {error}=await sb.from('commerce_products').update({status:p.status==='active'?'draft':'active'}).eq('id',p.id);if(error)throw error;await refreshAll()}
    else if(b.dataset.a==='del'){if(!confirm('Supprimer « '+p.title+' » définitivement ?'))return;const {error}=await sb.from('commerce_products').delete().eq('id',p.id);if(error)throw error;removeFiles([...(p.media_urls||[]),...(p.video_urls||[])]);await refreshAll()}
  }catch(x){alert(x.message)}
});
async function refreshAll(){await Promise.all([loadProducts(),loadStats()]);renderProducts();renderOverview();renderStatsPane()}
$('#addProduct').addEventListener('click',()=>{startEdit(null);go('edit')});
$('#cancelEdit').addEventListener('click',()=>{startEdit(null);go('products')});

/* Formulaire produit */
let newFiles={images:[],videos:[]};
function startEdit(p){
  editing=p;const f=$('#productForm');f.reset();newFiles={images:[],videos:[]};say($('#productState'),'');
  $('#editTitle').textContent=p?'Modifier le produit':'Publier un produit';
  $('#saveProduct').textContent=p?'Enregistrer les modifications':'Publier mon produit';
  f.elements.id.value=p?.id||'';
  if(p){for(const k of ['title','description','category_id','market_type','price','stock_quantity','status'])if(f.elements[k])f.elements[k].value=p[k]??''}
  keep={images:p?[...(p.media_urls?.length?p.media_urls:(p.image_url?[p.image_url]:[]))]:[],videos:p?[...(p.video_urls||[])]:[]};
  renderMedia();
}
function renderMedia(){
  const mk=(kind,video)=>{
    const old=keep[kind].map((u,i)=>({u,old:1,i})),nw=newFiles[kind].map((f,i)=>({u:URL.createObjectURL(f),old:0,i}));
    $(video?'#videoList':'#imageList').innerHTML=[...old,...nw].map((m,idx)=>`<div class="mi">${video?`<video src="${esc(m.u)}" muted playsinline preload="metadata"></video>`:`<img src="${esc(m.u)}" alt="">`}${!video&&idx===0?'<em>Principale</em>':''}<button type="button" data-k="${kind}" data-old="${m.old}" data-i="${m.i}" aria-label="Retirer">×</button></div>`).join('');
  };
  mk('images',false);mk('videos',true);
}
$('#productForm').addEventListener('click',e=>{const b=e.target.closest('.mi button');if(!b)return;const k=b.dataset.k,i=Number(b.dataset.i);(b.dataset.old==='1'?keep[k]:newFiles[k]).splice(i,1);renderMedia()});
$('#productImages').addEventListener('change',e=>{newFiles.images.push(...e.target.files);e.target.value='';renderMedia()});
$('#productVideos').addEventListener('change',e=>{newFiles.videos.push(...e.target.files);e.target.value='';renderMedia()});

async function compress(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size<350e3)return file;
  try{
    const bmp=await createImageBitmap(file),r=Math.min(1,1600/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*r);c.height=Math.round(bmp.height*r);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',.85));
    return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):file;
  }catch(_){return file}
}
async function upload(files,folder,label,st){
  const urls=[];let n=0;
  for(const raw of files){
    n++;say(st,`Téléversement ${label} ${n}/${files.length}…`);
    const file=await compress(raw),ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
    const path=`${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error}=await sb.storage.from(BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type||undefined});
    if(error){if(/bucket not found/i.test(error.message||''))throw Error('Le stockage des médias n’est pas encore activé sur ce projet Supabase. Exécutez le script 13_boutique_vendeur.sql puis réessayez.');throw error}
    urls.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
function removeFiles(urls){
  const paths=urls.map(u=>{const i=String(u).indexOf('/'+BUCKET+'/');return i<0?null:decodeURIComponent(String(u).slice(i+BUCKET.length+2).split('?')[0])}).filter(Boolean);
  if(paths.length)sb.storage.from(BUCKET).remove(paths).catch(()=>{});
}
$('#productForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget,v=fobj(f),st=$('#productState'),btn=$('#saveProduct');
  try{
    if(!store)throw Error('Aucune boutique sélectionnée.');
    if(keep.images.length+newFiles.images.length>8)throw Error('Maximum 8 photos par produit.');
    if(keep.videos.length+newFiles.videos.length>3)throw Error('Maximum 3 vidéos par produit.');
    for(const fl of newFiles.videos)if(fl.size>50*1024*1024)throw Error('La vidéo « '+fl.name+' » dépasse 50 Mo.');
    btn.disabled=true;
    const folder=editing?.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now()));
    const imgs=[...keep.images,...await upload(newFiles.images,folder,'photo',st)];
    const vids=[...keep.videos,...await upload(newFiles.videos,folder,'vidéo',st)];
    say(st,'Enregistrement…');
    const payload={title:v.title.trim(),description:v.description||null,category_id:v.category_id||null,price:Number(v.price),stock_quantity:Number(v.stock_quantity),market_type:v.market_type,status:v.status,media_urls:imgs,video_urls:vids,image_url:imgs[0]||null,currency:'XOF'};
    let error;
    if(editing){({error}=await sb.from('commerce_products').update(payload).eq('id',editing.id));if(!error)removeFiles([...(editing.media_urls||[]),...(editing.video_urls||[])].filter(u=>!imgs.includes(u)&&!vids.includes(u)))}
    else({error}=await sb.from('commerce_products').insert({...payload,store_id:store.id}));
    if(error)throw error;
    say(st,'');startEdit(null);await refreshAll();go('products');
  }catch(x){say(st,x.message||'Enregistrement impossible.')}finally{btn.disabled=false}
});

/* ---------- Commandes ---------- */
async function loadOrders(){
  const root=$('#orders');
  $('#orderFilter').innerHTML=['all','pending','confirmed','shipped','delivered','cancelled'].map(s=>`<button data-s="${s}" class="${s===orderFilter?'on':''}">${s==='all'?'Toutes':LBL[s]}</button>`).join('');
  try{
    let q=sb.from('commerce_orders').select('id,order_number,status,subtotal,delivery_fee,currency,delivery_address,buyer_note,created_at,commerce_order_items(title,quantity,unit_price)').eq('store_id',store.id).order('created_at',{ascending:false}).limit(100);
    if(orderFilter!=='all')q=q.eq('status',orderFilter);
    const {data,error}=await q;if(error)throw error;
    root.innerHTML=(data||[]).map(o=>`<div class="ord"><header><strong>${esc(o.order_number)}</strong><span class="chip" style="background:${SCOL[o.status]}22;color:${SCOL[o.status]}">${esc(LBL[o.status]||o.status)}</span></header><div class="meta">${new Date(o.created_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</div>
      <ul>${(o.commerce_order_items||[]).map(i=>`<li>${esc(i.title)} × ${i.quantity} — ${money(i.unit_price*i.quantity)}</li>`).join('')}</ul>
      ${o.delivery_address?`<div class="meta">📍 ${esc(o.delivery_address)}</div>`:''}${o.buyer_note?`<div class="meta">💬 ${esc(o.buyer_note)}</div>`:''}
      <div class="total">Total : ${money(Number(o.subtotal)+Number(o.delivery_fee||0))}</div>${orderActs(o)}</div>`).join('')||'<div class="card"><p class="muted">Aucune commande.</p></div>';
  }catch(x){root.innerHTML=`<div class="card"><p class="muted">${esc(x.message)}</p></div>`}
}
function orderActs(o){const n={pending:[['confirmed','Confirmer'],['cancelled','Refuser']],confirmed:[['shipped','Marquer expédiée'],['cancelled','Annuler']],shipped:[['delivered','Marquer livrée']]}[o.status]||[];return n.length?'<div class="acts">'+n.map(a=>`<button class="btn sm ${a[0]==='cancelled'?'danger':'primary'}" data-o="${o.id}" data-st="${a[0]}">${a[1]}</button>`).join('')+'</div>':''}
$('#orders').addEventListener('click',async e=>{
  const b=e.target.closest('[data-st]');if(!b)return;
  try{b.disabled=true;const {error}=await sb.rpc('commerce_set_order_status',{p_order:b.dataset.o,p_status:b.dataset.st});if(error)throw error;await Promise.all([loadOrders(),loadStats(),loadProducts(),loadPendingBadge()]);renderProducts()}catch(x){alert(x.message);b.disabled=false}
});
$('#orderFilter').addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(!b)return;orderFilter=b.dataset.s;loadOrders()});
$('#reloadOrders').addEventListener('click',()=>{loadOrders();loadPendingBadge()});

/* ---------- Profil ---------- */
function fillProfile(){
  const f=$('#profileForm');
  for(const k of ['store_name','store_type','market_type','city','phone','description'])f.elements[k].value=store[k]??'';
  f.elements.is_active.checked=!!store.is_active;
}
$('#profileForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget,v=fobj(f),st=$('#profileState'),btn=e.submitter;
  try{
    btn.disabled=true;say(st,'Enregistrement…');
    const payload={store_name:v.store_name.trim(),store_type:v.store_type,market_type:v.market_type,city:v.city||null,phone:v.phone||null,description:v.description||null,is_active:f.elements.is_active.checked};
    const logo=$('#logoFile').files[0];
    if(logo){const [u]=await upload([logo],'logo','logo',st);payload.logo_url=u}
    const {error}=await sb.from('commerce_stores').update(payload).eq('id',store.id);if(error)throw error;
    $('#logoFile').value='';await loadStores(store.id);say($('#profileState'),'Boutique mise à jour ✔');
  }catch(x){say(st,x.message)}finally{btn.disabled=false}
});

init();
})();
