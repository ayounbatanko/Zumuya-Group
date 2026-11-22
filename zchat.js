/* ZUMUYA GROUP — pastille de messages non lus sur les liens « Messagerie » de toutes les pages. */
(()=>{'use strict';
const links=[...document.querySelectorAll('a[href="messagerie.html"]')],c=window.ZUMAYA_CONFIG||{};
if(!links.length||!window.supabase||!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)return;
let sb;try{sb=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY)}catch(_){return}
const st=document.createElement('style');st.textContent='.zc-badge{background:#e63946;color:#fff;border-radius:99px;padding:1px 7px;font-size:.72rem;font-weight:800;margin-left:6px;display:inline-block}';document.head.appendChild(st);
async function refresh(){try{const {data:{session}}=await sb.auth.getSession();if(!session)return;const {data,error}=await sb.rpc('rg_chat_unread_total');if(error)return;const n=Number(data)||0;
  links.forEach(a=>{let b=a.querySelector('.zc-badge');if(!n){if(b)b.remove();return}if(!b){b=document.createElement('b');b.className='zc-badge';a.appendChild(b)}b.textContent=n>99?'99+':String(n)})}catch(_){}}
refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);
try{sb.channel('zchat-badge').on('postgres_changes',{event:'INSERT',schema:'public',table:'rg_market_messages'},refresh).subscribe()}catch(_){}
})();
