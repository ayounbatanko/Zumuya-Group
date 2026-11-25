(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb,session,countries=[],rests=[],orders=[];
const TITLES={overview:'Vue d’ensemble',services:'Services : restauration, hôtel, livraison',partners:'Partenaires',countries:'Déploiement par pays',orgs:'Organisations',payments:'Transactions',wallet:'Portefeuille & commissions',activity:'Activité métier',subscriptions:'Abonnements Pro'};
const msg=s=>{$('#loginMsg').textContent=s};
const fail=s=>{const e=$('#err');e.hidden=!s;e.textContent=s||''};
const dt=x=>x?new Date(x).toLocaleDateString('fr-FR'):'—';
const stat=(l,v,n)=>`<div class="stat"><small>${l}</small><strong>${v}</strong>${n?`<em>${n}</em>`:''}</div>`;
const isHotel=r=>!!(r&&(r.businessType==='hotel'||(r.hotel&&r.hotel.enabled)));
const subOk=r=>{const n=Date.now();return r.sub==='suspended'?false:r.sub==='active'?r.subEnd>n:r.trialEnd>n};
const subLabel=r=>r.sub==='suspended'?['Désactivé','bad']:r.sub==='active'?(r.subEnd>Date.now()?['Pro actif','good']:['Pro expiré','bad']):(r.trialEnd>Date.now()?['Essai gratuit','warn']:['Essai terminé','bad']);

/* ---------- Navigation par onglets ---------- */
function show(){const t=(location.hash||'#overview').slice(1),k=TITLES[t]?t:'overview';
 $$('[data-p]').forEach(s=>s.hidden=s.dataset.p!==k);$$('#tabs a').forEach(a=>a.classList.toggle('on',a.dataset.t===k));$('#title').textContent=TITLES[k];scrollTo(0,0)}
addEventListener('hashchange',show);

$('#commissionForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const value=Number($('#commissionPercent').value);const out=$('#commissionMsg');
 if(!Number.isFinite(value)||value<0||value>30){out.textContent='Choisissez un taux entre 0 et 30 %.';return}
 const {error}=await sb.rpc('rg_wallet_set_commission',{p_percent:value});
 out.textContent=error?error.message:'Taux de commission enregistré.';if(!error)await loadWalletAdmin();
});
/* ---------- Démarrage / authentification ---------- */
async function start(){
 if(!window.ZUMAYA_CONFIG||!ZUMAYA_CONFIG.SUPABASE_URL||ZUMAYA_CONFIG.SUPABASE_URL.includes('VOTRE-PROJET'))throw Error('Configuration Supabase non renseignée.');
 sb=window.supabase.createClient(ZUMAYA_CONFIG.SUPABASE_URL,ZUMAYA_CONFIG.SUPABASE_ANON_KEY);
 const {data:{session:s}}=await sb.auth.getSession();if(s)await verify(s)}
async function verify(s){session=s;
 const {data,error}=await sb.rpc('rg_is_platform_owner');if(error)throw error;
 if(data!==true){await sb.auth.signOut();session=null;throw Error('Ce compte ne figure pas dans la liste d’autorisation du propriétaire.')}
 $('#login').hidden=true;$('#shell').hidden=false;$('#who').textContent=s.user.email;show();await refresh()}

