-- ZUMUYA GROUP — INSTALLATION SUPABASE CONSOLIDÉE
-- Coller en une fois dans Supabase > SQL Editor > New query.
-- Activer Authentication > Providers > Phone et configurer un fournisseur SMS.

-- ZUMUYA GROUP — schéma du PORTAIL (comptes, partenaires, espace propriétaire)
-- À exécuter UNE fois dans Supabase > SQL Editor > Run, sur le projet de config.js.
-- Ce script est relançable sans risque (create if not exists / drop policy if exists).

create extension if not exists pgcrypto;

-- ===== Pays =====
create table if not exists public.rg_countries (
  code text primary key,
  name text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.rg_countries (code, name, enabled) values
  ('NE','Niger',true),('BF','Burkina Faso',false),('ML','Mali',false),('BJ','Bénin',false),
  ('TG','Togo',false),('CI','Côte d''Ivoire',false),('SN','Sénégal',false),('GH','Ghana',false),
  ('NG','Nigeria',false)
on conflict (code) do nothing;

-- ===== Propriétaires de la plateforme =====
create table if not exists public.rg_platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.rg_is_platform_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rg_platform_owners where user_id = auth.uid())
$$;

create or replace function public.rg_platform_set_country_enabled(p_code text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.rg_is_platform_owner() then
    raise exception 'Accès réservé au propriétaire de la plateforme.';
  end if;
  update public.rg_countries set enabled = p_enabled where code = p_code;
end $$;

-- ===== Profils (un par compte Supabase Auth) =====
create table if not exists public.rg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.rg_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rg_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', nullif(split_part(coalesce(new.email,''),'@',1),''), new.phone, 'Utilisateur'))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists rg_on_auth_user_created on auth.users;
create trigger rg_on_auth_user_created after insert on auth.users
  for each row execute function public.rg_handle_new_user();
-- Comptes déjà existants :
insert into public.rg_profiles (user_id, display_name)
  select id, coalesce(raw_user_meta_data->>'name', nullif(split_part(coalesce(email,''),'@',1),''), phone, 'Utilisateur') from auth.users
on conflict (user_id) do nothing;

-- ===== Organisations, établissements, activité, paiements =====
create table if not exists public.rg_organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text,
  public_name text not null,
  country_code text references public.rg_countries(code),
  organization_type text,
  city text, address text, contact_phone text, latitude double precision, longitude double precision, details jsonb not null default '{}'::jsonb,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected','suspended')),
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.rg_establishments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.rg_organizations(id) on delete cascade,
  name text,
  city text,
  created_at timestamptz not null default now()
);
create table if not exists public.rg_service_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.rg_organizations(id) on delete cascade,
  module_code text,
  record_type text,
  status text,
  created_at timestamptz not null default now()
);
create table if not exists public.rg_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.rg_organizations(id) on delete set null,
  module_code text,
  amount_minor bigint not null default 0,
  currency_code text not null default 'XOF',
  provider text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ===== Demandes de partenariat (compte.html) =====
create table if not exists public.rg_partner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  country_code text references public.rg_countries(code),
  city text,
  organization_name text not null,
  contact_phone text,
  contact_email text,
  message text,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- Une seule demande active (en attente ou acceptée) par compte et par catégorie
create unique index if not exists rg_partner_apps_active_uq
  on public.rg_partner_applications (user_id, category) where status in ('pending','approved');

create or replace function public.rg_partner_review_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists rg_partner_review on public.rg_partner_applications;
create trigger rg_partner_review before update on public.rg_partner_applications
  for each row execute function public.rg_partner_review_stamp();

-- ===== Sécurité (RLS) =====
alter table public.rg_countries            enable row level security;
alter table public.rg_platform_owners      enable row level security;
alter table public.rg_profiles             enable row level security;
alter table public.rg_organizations        enable row level security;
alter table public.rg_establishments       enable row level security;
alter table public.rg_service_records      enable row level security;
alter table public.rg_payment_transactions enable row level security;
alter table public.rg_partner_applications enable row level security;

drop policy if exists countries_read on public.rg_countries;
create policy countries_read on public.rg_countries for select to anon, authenticated using (true);

