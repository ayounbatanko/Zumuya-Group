-- ZUMUYA GROUP — schéma UNIQUE de coordination des pôles 1 (Restauration), 2 (Hôtel), 3 (Livraison)
-- Exécuter dans Supabase > SQL Editor, sur le projet de config.js, APRÈS sql-portail.sql. Relançable sans risque.

-- ===== Tables du Service de Restauration =====
create table if not exists public.rg_users  (id text primary key, data jsonb not null, seq bigint generated always as identity);
create table if not exists public.rg_rests  (id text primary key, data jsonb not null, seq bigint generated always as identity);
create table if not exists public.rg_orders (id text primary key, data jsonb not null, seq bigint generated always as identity);
create table if not exists public.rg_chats  (id text primary key, data jsonb not null, seq bigint generated always as identity);
create index if not exists rg_users_seq_idx on public.rg_users(seq);
create index if not exists rg_rests_seq_idx on public.rg_rests(seq);
create index if not exists rg_orders_seq_idx on public.rg_orders(seq);
create index if not exists rg_chats_seq_idx on public.rg_chats(seq);
create index if not exists rg_orders_rest_idx   on public.rg_orders ((data->>'restId'));
create index if not exists rg_orders_client_idx on public.rg_orders ((data->>'clientId'));
create index if not exists rg_orders_driver_idx on public.rg_orders ((data->>'driverId'));
create index if not exists rg_orders_status_idx on public.rg_orders ((data->>'status'));

do $$ declare t text; begin
  foreach t in array array['rg_users','rg_rests','rg_orders','rg_chats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    -- Les politiques fines sont ajoutées à la fin du script consolidé.
    execute format('revoke all on public.%I from anon, authenticated', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ===== Intégrité des commandes : plus d'écrasement entre restaurant, livreur et réception =====
create or replace function public.rg_status_rank(s text) returns int language sql immutable as $$
  select case s when 'en attente' then 0 when 'acceptée' then 1 when 'préparée' then 2 when 'en route' then 3 when 'terminée' then 4 else null end $$;

create or replace function public.rg_orders_guard() returns trigger language plpgsql as $$
declare k text; ro int; rn int;
begin
  if left(new.id,7) = '__chat_' then return new; end if;
  -- fusion : une version plus ancienne ne peut pas effacer les clés posées par un autre acteur
  new.data := old.data || new.data;
  foreach k in array array['driverId','driverPos','settled'] loop
    if old.data->k is not null and old.data->k <> 'null'::jsonb
       and (new.data->k is null or new.data->k = 'null'::jsonb) then
      new.data := jsonb_set(new.data, array[k], old.data->k);
    end if;
  end loop;
  -- le statut ne recule jamais (sauf annulation / refus)
  ro := public.rg_status_rank(old.data->>'status'); rn := public.rg_status_rank(new.data->>'status');
  if ro is not null and rn is not null and rn < ro then
    new.data := jsonb_set(new.data, '{status}', old.data->'status');
  end if;
  return new;
end $$;
drop trigger if exists rg_orders_guard_trg on public.rg_orders;
create trigger rg_orders_guard_trg before update on public.rg_orders for each row execute function public.rg_orders_guard();

-- ===== Pôle 3 : attribution des livreurs CÔTÉ SERVEUR (fonctionne appli fermée) =====
create or replace function public.rg_dist_km(a1 double precision, o1 double precision, a2 double precision, o2 double precision)
returns double precision language sql immutable as $$
  select 2*6371*asin(sqrt(sin(radians(a2-a1)/2)^2 + cos(radians(a1))*cos(radians(a2))*sin(radians(o2-o1)/2)^2)) $$;

create or replace function public.rg_now_ms() returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp())*1000)::bigint $$;

