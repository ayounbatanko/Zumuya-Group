(()=>{'use strict';
const C=window.ZUMAYA_CONFIG||{},$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb,user,events=[];
const fmt=n=>new Intl.NumberFormat('fr-FR').format(n||0);
const dateISO=d=>{const x=new Date(d);return x.toISOString().slice(0,10)};
function download(name,content,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function init(){
 if(!C.SUPABASE_URL||!window.supabase)throw Error('Configuration Supabase indisponible.');
 sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('compte.html');return}user=session.user;
 $('#identity').textContent=(user.user_metadata?.name||user.email||'Mon compte')+' · '+(user.user_metadata?.account_type||'compte');
 const end=new Date(),start=new Date();start.setDate(start.getDate()-29);$('#from').value=dateISO(start);$('#to').value=dateISO(end);
 $('#apply').onclick=load;$('#csv').onclick=exportCSV;$('#json').onclick=exportJSON;
 await load();
}
async function load(){
 const from=$('#from').value,to=$('#to').value;
 if(from&&to&&from>to){$('#message').textContent='La date de début doit précéder la date de fin.';return}
 $('#message').textContent='Chargement de votre historique…';
 let orgId=user.user_metadata?.organization_id||null;
 if(!orgId){const o=await sb.from('rg_organizations').select('id').eq('owner_id',user.id).limit(1).maybeSingle();orgId=o.data?.id||null}
 if(!orgId){const m=await sb.from('z_hospitality_team').select('org_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();orgId=m.data?.org_id||null}
 events=[];let offset=0,batch=[];
 do{
  let q=sb.from('rg_activity_events').select('id,org_id,actor_id,module_code,table_name,record_id,action,summary,created_at').order('created_at',{ascending:false}).range(offset,offset+999);
  q=orgId?q.or(`org_id.eq.${orgId},actor_id.eq.${user.id}`):q.eq('actor_id',user.id);
  if(from)q=q.gte('created_at',from+'T00:00:00');
  if(to)q=q.lt('created_at',new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString());
  const {data,error}=await q;if(error)throw error;batch=data||[];events.push(...batch);offset+=1000;
 }while(batch.length===1000);
 render();
 $('#message').textContent=events.length?`${events.length} événements trouvés pour la période sélectionnée.`:'Aucun événement enregistré pour cette période. Les nouvelles actions seront historisées après installation de la migration 19.';
}
function render(){
 const days={};events.forEach(e=>{const k=dateISO(e.created_at);days[k]=(days[k]||0)+1});
 const vals=Object.entries(days).sort((a,b)=>a[0].localeCompare(b[0])).slice(-21),max=Math.max(1,...vals.map(x=>x[1]));
 $('#stats').innerHTML=[['Actions enregistrées',events.length],['Jours actifs',Object.keys(days).length],['Créations',events.filter(x=>x.action==='insert').length],['Modifications',events.filter(x=>x.action==='update').length],['Suppressions',events.filter(x=>x.action==='delete').length]].map(([l,v])=>`<div class="stat"><small>${l}</small><strong>${fmt(v)}</strong></div>`).join('');
 $('#chart').innerHTML=vals.map(([d,v])=>`<div class="bar"><small>${v}</small><i style="height:${Math.max(4,v/max*145)}px"></i><small>${new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</small></div>`).join('')||'<p>Aucune donnée à afficher.</p>';
 const by={};events.forEach(e=>by[e.action]=(by[e.action]||0)+1);
 $('#breakdown').innerHTML=Object.entries(by).map(([k,v])=>`<p><span>${esc(k)}</span><b>${fmt(v)}</b></p>`).join('')||'<p>Aucune action.</p>';
 $('#history').innerHTML=events.map(e=>`<tr><td>${new Date(e.created_at).toLocaleString('fr-FR')}</td><td>${esc(e.module_code)}</td><td>${esc(e.action)}</td><td>${esc(e.table_name)}</td><td>${esc(e.summary||'')}</td></tr>`).join('')||'<tr><td colspan="5">Aucun historique disponible.</td></tr>';
}
function exportCSV(){const rows=[['Date','Pôle','Action','Table','Identifiant','Résumé'],...events.map(e=>[e.created_at,e.module_code,e.action,e.table_name,e.record_id,e.summary])];const csv=rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');download('zumuya-historique-'+($('#from').value||'debut')+'-'+($('#to').value||'fin')+'.csv','\ufeff'+csv,'text/csv;charset=utf-8')}
function exportJSON(){download('zumuya-historique-'+($('#from').value||'debut')+'-'+($('#to').value||'fin')+'.json',JSON.stringify({account:user.id,from:$('#from').value,to:$('#to').value,events},null,2),'application/json')}
init().catch(e=>{$('#message').textContent=e.message||'Erreur de chargement.'});
})();