drop policy if exists profiles_read on public.rg_profiles;
create policy profiles_read on public.rg_profiles for select to authenticated
  using (user_id = auth.uid() or public.rg_is_platform_owner());
drop policy if exists profiles_upd on public.rg_profiles;
create policy profiles_upd on public.rg_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists orgs_read on public.rg_organizations;
create policy orgs_read on public.rg_organizations for select to authenticated
  using (owner_id = auth.uid() or public.rg_is_platform_owner());
drop policy if exists orgs_ins on public.rg_organizations;
create policy orgs_ins on public.rg_organizations for insert to authenticated
  with check (owner_id = auth.uid() and verification_status = 'verified');
drop policy if exists orgs_upd on public.rg_organizations;
create policy orgs_upd on public.rg_organizations for update to authenticated
  using (public.rg_is_platform_owner()) with check (public.rg_is_platform_owner());

drop policy if exists ests_read on public.rg_establishments;
create policy ests_read on public.rg_establishments for select to authenticated
  using (public.rg_is_platform_owner()
         or exists (select 1 from public.rg_organizations o where o.id = organization_id and o.owner_id = auth.uid()));

drop policy if exists records_read on public.rg_service_records;
create policy records_read on public.rg_service_records for select to authenticated
  using (public.rg_is_platform_owner()
         or exists (select 1 from public.rg_organizations o where o.id = organization_id and o.owner_id = auth.uid()));

-- Transactions : lecture seule (les statuts sont modifiés par webhook serveur avec la clé service)
drop policy if exists pay_read on public.rg_payment_transactions;
create policy pay_read on public.rg_payment_transactions for select to authenticated
  using (public.rg_is_platform_owner()
         or exists (select 1 from public.rg_organizations o where o.id = organization_id and o.owner_id = auth.uid()));

drop policy if exists apps_read on public.rg_partner_applications;
create policy apps_read on public.rg_partner_applications for select to authenticated
  using (user_id = auth.uid() or public.rg_is_platform_owner());
drop policy if exists apps_ins on public.rg_partner_applications;
create policy apps_ins on public.rg_partner_applications for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists apps_upd on public.rg_partner_applications;
create policy apps_upd on public.rg_partner_applications for update to authenticated
  using (public.rg_is_platform_owner()) with check (public.rg_is_platform_owner());

-- ===== Droits d'accès =====
grant select on public.rg_countries to anon, authenticated;
grant select, update on public.rg_profiles to authenticated;
grant select, insert, update on public.rg_organizations to authenticated;
grant select on public.rg_establishments, public.rg_service_records, public.rg_payment_transactions to authenticated;
grant select, insert, update on public.rg_partner_applications to authenticated;
grant execute on function public.rg_is_platform_owner() to anon, authenticated;
grant execute on function public.rg_platform_set_country_enabled(text, boolean) to authenticated;

-- ===== ÉTAPE FINALE : vous désigner propriétaire =====
-- 1) Créez d'abord votre compte sur compte.html (et confirmez l'e-mail).
-- 2) Remplacez l'adresse ci-dessous par la vôtre, puis exécutez ces lignes :
-- insert into public.rg_platform_owners (user_id, email)
--   select id, email from auth.users where email = 'VOTRE-EMAIL@exemple.com'
-- on conflict (user_id) do nothing;

notify pgrst, 'reload schema';


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


-- ZUMUYA AGRO — Pôle 04 : profils géolocalisés, catalogue et demandes d'approvisionnement
-- À exécuter dans Supabase SQL Editor après sql-portail.sql.
create extension if not exists pgcrypto;

