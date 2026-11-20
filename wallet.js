(()=>{'use strict';
const c=window.ZUMAYA_CONFIG||{};if(!window.supabase||!c.SUPABASE_URL)return;
const $=s=>document.querySelector(s);if(!$('#walletPanel'))return;
const sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
let user=null;
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n||0))+' FCFA';
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function note(t){$('#walletNotice').textContent=t}
async function load(){
 const {data:{session}}=await sb.auth.getSession();if(!session)return;user=session.user;
 const [w,l,m]=await Promise.all([
  sb.from('rg_wallets').select('balance_minor,currency_code').eq('user_id',user.id).maybeSingle(),
  sb.from('rg_wallet_ledger').select('entry_type,amount_minor,direction,status,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
  sb.from('rg_wallet_payout_methods').select('method_type,destination').eq('user_id',user.id).maybeSingle()
 ]);
 if(w.error){$('#walletBalance').textContent='À configurer';note('Exécutez 07_portefeuilles_commissions.sql dans Supabase pour activer le portefeuille.');return}
 $('#walletBalance').textContent=money(w.data?.balance_minor||0);
 if(!m.error&&m.data){$('#walletMethodForm [name=method]').value=m.data.method_type;$('#walletMethodForm [name=destination]').value=m.data.destination;}
 if(l.error){$('#walletLedger').innerHTML='<p class="muted">Historique indisponible.</p>';return}
 $('#walletLedger').innerHTML=(l.data||[]).map(x=>`<div class="entry"><span>${esc(x.description||x.entry_type)}<small class="muted"> · ${new Date(x.created_at).toLocaleString('fr-FR')} · ${esc(x.status)}</small></span><b class="${x.direction}">${x.direction==='credit'?'+':'−'}${money(x.amount_minor)}</b></div>`).join('')||'<p class="muted">Aucune opération pour le moment.</p>';
}
$('#walletDeposit')?.addEventListener('click',()=>note('Dépôt en attente de configuration du prestataire Mobile Money / carte. Aucun solde ne sera crédité avant confirmation sécurisée du paiement.'));
$('#walletMethodForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));
 const {error}=await sb.from('rg_wallet_payout_methods').upsert({user_id:user.id,method_type:f.method,destination:f.destination.trim()},{onConflict:'user_id'});
 note(error?error.message:'Moyen de retrait enregistré.'); 
});
$('#walletWithdrawToggle')?.addEventListener('click',()=>$('#walletWithdrawForm').hidden=!$('#walletWithdrawForm').hidden);
$('#walletWithdrawForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const amount=Math.round(Number(f.amount));
 if(!amount||amount<=0)return note('Saisissez un montant valide.');
 const {data:methodRow,error:methodError}=await sb.from('rg_wallet_payout_methods').select('method_type,destination').eq('user_id',user.id).maybeSingle();
 if(methodError||!methodRow){note('Enregistrez d’abord votre moyen de retrait.');return}
 const method={type:methodRow.method_type,destination:methodRow.destination};
 const {error}=await sb.rpc('rg_wallet_request_withdrawal',{p_amount_minor:amount,p_method:method});
 if(error){note(error.message);return}
 e.currentTarget.reset();e.currentTarget.hidden=true;note('Demande de retrait enregistrée. Elle sera traitée après vérification du moyen de paiement.');await load();
});
window.RGWalletLoad=()=>load().catch(e=>note(e.message));load().catch(e=>note(e.message));
})();