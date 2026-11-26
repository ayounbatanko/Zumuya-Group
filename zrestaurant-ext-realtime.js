/* Supabase Realtime : rafraîchit instantanément les données dès qu'une ligne change (le polling de zrestaurant-db.js reste en secours, ralenti). */
(function(){var X=window.ZUMUYA_EXT;if(!X)return;
var URL=window.ZUMUYA_EXT_SUPABASE_URL;
function start(key){
  var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  s.onload=function(){try{var c=supabase.createClient(URL,key,{realtime:{params:{eventsPerSecond:10}}});
    ['rg_orders','rg_users','rg_rests','rg_chats'].forEach(function(t){c.channel('zmy-ext-'+t).on('postgres_changes',{event:'*',schema:'public',table:t},function(){if(window.RGDB&&RGDB.refresh)RGDB.refresh()}).subscribe()})}catch(e){console.warn('Realtime',e)}};
  document.head.appendChild(s)}
/* La clé anonyme est lue dans window.ZUMUYA_EXT_ANON_KEY (définie dans zrestaurant-ext-loader.js) pour ne pas être dupliquée */
start(window.ZUMUYA_EXT_ANON_KEY);
})();