create or replace function public.rg_dispatch_order(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare o jsonb; r jsonb; best text; tried jsonb; anyd boolean;
begin
  select data into o from rg_orders where id = p_id for update;
  if o is null then return; end if;
  if o->>'status' not in ('acceptée','préparée') or coalesce(o->>'driverId','') <> ''
     or coalesce(o->>'deliveryMode','') = 'room' or coalesce(o->>'serviceType','') = 'À emporter' then return; end if;
  if o->'offer' is not null and o->'offer' <> 'null'::jsonb
     and coalesce((o->'offer'->>'expires')::bigint,0) > rg_now_ms() then return; end if;
  select data into r from rg_rests where id = o->>'restId';
  if r is null then return; end if;
  tried := coalesce(o->'offerTried','[]'::jsonb);
  select u.data->>'id' into best from rg_users u
   where u.data->>'role' = 'driver'
     and coalesce(u.data->>'disabled','false') <> 'true' and coalesce(u.data->>'inactive','false') <> 'true'
     and (coalesce(u.data->>'restId','') = '' or u.data->>'restId' = o->>'restId')
     and not jsonb_exists(tried, u.data->>'id')
     and not exists (select 1 from rg_orders x where x.data->>'driverId' = u.data->>'id'
                       and coalesce(x.data->>'status','') not in ('terminée','annulée','refusée'))
   order by case when u.data->>'lat' is not null and r->>'lat' is not null
            then rg_dist_km((u.data->>'lat')::double precision,(u.data->>'lng')::double precision,
                            (r->>'lat')::double precision,(r->>'lng')::double precision) else 9999 end
   limit 1;
  if best is null then
    -- plus personne à solliciter : on repart du début au prochain passage (sans réécrire inutilement)
    if (o->'offer' is not null and o->'offer' <> 'null'::jsonb) or jsonb_array_length(tried) > 0 then
      update rg_orders set data = data || jsonb_build_object('offer', null, 'offerTried', '[]'::jsonb) where id = p_id;
    end if;
    return;
  end if;
  update rg_orders set data = data || jsonb_build_object(
      'offer', jsonb_build_object('driverId', best, 'expires', rg_now_ms() + 90000),
      'offerTried', tried || to_jsonb(best)) where id = p_id;
end $$;

create or replace function public.rg_dispatch_tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from rg_orders
            where data->>'status' in ('acceptée','préparée') and coalesce(data->>'driverId','') = ''
              and coalesce(data->>'deliveryMode','') <> 'room' and coalesce(data->>'serviceType','') <> 'À emporter'
  loop perform rg_dispatch_order(r.id); end loop;
end $$;

create or replace function public.rg_orders_dispatch_trg() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  perform public.rg_dispatch_order(new.id);
  return new;
end $$;
drop trigger if exists rg_orders_dispatch on public.rg_orders;
create trigger rg_orders_dispatch after insert or update on public.rg_orders
  for each row when (new.data->>'status' in ('acceptée','préparée') and coalesce(new.data->>'driverId','') = '')
  execute function public.rg_orders_dispatch_trg();

-- Acceptation / refus atomiques par le livreur
create or replace function public.rg_driver_accept(p_order text, p_driver text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o jsonb;
begin
  select data into o from rg_orders where id = p_order for update;
  if o is null or coalesce(o->>'driverId','') <> '' or (o->'offer'->>'driverId') is distinct from p_driver then return false; end if;
  update rg_orders set data = data || jsonb_build_object('driverId', p_driver, 'offer', null) where id = p_order;
  return true;
end $$;

create or replace function public.rg_driver_refuse(p_order text, p_driver text) returns void
language plpgsql security definer set search_path = public as $$
declare o jsonb;
begin
  select data into o from rg_orders where id = p_order for update;
  if o is null or (o->'offer'->>'driverId') is distinct from p_driver then return; end if;
  update rg_orders set data = data || jsonb_build_object('offer', jsonb_build_object('driverId', p_driver, 'expires', 0)) where id = p_order;
  perform rg_dispatch_order(p_order);
end $$;

revoke all on function public.rg_dispatch_tick() from public, anon, authenticated;
revoke all on function public.rg_driver_accept(text,text), public.rg_driver_refuse(text,text) from public, anon, authenticated;

-- Passage régulier toutes les 15 s (expiration des offres de 90 s)
do $$ begin
  create extension if not exists pg_cron;
  delete from cron.job where jobname = 'rg-dispatch';
  perform cron.schedule('rg-dispatch', '15 seconds', 'select public.rg_dispatch_tick()');
exception when others then
  raise notice 'pg_cron indisponible (%) : activez-le dans Database > Extensions puis relancez ce script.', sqlerrm;
end $$;

-- ===== Pôle 2 : vue des notes de chambre en cours (réception, propriétaire) =====
create or replace view public.rg_room_folios with (security_invoker = true) as
select o.data->>'restId' as rest_id,
       coalesce(o.data->>'buildingNumber','?') as building,
       coalesce(o.data->>'roomNumber','?') as room,
       count(*) as nb_orders,
       sum(coalesce((o.data->>'total')::numeric,0)) as total
  from public.rg_orders o
 where o.data->>'deliveryMode' = 'room'
   and coalesce(o.data->>'status','') not in ('annulée','refusée')
   and o.data->>'settled' is null
 group by 1,2,3;
grant select on public.rg_room_folios to anon, authenticated;

notify pgrst, 'reload schema';