/* ---------- Chargement des données ---------- */
async function optional(p){try{const r=await p;return r.error?null:r}catch(e){return null}}
async function loadWalletAdmin(){
 const [w,c,wd]=await Promise.all([
  sb.from('rg_wallets').select('balance_minor').eq('user_id',session.user.id).maybeSingle(),
  sb.from('rg_wallet_settings').select('commission_percent').eq('id',true).maybeSingle(),
  sb.from('rg_wallet_withdrawals').select('id,user_id,amount_minor,currency_code,status,payment_method,created_at').order('created_at',{ascending:false}).limit(50)
 ]);
 if(!w.error)$('#ownerWalletBalance').textContent=new Intl.NumberFormat('fr-FR').format(w.data?.balance_minor||0)+' FCFA';
 if(!c.error&&c.data){$('#ownerCommissionCurrent').textContent=c.data.commission_percent+' %';$('#commissionPercent').value=c.data.commission_percent}
 if(!wd.error)$('#ownerWithdrawals').innerHTML=(wd.data||[]).map(x=>`<div class="entry"><b>${Number(x.amount_minor).toLocaleString('fr-FR')} FCFA</b> · ${esc(x.status)} · ${esc(x.payment_method?.type||'')} · ${esc(x.payment_method?.destination||'')}<small> · ${dt(x.created_at)}</small></div>`).join('')||'Aucune demande de retrait.';
}
async function refresh(){fail('');
 const [orgs,ests,records,partners,payments,c,prof,rr,oo]=await Promise.all([
  sb.from('rg_organizations').select('id,legal_name,public_name,country_code,organization_type,verification_status,created_at').order('created_at',{ascending:false}).limit(100),
  sb.from('rg_establishments').select('id',{count:'exact',head:true}),
  sb.from('rg_service_records').select('id,organization_id,module_code,record_type,status,created_at').order('created_at',{ascending:false}).limit(15),
  sb.from('rg_partner_applications').select('id,organization_name,country_code,category,city,status,contact_email,contact_phone,message').order('created_at',{ascending:false}).limit(100),
  sb.from('rg_payment_transactions').select('id,module_code,amount_minor,currency_code,provider,status,created_at').order('created_at',{ascending:false}).limit(30),
  sb.from('rg_countries').select('code,name,enabled').order('name'),
  sb.from('rg_profiles').select('user_id',{count:'exact',head:true}),
  optional(sb.from('rg_rests').select('id,data').order('seq',{ascending:true})),
  optional(sb.from('rg_orders').select('id,data').order('seq',{ascending:false}).limit(500))]);
 for(const r of [orgs,ests,records,partners,payments,c,prof])if(r.error)throw r.error;
 countries=c.data||[];rests=(rr&&rr.data||[]).map(x=>x.data).filter(Boolean);orders=(oo&&oo.data||[]).map(x=>x.data).filter(o=>o&&o.restId&&!String(o.id).startsWith('__'));
 const orgNames=Object.fromEntries((orgs.data||[]).map(x=>[x.id,x.public_name]));
 const pend=(partners.data||[]).filter(x=>x.status==='pending');
 renderOverview(orgs.data||[],prof.count||0,ests.count||0,payments.data||[],pend);await loadWalletAdmin();
 renderServices();await loadProAdmin();renderPartners(partners.data||[]);renderCountries();renderOrgs(orgs.data||[]);renderPayments(payments.data||[]);renderActivity(records.data||[],orgNames);
 if(!rr)fail('Les données du Service de Restauration ne sont pas lisibles : exécutez supabase-setup.sql dans ce projet Supabase.');
 const b=$('#pBadge');b.hidden=!pend.length;b.textContent=pend.length;$('#live').textContent='● Connecté · '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}

