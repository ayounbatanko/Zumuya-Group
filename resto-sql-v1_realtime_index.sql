-- ÉTAPE 1 (sans risque) : active Realtime et ajoute des index. À exécuter dans Supabase > SQL Editor.
alter publication supabase_realtime add table public.rg_orders;
alter publication supabase_realtime add table public.rg_users;
alter publication supabase_realtime add table public.rg_rests;
alter publication supabase_realtime add table public.rg_chats;

create index if not exists rg_orders_rest_idx   on public.rg_orders ((data->>'restId'));
create index if not exists rg_orders_client_idx on public.rg_orders ((data->>'clientId'));
create index if not exists rg_orders_driver_idx on public.rg_orders ((data->>'driverId'));
create index if not exists rg_orders_status_idx on public.rg_orders ((data->>'status'));