create table if not exists public.rg_agro_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('restaurant','agro_producer','agro_trader')),
  business_name text not null,
  country text not null,
  city text not null,
  address text not null,
  phone text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rg_agro_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  product_name text not null,
  description text, photo_url text,
  category text not null,
  unit text not null default 'kg',
  price numeric(14,2) not null check (price >= 0),
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  availability text not null default 'available' check (availability in ('available','limited','unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rg_agro_products_owner_idx on public.rg_agro_products(owner_id);
create index if not exists rg_agro_products_category_idx on public.rg_agro_products(category);

create table if not exists public.rg_agro_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  supplier_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  product_id uuid not null references public.rg_agro_products(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rg_agro_not_self_request check (restaurant_id <> supplier_id)
);
create index if not exists rg_agro_requests_restaurant_idx on public.rg_agro_requests(restaurant_id,created_at desc);
create index if not exists rg_agro_requests_supplier_idx on public.rg_agro_requests(supplier_id,created_at desc);

alter table public.rg_agro_profiles enable row level security;
alter table public.rg_agro_products enable row level security;
alter table public.rg_agro_requests enable row level security;

drop policy if exists agro_profiles_read on public.rg_agro_profiles;
create policy agro_profiles_read on public.rg_agro_profiles for select to authenticated using (true);
drop policy if exists agro_profiles_insert on public.rg_agro_profiles;
create policy agro_profiles_insert on public.rg_agro_profiles for insert to authenticated with check (user_id = auth.uid() and role = (auth.jwt()->'user_metadata'->>'account_type'));
drop policy if exists agro_profiles_update on public.rg_agro_profiles;
create policy agro_profiles_update on public.rg_agro_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and role = (auth.jwt()->'user_metadata'->>'account_type'));

drop policy if exists agro_products_read on public.rg_agro_products;
create policy agro_products_read on public.rg_agro_products for select to anon, authenticated using (availability <> 'unavailable');
drop policy if exists agro_products_insert on public.rg_agro_products;
create policy agro_products_insert on public.rg_agro_products for insert to authenticated with check (owner_id = auth.uid() and exists(select 1 from public.rg_agro_profiles p where p.user_id=auth.uid() and p.role in ('agro_producer','agro_trader')));
drop policy if exists agro_products_update on public.rg_agro_products;
create policy agro_products_update on public.rg_agro_products for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists agro_products_delete on public.rg_agro_products;
create policy agro_products_delete on public.rg_agro_products for delete to authenticated using (owner_id = auth.uid());

drop policy if exists agro_requests_read on public.rg_agro_requests;
create policy agro_requests_read on public.rg_agro_requests for select to authenticated using (restaurant_id = auth.uid() or supplier_id = auth.uid());
drop policy if exists agro_requests_insert on public.rg_agro_requests;
create policy agro_requests_insert on public.rg_agro_requests for insert to authenticated with check (
  restaurant_id = auth.uid()
  and exists(select 1 from public.rg_agro_profiles r where r.user_id=auth.uid() and r.role='restaurant')
  and exists(select 1 from public.rg_agro_products p where p.id=product_id and p.owner_id=supplier_id and p.availability in ('available','limited'))
);
drop policy if exists agro_requests_update on public.rg_agro_requests;
create policy agro_requests_update on public.rg_agro_requests for update to authenticated using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

grant select,insert,update on public.rg_agro_profiles to authenticated;
grant select on public.rg_agro_profiles to anon;
grant select on public.rg_agro_products to anon;
grant select,insert,update,delete on public.rg_agro_products to authenticated;
grant select,insert,update on public.rg_agro_requests to authenticated;
-- Activer les mises à jour en direct si la publication Realtime existe.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rg_agro_products') then
      execute 'alter publication supabase_realtime add table public.rg_agro_products';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rg_agro_requests') then
      execute 'alter publication supabase_realtime add table public.rg_agro_requests';
    end if;
  end if;
end $$;
notify pgrst, 'reload schema';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('zumuya-agro-products','zumuya-agro-products',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists agro_product_images_public_read on storage.objects;
create policy agro_product_images_public_read on storage.objects for select to anon,authenticated using (bucket_id='zumuya-agro-products');
drop policy if exists agro_product_images_owner_insert on storage.objects;
create policy agro_product_images_owner_insert on storage.objects for insert to authenticated with check (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists agro_product_images_owner_update on storage.objects;
create policy agro_product_images_owner_update on storage.objects for update to authenticated using (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists agro_product_images_owner_delete on storage.objects;
create policy agro_product_images_owner_delete on storage.objects for delete to authenticated using (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text);



-- ===== POLITIQUES RLS FINALES : aucune politique publique globale =====
drop policy if exists rg_users_all on public.rg_users;
drop policy if exists rg_rests_all on public.rg_rests;
drop policy if exists rg_orders_all on public.rg_orders;
drop policy if exists rg_chats_all on public.rg_chats;

drop policy if exists profiles_read on public.rg_profiles;
create policy profiles_read on public.rg_profiles for select to authenticated using (user_id=auth.uid() or public.rg_is_platform_owner());
drop policy if exists profiles_upd on public.rg_profiles;
create policy profiles_upd on public.rg_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists orgs_read on public.rg_organizations;
create policy orgs_read on public.rg_organizations for select to anon,authenticated using (verification_status='verified' or owner_id=auth.uid() or public.rg_is_platform_owner());
drop policy if exists orgs_ins on public.rg_organizations;
create policy orgs_ins on public.rg_organizations for insert to authenticated with check (owner_id=auth.uid() and verification_status='verified');
drop policy if exists orgs_upd on public.rg_organizations;
create policy orgs_upd on public.rg_organizations for update to authenticated using (owner_id=auth.uid() or public.rg_is_platform_owner()) with check (owner_id=auth.uid() or public.rg_is_platform_owner());

alter table public.rg_users enable row level security;
alter table public.rg_rests enable row level security;
alter table public.rg_orders enable row level security;
alter table public.rg_chats enable row level security;
drop policy if exists rg_users_self_read on public.rg_users;
create policy rg_users_self_read on public.rg_users for select to authenticated using (data->>'authId'=auth.uid()::text or public.rg_is_platform_owner());
drop policy if exists rg_users_self_write on public.rg_users;
create policy rg_users_self_write on public.rg_users for all to authenticated using (data->>'authId'=auth.uid()::text or public.rg_is_platform_owner()) with check (data->>'authId'=auth.uid()::text or public.rg_is_platform_owner());
drop policy if exists rg_rests_public_read on public.rg_rests;
create policy rg_rests_public_read on public.rg_rests for select to anon,authenticated using (coalesce(data->>'disabled','false')<>'true');
drop policy if exists rg_rests_owner_write on public.rg_rests;
create policy rg_rests_owner_write on public.rg_rests for all to authenticated using (data->>'ownerAuthId'=auth.uid()::text or public.rg_is_platform_owner()) with check (data->>'ownerAuthId'=auth.uid()::text or public.rg_is_platform_owner());
drop policy if exists rg_orders_participant_read on public.rg_orders;
create policy rg_orders_participant_read on public.rg_orders for select to authenticated using (data->>'clientAuthId'=auth.uid()::text or data->>'driverAuthId'=auth.uid()::text or data->>'restaurantOwnerAuthId'=auth.uid()::text or public.rg_is_platform_owner());
drop policy if exists rg_orders_client_insert on public.rg_orders;
create policy rg_orders_client_insert on public.rg_orders for insert to authenticated with check (data->>'clientAuthId'=auth.uid()::text);
drop policy if exists rg_orders_participant_update on public.rg_orders;
create policy rg_orders_participant_update on public.rg_orders for update to authenticated using (data->>'clientAuthId'=auth.uid()::text or data->>'driverAuthId'=auth.uid()::text or data->>'restaurantOwnerAuthId'=auth.uid()::text or public.rg_is_platform_owner()) with check (data->>'clientAuthId'=auth.uid()::text or data->>'driverAuthId'=auth.uid()::text or data->>'restaurantOwnerAuthId'=auth.uid()::text or public.rg_is_platform_owner());
drop policy if exists rg_chats_participant on public.rg_chats;
create policy rg_chats_participant on public.rg_chats for all to authenticated using (data->>'authId'=auth.uid()::text or public.rg_is_platform_owner()) with check (data->>'authId'=auth.uid()::text or public.rg_is_platform_owner());
grant select on public.rg_rests to anon,authenticated;
grant select,insert,update,delete on public.rg_users,public.rg_rests,public.rg_orders,public.rg_chats to authenticated;
revoke all on public.rg_users,public.rg_orders,public.rg_chats from anon;
revoke all on public.rg_dispatch_tick() from public,anon,authenticated;
revoke all on public.rg_driver_accept(text,text),public.rg_driver_refuse(text,text) from public,anon,authenticated;
notify pgrst,'reload schema';