/* ---------- Abonnements Pro natifs ZUMAYA ---------- */
const fmtMoney=(n,c='XOF')=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' '+c;
const dateTime=x=>x?new Date(x).toLocaleDateString('fr-FR'):'—';
async function loadProAdmin(){
 const [orgs,subs,reqs,plans,methods]=await Promise.all([
  sb.from('rg_organizations').select('id,public_name,legal_name,organization_type,contact_phone,country_code').in('organization_type',['restaurant','hotel']).order('created_at',{ascending:false}),
  sb.from('zrh_subscriptions').select('*').order('updated_at',{ascending:false}),
  sb.from('zrh_subscription_requests').select('*').order('created_at',{ascending:false}).limit(100),
  sb.from('zrh_subscription_plans').select('*').order('service_type').order('months'),
  sb.from('zrh_subscription_payment_methods').select('*').order('created_at')
 ]);
 for(const x of [orgs,subs,reqs,plans,methods])if(x.error)throw x.error;
 const om=Object.fromEntries((orgs.data||[]).map(o=>[o.id,o]));
 const rq=reqs.data||[],ss=subs.data||[],pp=plans.data||[],mm=methods.data||[];
 $('#proStats').innerHTML=stat('Établissements',orgs.data.length)+stat('Pro actifs',ss.filter(x=>x.status==='active'&&x.current_period_end&&new Date(x.current_period_end)>new Date()).length)+stat('Essais en cours',ss.filter(x=>x.status==='trial'&&new Date(x.trial_ends_at)>new Date()).length)+stat('Demandes à traiter',rq.filter(x=>['requested','instructions_sent','payment_submitted'].includes(x.status)).length);
 $('#proRequests').innerHTML=rq.map(r=>{const o=om[r.org_id]||{};return `<tr><td><b>${esc(o.public_name||o.legal_name||'Établissement')}</b><br><small>${esc(o.contact_phone||'')}</small></td><td>${r.service_type==='hotel'?'🏨 Hôtel':'🍽️ Restaurant'}</td><td>${r.months} mois</td><td>${fmtMoney(r.amount_minor,r.currency_code)}</td><td><span class="badge ${r.status==='approved'?'good':r.status==='rejected'?'bad':'warn'}">${esc(r.status)}</span>${r.payment_instructions?`<small><br>${esc(r.payment_instructions)}</small>`:''}</td><td>${esc(r.payment_reference||'—')}<small><br>${esc(r.payment_method_name||'')}</small></td><td>${r.status==='requested'?`<select data-pro-method="${r.id}"><option value="">Mode de paiement…</option>${mm.filter(m=>m.active).map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select><button class="smallbtn" data-pro-send="${r.id}">Envoyer formulaire</button>`:''}${r.status==='payment_submitted'?`<button class="smallbtn" data-pro-approve="${r.id}">Confirmer paiement / Activer</button><button class="smallbtn" data-pro-reject="${r.id}">Rejeter</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="7">Aucune demande Pro.</td></tr>';
 $('#proSubs').innerHTML=orgs.data.map(o=>{const x=ss.find(z=>z.org_id===o.id)||{};return `<tr><td><b>${esc(o.public_name||o.legal_name)}</b></td><td>${o.organization_type==='hotel'?'Hôtel':'Restaurant'}</td><td><span class="badge ${x.status==='active'?'good':x.status==='suspended'?'bad':'warn'}">${esc(x.status||'trial')}</span></td><td>${dateTime(x.trial_ends_at)}</td><td>${dateTime(x.current_period_end)}</td><td><button class="smallbtn" data-pro-admin="${o.id}" data-action="extend">+1 mois</button><button class="smallbtn" data-pro-admin="${o.id}" data-action="${x.status==='suspended'?'reactivate':'suspend'}">${x.status==='suspended'?'Réactiver':'Suspendre'}</button></td></tr>`}).join('')||'<tr><td colspan="6">Aucun restaurant ou hôtel.</td></tr>';
 $('#proPlans').innerHTML=['restaurant','hotel'].map(t=>`<h3>${t==='hotel'?'🏨 Hôtel':'🍽️ Restaurant'}</h3><div class="tools" style="margin-bottom:12px">${[1,3,6,12].map(m=>{const x=pp.find(z=>z.service_type===t&&z.months===m);return `<label>${m} mois<input type="number" min="1" data-plan-type="${t}" data-plan-months="${m}" value="${x?.amount_minor||0}" style="width:110px"></label>`}).join('')}</div>`).join('')+'<button class="btn primary" id="saveProPlans">Enregistrer les tarifs</button>';
 $('#proMethods').innerHTML=`<form id="proMethodForm" class="tools"><input name="name" required placeholder="Orange Money, Wave…"><input name="instructions" required placeholder="Numéro / instructions de paiement"><button class="btn primary">Ajouter</button></form>${mm.map(m=>`<p><b>${esc(m.name)}</b> · ${esc(m.instructions)} <button class="smallbtn" data-method-toggle="${m.id}" data-active="${m.active}">${m.active?'Désactiver':'Activer'}</button></p>`).join('')||'<p>Aucun moyen de paiement configuré.</p>'}`;
}
$('#subscriptions')?.addEventListener('click',e=>run(async()=>{
 const send=e.target.closest('[data-pro-send]'),approve=e.target.closest('[data-pro-approve]'),reject=e.target.closest('[data-pro-reject]'),admin=e.target.closest('[data-pro-admin]'),mt=e.target.closest('[data-method-toggle]');
 if(send){const sel=document.querySelector(`[data-pro-method="${send.dataset.proSend}"]`);if(!sel?.value)throw Error('Choisissez un moyen de paiement.');const {error}=await sb.rpc('zrh_subscription_owner_action',{p_request_id:send.dataset.proSend,p_action:'send_instructions',p_method_id:sel.value,p_owner_note:null});if(error)throw error;await loadProAdmin();return}
 if(approve||reject){const id=(approve||reject).dataset.proApprove||(approve||reject).dataset.proReject;const action=approve?'approve':'reject';if(!confirm(action==='approve'?'Confirmer le paiement et activer Pro ?':'Rejeter cette demande ?'))return;const {error}=await sb.rpc('zrh_subscription_owner_action',{p_request_id:id,p_action:action,p_method_id:null,p_owner_note:null});if(error)throw error;await loadProAdmin();return}
 if(admin){const action=admin.dataset.action;const {error}=await sb.rpc('zrh_subscription_admin_set_status',{p_org_id:admin.dataset.proAdmin,p_action:action,p_months:1,p_note:'Gestion depuis espace propriétaire'});if(error)throw error;await loadProAdmin();return}
 if(mt){const {error}=await sb.from('zrh_subscription_payment_methods').update({active:mt.dataset.active!=='true'}).eq('id',mt.dataset.methodToggle);if(error)throw error;await loadProAdmin()}
}));
$('#subscriptions')?.addEventListener('submit',e=>{if(e.target.id==='proMethodForm'){e.preventDefault();run(async()=>{const f=Object.fromEntries(new FormData(e.target));const {error}=await sb.from('zrh_subscription_payment_methods').insert(f);if(error)throw error;await loadProAdmin()})}});
$('#subscriptions')?.addEventListener('click',e=>{if(e.target.id==='saveProPlans')run(async()=>{const fields=[...document.querySelectorAll('[data-plan-type]')];for(const el of fields){const {error}=await sb.from('zrh_subscription_plans').upsert({service_type:el.dataset.planType,months:+el.dataset.planMonths,amount_minor:+el.value,currency_code:'XOF',active:+el.value>0},{onConflict:'service_type,months'});if(error)throw error}await loadProAdmin();alert('Tarifs Pro enregistrés.')})});

/* ---------- Rendus ---------- */
function renderOverview(orgs,users,ests,pays,pend){
 const hotels=rests.filter(isHotel),restos=rests.filter(r=>!isHotel(r)),done=['terminée','refusée','annulée'],act=orders.filter(o=>!done.includes(o.status));
 $('#stats').innerHTML=stat('Organisations',orgs.length)+stat('Comptes ZUMUYA',users)+stat('Établissements',ests)+stat('Transactions',pays.length)+stat('Restaurants',restos.length,restos.filter(subOk).length+' actifs')+stat('Hôtels',hotels.length,hotels.filter(subOk).length+' actifs')+stat('Commandes en cours',act.length,orders.length+' au total');
 const sales=orders.reduce((n,o)=>n+(Number(o.total)||0),0),completed=orders.filter(o=>o.status==='terminée').length;
 const deliveryAssigned=orders.filter(o=>o.driverId).length,completion=orders.length?Math.round(completed/orders.length*100):0;
 const insight=document.getElementById('ownerInsights');
 if(insight)insight.innerHTML=stat('Volume de ventes estimé',sales.toLocaleString('fr-FR')+' FCFA')+stat('Commandes terminées',completed)+stat('Taux d’achèvement',completion+' %')+stat('Courses attribuées',deliveryAssigned);

 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);return d}),
  cnt=days.map(d=>orders.filter(o=>o.created&&new Date(o.created).toDateString()===d.toDateString()).length),mx=Math.max(1,...cnt);
 $('#ordTotal').textContent=cnt.reduce((a,b)=>a+b,0)+' commandes';
 $('#chart').innerHTML='<div class="bars">'+days.map((d,i)=>`<div class="bar"><b>${cnt[i]}</b><i style="height:${Math.max(3,cnt[i]/mx*100)}%"></i><span>${d.toLocaleDateString('fr-FR',{weekday:'short'})}</span></div>`).join('')+'</div>';
 const room=orders.filter(o=>o.deliveryMode==='room').length,del=orders.filter(o=>o.deliveryMode!=='room').length,tot=Math.max(1,orders.length),
  roomShare=orders.filter(o=>isHotel(rests.find(r=>r.id===o.restId))).length,restoShare=orders.length-roomShare;
 const line=(l,v)=>`<div><p><span>${l}</span><span>${v}</span></p><div class="track"><i style="width:${v/tot*100}%"></i></div></div>`;
 $('#split').innerHTML='<div class="split">'+line('🍽️ Restauration',restoShare)+line('🏨 Hôtel (restauration d’hôtel)',roomShare)+line('📦 Livraison (hors chambre)',del)+line('🛏️ Service en chambre',room)+'</div>';
 $('#pendingList').innerHTML=pend.length?pend.slice(0,4).map(x=>`<div class="partner"><strong>${esc(x.organization_name)}</strong><small>${esc(x.country_code)} · ${esc(x.category)} · ${esc(x.city)}</small></div>`).join(''):'<div class="empty">Aucune demande en attente.</div>'}
function renderServices(){
 const q=($('#q').value||'').toLowerCase(),f=$('#f').value;
 const cntBy=id=>orders.filter(o=>o.restId===id).length;
 const list=rests.filter(r=>(!q||(r.name||'').toLowerCase().includes(q))&&(!f||(f==='hotel')===isHotel(r)));
 const hot=rests.filter(isHotel).length,drv=orders.filter(o=>o.driverId).length;
 $('#svcStats').innerHTML=stat('🍽️ Restaurants',rests.length-hot)+stat('🏨 Hôtels',hot)+stat('📦 Courses attribuées',drv)+stat('Plats au catalogue',rests.reduce((a,r)=>a+(r.menu||[]).length,0));
 $('#rests').innerHTML=list.map(r=>{const [l,c]=subLabel(r);return `<tr><td><b>${esc(r.name)}</b><br><small>${esc(r.phone||'')}</small></td><td>${isHotel(r)?'🏨 Hôtel':'🍽️ Restaurant'}</td><td><span class="badge ${c}">${l}</span></td><td>${(r.menu||[]).length} plat(s)</td><td>${+r.kmPrice>0?esc(r.kmPrice)+' '+esc(r.currency||'XOF')+'/km':'<span class="badge warn">non défini</span>'}</td><td>${r.lat!=null?'<span class="badge good">renseignée</span>':'<span class="badge bad">manquante</span>'}</td><td>${cntBy(r.id)}</td></tr>`}).join('')||'<tr><td colspan="7">Aucun établissement.</td></tr>'}
function renderPartners(a){$('#partners').innerHTML=a.length?a.map(x=>`<div class="partner"><strong>${esc(x.organization_name)}</strong><small>${esc(x.country_code)} · ${esc(x.category)} · ${esc(x.city)} · ${esc(x.contact_email||'Sans e-mail')} · ${esc(x.contact_phone||'')} · <span class="badge ${x.status==='approved'?'good':x.status==='rejected'?'bad':'warn'}">${esc(x.status)}</span></small>${x.status==='pending'?`<div class="actions"><button data-partner="${x.id}" data-status="approved">Approuver</button><button class="reject" data-partner="${x.id}" data-status="rejected">Refuser</button></div>`:''}</div>`).join(''):'<div class="empty">Aucune demande de partenariat.</div>'}
function renderCountries(){$('#countries').innerHTML=countries.map(x=>`<div class="country"><div><b>${esc(x.name)}</b><small>${esc(x.code)} · ${x.enabled?'Marché activé':'Marché en préparation'}</small></div><button class="toggle ${x.enabled?'on':'off'}" data-country="${x.code}" data-enabled="${x.enabled}">${x.enabled?'Désactiver':'Activer'}</button></div>`).join('')}
function renderOrgs(a){$('#orgCount').textContent=a.length+' affichée(s)';$('#orgs').innerHTML=a.map(x=>`<tr><td>${esc(x.public_name)}</td><td>${esc(x.country_code)}</td><td>${esc(x.organization_type)}</td><td><span class="badge ${x.verification_status==='verified'?'good':'warn'}">${esc(x.verification_status)}</span></td><td><select data-org-status="${x.id}"><option value="">Changer…</option><option value="verified">Vérifier</option><option value="rejected">Refuser</option><option value="suspended">Suspendre</option><option value="pending">En attente</option></select></td><td>${dt(x.created_at)}</td></tr>`).join('')||'<tr><td colspan="6">Aucune organisation.</td></tr>'}
function renderPayments(a){$('#payments').innerHTML=a.map(x=>`<tr><td>${dt(x.created_at)}</td><td>${esc(x.module_code)}</td><td>${Number(x.amount_minor).toLocaleString('fr-FR')}</td><td>${esc(x.currency_code)}</td><td>${esc(x.provider)}</td><td><span class="badge">${esc(x.status)}</span></td></tr>`).join('')||'<tr><td colspan="6">Aucune transaction.</td></tr>'}
function renderActivity(a,names){$('#activity').innerHTML=a.map(x=>`<tr><td>${dt(x.created_at)}</td><td>${esc(names[x.organization_id]||'Organisation')}</td><td>${esc(x.module_code)}</td><td>${esc(x.record_type)}</td><td><span class="badge">${esc(x.status)}</span></td></tr>`).join('')||'<tr><td colspan="5">Aucune activité.</td></tr>'}

/* ---------- Actions ---------- */
const run=async f=>{try{await f()}catch(e){fail(e.message||'Action impossible')}};
$('#loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{try{msg('Connexion…');const {data,error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error)throw error;await verify(data.session);msg('')}catch(x){msg(x.message||'Connexion impossible')}})};
$('#logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('#logout2').onclick=$('#logout').onclick;
$('#refresh').onclick=()=>run(refresh);
$('#q').oninput=renderServices;$('#f').onchange=renderServices;
$('#countries').onclick=e=>{const b=e.target.closest('[data-country]');if(!b)return;const en=b.dataset.enabled!=='true';if(!confirm(`${en?'Activer':'Désactiver'} ce pays ? Cette action modifie la disponibilité du marché dans le référentiel.`))return;run(async()=>{const {error}=await sb.rpc('rg_platform_set_country_enabled',{p_code:b.dataset.country,p_enabled:en});if(error)throw error;await refresh()})};
$('#orgs').onchange=e=>{const sel=e.target.closest('[data-org-status]');if(!sel||!sel.value)return;run(async()=>{const {error}=await sb.from('rg_organizations').update({verification_status:sel.value}).eq('id',sel.dataset.orgStatus);if(error)throw error;await refresh()})};
$('#partners').onclick=e=>{const b=e.target.closest('[data-partner]');if(!b)return;const patch={status:b.dataset.status};if(patch.status==='rejected'){const n=prompt('Motif du refus (visible par le demandeur) :');if(n===null)return;patch.review_note=n.trim()||null}run(async()=>{const {error}=await sb.from('rg_partner_applications').update(patch).eq('id',b.dataset.partner);if(error)throw error;await refresh()})};
start().catch(e=>{$('#login').hidden=false;$('#shell').hidden=true;msg(e.message||'Configuration ou connexion impossible')});
setInterval(()=>{if(session&&!document.hidden)refresh().catch(()=>{})},60000);
})();
