-- ============================================================
-- ZUMUYA GROUP — MIGRATION 17 (nom Supabase : 20_livraison_zones_offres_messagerie)
-- 1) Sociétés de livraison : zones de desserte, disponibilité, tarifs
-- 2) Demandes d'expédition (Marketplace + Agro) proposées par zone et triées par distance
-- 3) Offres envoyées aux sociétés : acceptation / refus selon disponibilité
-- 4) Messagerie améliorée : contact direct client <-> vendeur / restaurant / hôtel /
--    livraison, non lus, conversations réutilisées, noms sans e-mail, temps réel
-- Migration additive et relançable. Aucune suppression de données.
-- ============================================================

create schema if not exists private;

-- ------------------------------------------------------------
-- A. Positions : vendeur Marketplace (privée) et destination des commandes
-- ------------------------------------------------------------
create table if not exists public.rg_seller_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  city text,
  address text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  updated_at timestamptz not null default now()
);
alter table public.rg_seller_locations enable row level security;
drop policy if exists seller_loc_select on public.rg_seller_locations;
create policy seller_loc_select on public.rg_seller_locations for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists seller_loc_insert on public.rg_seller_locations;
create policy seller_loc_insert on public.rg_seller_locations for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists seller_loc_update on public.rg_seller_locations;
create policy seller_loc_update on public.rg_seller_locations for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.rg_seller_locations from anon;
grant select, insert, update on public.rg_seller_locations to authenticated;

alter table public.commerce_orders
  add column if not exists delivery_city text,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision;

-- Commande Marketplace : l'acheteur peut maintenant indiquer ville et position de livraison.
create or replace function public.commerce_create_order(
  p_store_id uuid, p_items jsonb, p_delivery_address text default null,
  p_buyer_note text default null, p_delivery_fee numeric default 0,
  p_delivery_city text default null, p_delivery_lat double precision default null,
  p_delivery_lng double precision default null
) returns text language plpgsql security definer set search_path to 'public' as $f$
declare uid uuid:=auth.uid(); oid uuid; num text; it jsonb; pr public.commerce_products%rowtype; q int; sub numeric:=0;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if not private.commerce_store_public(p_store_id) then raise exception 'Boutique indisponible'; end if;
  if private.commerce_owns_store(p_store_id) then raise exception 'Vous ne pouvez pas commander dans votre propre boutique'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Panier invalide'; end if;
  if p_delivery_lat is not null and (p_delivery_lat not between -90 and 90) then raise exception 'Latitude invalide'; end if;
  if p_delivery_lng is not null and (p_delivery_lng not between -180 and 180) then raise exception 'Longitude invalide'; end if;
  num:='ZM-'||to_char(now(),'YYMMDD')||'-'||lpad(nextval('public.commerce_order_seq')::text,5,'0');
  insert into public.commerce_orders(order_number,store_id,buyer_id,subtotal,delivery_fee,delivery_address,buyer_note,delivery_city,delivery_lat,delivery_lng)
    values(num,p_store_id,uid,0,0,left(p_delivery_address,300),left(p_buyer_note,1000),left(nullif(trim(p_delivery_city),''),80),
           case when p_delivery_lng is null then null else p_delivery_lat end,
           case when p_delivery_lat is null then null else p_delivery_lng end) returning id into oid;
  for it in select * from jsonb_array_elements(p_items) loop
    q:=(it->>'quantity')::int;
    if q is null or q<1 or q>9999 then raise exception 'Quantité invalide'; end if;
    select * into pr from public.commerce_products where id=(it->>'product_id')::uuid and store_id=p_store_id and status='active' for update;
    if not found then raise exception 'Produit indisponible'; end if;
    if pr.stock_quantity<q then raise exception 'Stock insuffisant pour « % »', pr.title; end if;
    update public.commerce_products set stock_quantity=stock_quantity-q where id=pr.id;
    insert into public.commerce_order_items(order_id,product_id,title,unit_price,quantity) values(oid,pr.id,pr.title,pr.price,q);
    sub:=sub+pr.price*q;
  end loop;
  update public.commerce_orders set subtotal=sub where id=oid;
  return num;
end $f$;
drop function if exists public.commerce_create_order(uuid,jsonb,text,text,numeric);
revoke all on function public.commerce_create_order(uuid,jsonb,text,text,numeric,text,double precision,double precision) from public, anon;
grant execute on function public.commerce_create_order(uuid,jsonb,text,text,numeric,text,double precision,double precision) to authenticated;

-- ------------------------------------------------------------
-- B. Sociétés de livraison : disponibilité et zones de desserte
-- ------------------------------------------------------------
create table if not exists public.rg_delivery_providers (
  org_id uuid primary key references public.rg_organizations(id) on delete cascade,
  is_available boolean not null default true,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.rg_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rg_organizations(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  city text,
  country_code text,
  center_lat double precision check (center_lat is null or center_lat between -90 and 90),
  center_lng double precision check (center_lng is null or center_lng between -180 and 180),
  radius_km numeric not null default 15 check (radius_km > 0 and radius_km <= 1000),
  base_fee numeric not null default 0 check (base_fee >= 0),
  per_km_fee numeric not null default 0 check (per_km_fee >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((center_lat is null) = (center_lng is null)),
  check (center_lat is not null or nullif(trim(coalesce(city,'')),'') is not null)
);
create index if not exists rg_delivery_zones_org_idx on public.rg_delivery_zones(org_id, is_active);

-- Une position ou une ville est couverte par une zone si elle est dans le rayon (coordonnées)
-- ou, à défaut de coordonnées, si la ville est identique.
create or replace function private.rg_zone_covers(
  z_lat double precision, z_lng double precision, z_radius numeric, z_city text,
  p_lat double precision, p_lng double precision, p_city text
) returns boolean language sql immutable set search_path = public as $f$
  select case
    when p_lat is not null and p_lng is not null and z_lat is not null and z_lng is not null
      then public.rg_dist_km(z_lat, z_lng, p_lat, p_lng) <= z_radius
    when nullif(trim(coalesce(p_city,'')),'') is not null and nullif(trim(coalesce(z_city,'')),'') is not null
      then lower(trim(p_city)) = lower(trim(z_city))
    else false end
$f$;

create or replace function private.rg_is_delivery_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $f$
  select exists(select 1 from public.rg_organizations o where o.id = p_org and o.organization_type in ('delivery','delivery_service','logistics'))
$f$;

create or replace function public.rg_delivery_set_availability(p_org uuid, p_available boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public, private as $f$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if not private.rg_is_delivery_org(p_org) then raise exception 'Cette organisation n’est pas une société de livraison.'; end if;
  if not public.rg_has_org_permission(p_org, 'orders') then raise exception 'Accès refusé.'; end if;
  insert into public.rg_delivery_providers(org_id, is_available, note)
  values (p_org, coalesce(p_available, true), left(nullif(trim(p_note),''), 300))
  on conflict (org_id) do update set is_available = excluded.is_available,
    note = coalesce(excluded.note, public.rg_delivery_providers.note), updated_at = now();
end $f$;

create or replace function public.rg_delivery_save_zone(
  p_org uuid, p_zone uuid, p_label text, p_city text, p_country text,
  p_lat double precision, p_lng double precision, p_radius numeric,
  p_base_fee numeric, p_per_km numeric, p_active boolean default true
) returns uuid language plpgsql security definer set search_path = public, private as $f$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if not private.rg_is_delivery_org(p_org) then raise exception 'Cette organisation n’est pas une société de livraison.'; end if;
  if not public.rg_has_org_permission(p_org, 'orders') then raise exception 'Accès refusé.'; end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'Renseignez la latitude et la longitude ensemble.'; end if;
  if p_lat is null and nullif(trim(coalesce(p_city,'')),'') is null then raise exception 'Indiquez une ville ou une position GPS pour la zone.'; end if;
  insert into public.rg_delivery_providers(org_id) values (p_org) on conflict (org_id) do nothing;
  if p_zone is null then
    if (select count(*) from public.rg_delivery_zones where org_id = p_org) >= 30 then raise exception 'Maximum 30 zones par société.'; end if;
    insert into public.rg_delivery_zones(org_id,label,city,country_code,center_lat,center_lng,radius_km,base_fee,per_km_fee,is_active)
    values (p_org, trim(p_label), left(nullif(trim(p_city),''),80), left(nullif(trim(p_country),''),2), p_lat, p_lng,
            coalesce(p_radius,15), coalesce(p_base_fee,0), coalesce(p_per_km,0), coalesce(p_active,true))
    returning id into v_id;
  else
    update public.rg_delivery_zones set label = trim(p_label), city = left(nullif(trim(p_city),''),80),
      country_code = left(nullif(trim(p_country),''),2), center_lat = p_lat, center_lng = p_lng,
      radius_km = coalesce(p_radius,15), base_fee = coalesce(p_base_fee,0), per_km_fee = coalesce(p_per_km,0),
      is_active = coalesce(p_active,true), updated_at = now()
    where id = p_zone and org_id = p_org returning id into v_id;
    if v_id is null then raise exception 'Zone introuvable.'; end if;
  end if;
  return v_id;
end $f$;

create or replace function public.rg_delivery_delete_zone(p_zone uuid)
returns void language plpgsql security definer set search_path = public as $f$
declare v_org uuid;
begin
  select org_id into v_org from public.rg_delivery_zones where id = p_zone;
  if v_org is null then raise exception 'Zone introuvable.'; end if;
  if not public.rg_has_org_permission(v_org, 'orders') then raise exception 'Accès refusé.'; end if;
  delete from public.rg_delivery_zones where id = p_zone;
end $f$;

-- ------------------------------------------------------------
-- C. Demandes d'expédition et offres aux sociétés de livraison
-- ------------------------------------------------------------
create sequence if not exists public.rg_delivery_seq;

create table if not exists public.rg_delivery_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  source_type text not null check (source_type in ('commerce_order','supply_order','agro_request')),
  source_id uuid not null,
  requester_id uuid not null references auth.users(id) on delete cascade,
  pickup_address text, pickup_city text,
  pickup_lat double precision check (pickup_lat is null or pickup_lat between -90 and 90),
  pickup_lng double precision check (pickup_lng is null or pickup_lng between -180 and 180),
  dest_address text, dest_city text,
  dest_lat double precision check (dest_lat is null or dest_lat between -90 and 90),
  dest_lng double precision check (dest_lng is null or dest_lng between -180 and 180),
  trip_km numeric,
  parcel_note text,
  status text not null default 'open' check (status in ('open','assigned','picked_up','delivered','cancelled')),
  assigned_org_id uuid references public.rg_organizations(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists rg_delivery_requests_active_uq
  on public.rg_delivery_requests(source_type, source_id) where status in ('open','assigned','picked_up');
create index if not exists rg_delivery_requests_requester_idx on public.rg_delivery_requests(requester_id, created_at desc);

create table if not exists public.rg_delivery_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rg_delivery_requests(id) on delete cascade,
  org_id uuid not null references public.rg_organizations(id) on delete cascade,
  distance_km numeric,
  estimated_fee numeric,
  proposed_fee numeric,
  status text not null default 'pending' check (status in ('pending','accepted','declined','closed','cancelled')),
  decline_reason text,
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  unique (request_id, org_id)
);
create index if not exists rg_delivery_offers_org_idx on public.rg_delivery_offers(org_id, status, created_at desc);

-- Sociétés proposées au vendeur : disponibles, qui desservent la zone du vendeur ET la destination,
-- triées de la plus proche à la plus éloignée de la position du vendeur.
create or replace function public.rg_delivery_suggest(
  p_pickup_lat double precision, p_pickup_lng double precision, p_pickup_city text,
  p_dest_lat double precision, p_dest_lng double precision, p_dest_city text
) returns table(org_id uuid, org_name text, org_city text, distance_km numeric, trip_km numeric, estimated_fee numeric, zone_label text)
language plpgsql stable security definer set search_path = public, private as $f$
declare v_trip double precision;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  v_trip := case when p_pickup_lat is not null and p_pickup_lng is not null and p_dest_lat is not null and p_dest_lng is not null
                 then public.rg_dist_km(p_pickup_lat, p_pickup_lng, p_dest_lat, p_dest_lng) end;
  return query
  with cand as (
    select o.id, o.public_name, o.city, o.latitude, o.longitude
    from public.rg_organizations o
    join public.rg_delivery_providers pr on pr.org_id = o.id and pr.is_available
    where o.organization_type in ('delivery','delivery_service','logistics')
      and o.verification_status = 'verified' and o.owner_id is not null and o.owner_id <> auth.uid()
  ), pz as (
    select z.org_id as oid,
           min(case when p_pickup_lat is not null and z.center_lat is not null
                    then public.rg_dist_km(z.center_lat, z.center_lng, p_pickup_lat, p_pickup_lng) end) as zdist
    from public.rg_delivery_zones z
    where z.is_active and private.rg_zone_covers(z.center_lat, z.center_lng, z.radius_km, z.city, p_pickup_lat, p_pickup_lng, p_pickup_city)
    group by z.org_id
  ), dz as (
    select distinct on (z.org_id) z.org_id as oid, z.label as zlabel, (z.base_fee + z.per_km_fee * coalesce(v_trip, 0)) as fee
    from public.rg_delivery_zones z
    where z.is_active and private.rg_zone_covers(z.center_lat, z.center_lng, z.radius_km, z.city, p_dest_lat, p_dest_lng, p_dest_city)
    order by z.org_id, (z.base_fee + z.per_km_fee * coalesce(v_trip, 0))
  )
  select c.id, c.public_name, c.city,
         round(coalesce(case when p_pickup_lat is not null and c.latitude is not null
                             then public.rg_dist_km(c.latitude, c.longitude, p_pickup_lat, p_pickup_lng) end, pz.zdist)::numeric, 1),
         round(v_trip::numeric, 1),
         round(dz.fee::numeric),
         dz.zlabel
  from cand c join pz on pz.oid = c.id join dz on dz.oid = c.id
  order by 4 asc nulls last, c.public_name
  limit 50;
end $f$;

create or replace function public.rg_delivery_request_create(
  p_source_type text, p_source_id uuid,
  p_pickup_address text, p_pickup_city text, p_pickup_lat double precision, p_pickup_lng double precision,
  p_dest_address text, p_dest_city text, p_dest_lat double precision, p_dest_lng double precision,
  p_org_ids uuid[], p_note text default null
) returns uuid language plpgsql security definer set search_path = public, private as $f$
declare
  me uuid := auth.uid(); v_id uuid; v_ref text; n int;
  co public.commerce_orders%rowtype; so public.rg_supply_orders%rowtype; ar public.rg_agro_requests%rowtype;
  v_addr text := nullif(trim(p_dest_address),''); v_city text := nullif(trim(p_dest_city),'');
  v_lat double precision := p_dest_lat; v_lng double precision := p_dest_lng; v_trip numeric;
begin
  if me is null then raise exception 'Connexion requise.'; end if;
  if p_org_ids is null or cardinality(p_org_ids) < 1 or cardinality(p_org_ids) > 10 then
    raise exception 'Choisissez entre 1 et 10 sociétés de livraison.'; end if;
  if p_source_type = 'commerce_order' then
    select * into co from public.commerce_orders where id = p_source_id;
    if not found then raise exception 'Commande introuvable.'; end if;
    if not private.commerce_owns_store(co.store_id) then raise exception 'Seul le vendeur peut demander une livraison.'; end if;
    if co.status <> 'confirmed' then raise exception 'Confirmez la commande avant de demander une livraison.'; end if;
    v_addr := coalesce(v_addr, co.delivery_address); v_city := coalesce(v_city, co.delivery_city);
    if v_lat is null or v_lng is null then v_lat := co.delivery_lat; v_lng := co.delivery_lng; end if;
  elsif p_source_type = 'supply_order' then
    select * into so from public.rg_supply_orders where id = p_source_id;
    if not found or so.supplier_id <> me then raise exception 'Seul le fournisseur peut demander une livraison.'; end if;
    if so.status <> 'confirmed' then raise exception 'Confirmez la commande avant de demander une livraison.'; end if;
    v_addr := coalesce(v_addr, so.delivery_address);
  elsif p_source_type = 'agro_request' then
    select * into ar from public.rg_agro_requests where id = p_source_id;
    if not found or ar.supplier_id <> me then raise exception 'Seul le fournisseur peut demander une livraison.'; end if;
    if ar.status <> 'accepted' then raise exception 'Acceptez la demande avant de demander une livraison.'; end if;
  else
    raise exception 'Type de commande non pris en charge.';
  end if;
  if (p_pickup_lat is null) <> (p_pickup_lng is null) or (v_lat is null) <> (v_lng is null) then
    raise exception 'Coordonnées GPS incomplètes.'; end if;
  if p_pickup_lat is null and nullif(trim(coalesce(p_pickup_city,'')),'') is null then
    raise exception 'Indiquez la ville ou la position d’enlèvement.'; end if;
  if v_lat is null and v_city is null then raise exception 'Indiquez la ville ou la position de destination.'; end if;
  if exists(select 1 from public.rg_delivery_requests where source_type = p_source_type and source_id = p_source_id
            and status in ('open','assigned','picked_up')) then
    raise exception 'Une demande de livraison est déjà en cours pour cette commande.'; end if;
  v_ref := 'LV-' || to_char(now(),'YYMMDD') || '-' || lpad(nextval('public.rg_delivery_seq')::text, 5, '0');
  v_trip := case when p_pickup_lat is not null and v_lat is not null
                 then round(public.rg_dist_km(p_pickup_lat, p_pickup_lng, v_lat, v_lng)::numeric, 1) end;
  insert into public.rg_delivery_requests(ref,source_type,source_id,requester_id,pickup_address,pickup_city,pickup_lat,pickup_lng,
      dest_address,dest_city,dest_lat,dest_lng,trip_km,parcel_note)
  values (v_ref,p_source_type,p_source_id,me,left(nullif(trim(p_pickup_address),''),300),left(nullif(trim(p_pickup_city),''),80),p_pickup_lat,p_pickup_lng,
      left(v_addr,300),left(v_city,80),v_lat,v_lng,v_trip,left(nullif(trim(p_note),''),500))
  returning id into v_id;
  -- Les sociétés sont revalidées côté serveur : disponibles ET desservant les deux extrémités.
  insert into public.rg_delivery_offers(request_id, org_id, distance_km, estimated_fee)
  select v_id, s.org_id, s.distance_km, s.estimated_fee
  from public.rg_delivery_suggest(p_pickup_lat, p_pickup_lng, p_pickup_city, v_lat, v_lng, v_city) s
  where s.org_id = any(p_org_ids);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Aucune des sociétés choisies ne dessert actuellement cette zone.'; end if;
  return v_id;
end $f$;

create or replace function public.rg_delivery_request_cancel(p_request uuid)
returns void language plpgsql security definer set search_path = public as $f$
declare r public.rg_delivery_requests%rowtype;
begin
  select * into r from public.rg_delivery_requests where id = p_request for update;
  if not found or r.requester_id <> auth.uid() then raise exception 'Demande introuvable.'; end if;
  if r.status <> 'open' then raise exception 'Cette demande a déjà été prise en charge : contactez la société par messagerie.'; end if;
  update public.rg_delivery_offers set status = 'cancelled', responded_at = now() where request_id = r.id and status = 'pending';
  update public.rg_delivery_requests set status = 'cancelled', updated_at = now() where id = r.id;
end $f$;

-- Suivi côté vendeur : demandes et réponses des sociétés
create or replace function public.rg_delivery_my_requests(p_source_type text default null, p_source_id uuid default null)
returns table(request_id uuid, ref text, source_type text, source_id uuid, request_status text, trip_km numeric, created_at timestamptz,
              offer_id uuid, org_id uuid, org_name text, org_city text, offer_status text, distance_km numeric,
              estimated_fee numeric, proposed_fee numeric, expires_at timestamptz, decline_reason text)
language plpgsql stable security definer set search_path = public as $f$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  return query
  select r.id, r.ref, r.source_type, r.source_id, r.status, r.trip_km, r.created_at,
         f.id, f.org_id, o.public_name, o.city,
         case when f.status = 'pending' and f.expires_at < now() then 'expired' else f.status end,
         f.distance_km, f.estimated_fee, f.proposed_fee, f.expires_at, f.decline_reason
  from public.rg_delivery_requests r
  left join public.rg_delivery_offers f on f.request_id = r.id
  left join public.rg_organizations o on o.id = f.org_id
  where r.requester_id = auth.uid()
    and (p_source_type is null or r.source_type = p_source_type)
    and (p_source_id is null or r.source_id = p_source_id)
  order by r.created_at desc, f.distance_km asc nulls last
  limit 300;
end $f$;

-- Boîte de réception d'une société de livraison. Les adresses exactes ne sont révélées qu'après acceptation.
create or replace function public.rg_delivery_inbox(p_org uuid)
returns table(offer_id uuid, request_id uuid, ref text, source_type text, offer_status text, request_status text,
              expires_at timestamptz, created_at timestamptz, distance_km numeric, trip_km numeric, estimated_fee numeric,
              proposed_fee numeric, pickup_city text, dest_city text, parcel_note text, pickup_address text, dest_address text,
              requester_name text)
language plpgsql stable security definer set search_path = public, private as $f$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if not public.rg_has_org_permission(p_org, 'orders') then raise exception 'Accès refusé.'; end if;
  return query
  select f.id, r.id, r.ref, r.source_type,
         case when f.status = 'pending' and f.expires_at < now() then 'expired' else f.status end,
         r.status, f.expires_at, f.created_at, f.distance_km, r.trip_km, f.estimated_fee, f.proposed_fee,
         r.pickup_city, r.dest_city, r.parcel_note,
         case when f.status = 'accepted' then r.pickup_address end,
         case when f.status = 'accepted' then r.dest_address end,
         private.rg_display_name(r.requester_id)
  from public.rg_delivery_offers f
  join public.rg_delivery_requests r on r.id = f.request_id
  where f.org_id = p_org
  order by f.created_at desc
  limit 200;
end $f$;

create or replace function public.rg_delivery_respond(p_offer uuid, p_accept boolean, p_fee numeric default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public, private as $f$
declare
  f public.rg_delivery_offers%rowtype; r public.rg_delivery_requests%rowtype;
  me uuid := auth.uid(); cid uuid; v_fee numeric; v_org text;
begin
  if me is null then raise exception 'Connexion requise.'; end if;
  select * into f from public.rg_delivery_offers where id = p_offer for update;
  if not found then raise exception 'Offre introuvable.'; end if;
  if not public.rg_has_org_permission(f.org_id, 'orders') then raise exception 'Accès refusé.'; end if;
  select * into r from public.rg_delivery_requests where id = f.request_id for update;
  if f.status <> 'pending' then raise exception 'Cette offre a déjà reçu une réponse.'; end if;
  if f.expires_at < now() then raise exception 'Cette offre a expiré.'; end if;
  if r.status <> 'open' then raise exception 'Cette demande n’est plus disponible.'; end if;
  select public_name into v_org from public.rg_organizations where id = f.org_id;
  if p_accept then
    v_fee := coalesce(p_fee, f.estimated_fee);
    if v_fee is not null and v_fee < 0 then raise exception 'Tarif invalide.'; end if;
    update public.rg_delivery_offers set status = 'accepted', proposed_fee = v_fee, responded_by = me, responded_at = now() where id = f.id;
    update public.rg_delivery_offers set status = 'closed', responded_at = now() where request_id = r.id and id <> f.id and status = 'pending';
    update public.rg_delivery_requests set status = 'assigned', assigned_org_id = f.org_id, assigned_at = now(), updated_at = now() where id = r.id;
    cid := private.rg_chat_between(me, r.requester_id, 'Livraison ' || r.ref, 'delivery_request', r.id::text);
    update public.rg_market_conversation_members set display_name = coalesce(v_org, display_name) where conversation_id = cid and user_id = me;
    insert into public.rg_market_messages(conversation_id, sender_id, body, kind)
    values (cid, me, '✅ ' || coalesce(v_org,'La société de livraison') || ' a accepté la livraison ' || r.ref ||
            coalesce(' — tarif : ' || round(v_fee)::text || ' FCFA', '') || '. Vous pouvez convenir ici des détails de l’enlèvement.', 'system');
    return cid;
  else
    update public.rg_delivery_offers set status = 'declined', decline_reason = left(nullif(trim(p_reason),''), 300),
      responded_by = me, responded_at = now() where id = f.id;
    return null;
  end if;
end $f$;

create or replace function public.rg_delivery_set_status(p_request uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $f$
declare r public.rg_delivery_requests%rowtype;
begin
  if p_status not in ('picked_up','delivered') then raise exception 'Statut invalide.'; end if;
  select * into r from public.rg_delivery_requests where id = p_request for update;
  if not found or r.assigned_org_id is null or not public.rg_has_org_permission(r.assigned_org_id, 'orders') then
    raise exception 'Accès refusé.'; end if;
  if not ((r.status = 'assigned' and p_status = 'picked_up') or (r.status in ('assigned','picked_up') and p_status = 'delivered')) then
    raise exception 'Changement de statut non autorisé.'; end if;
  update public.rg_delivery_requests set status = p_status, updated_at = now() where id = r.id;
  if r.source_type = 'commerce_order' then
    if p_status = 'picked_up' then update public.commerce_orders set status = 'shipped' where id = r.source_id and status = 'confirmed';
    else update public.commerce_orders set status = 'delivered' where id = r.source_id and status in ('confirmed','shipped'); end if;
  end if;
end $f$;

-- RLS : lecture seule côté client ; toutes les écritures passent par les fonctions ci-dessus.
alter table public.rg_delivery_providers enable row level security;
alter table public.rg_delivery_zones enable row level security;
alter table public.rg_delivery_requests enable row level security;
alter table public.rg_delivery_offers enable row level security;

drop policy if exists delivery_providers_read on public.rg_delivery_providers;
create policy delivery_providers_read on public.rg_delivery_providers for select to authenticated
  using (public.rg_has_org_permission(org_id, 'orders'));
drop policy if exists delivery_zones_read on public.rg_delivery_zones;
create policy delivery_zones_read on public.rg_delivery_zones for select to authenticated
  using (public.rg_has_org_permission(org_id, 'orders'));
drop policy if exists delivery_requests_read on public.rg_delivery_requests;
create policy delivery_requests_read on public.rg_delivery_requests for select to authenticated
  using (requester_id = (select auth.uid()));
drop policy if exists delivery_offers_read on public.rg_delivery_offers;
create policy delivery_offers_read on public.rg_delivery_offers for select to authenticated
  using (public.rg_has_org_permission(org_id, 'orders')
         or exists (select 1 from public.rg_delivery_requests r where r.id = request_id and r.requester_id = (select auth.uid())));

revoke all on public.rg_delivery_providers, public.rg_delivery_zones, public.rg_delivery_requests, public.rg_delivery_offers from anon;
revoke insert, update, delete on public.rg_delivery_providers, public.rg_delivery_zones, public.rg_delivery_requests, public.rg_delivery_offers from authenticated;
grant select on public.rg_delivery_providers, public.rg_delivery_zones, public.rg_delivery_requests, public.rg_delivery_offers to authenticated;

-- ------------------------------------------------------------
-- D. Messagerie améliorée
-- ------------------------------------------------------------
alter table public.rg_market_conversations
  add column if not exists context_type text,
  add column if not exists context_id text,
  add column if not exists created_by uuid;
create index if not exists rg_market_conv_ctx_idx on public.rg_market_conversations(context_type, context_id);
alter table public.rg_market_messages add column if not exists kind text not null default 'text';
do $b$ begin
  alter table public.rg_market_messages add constraint rg_market_messages_kind_check check (kind in ('text','system'));
exception when duplicate_object then null; end $b$;

-- Les utilisateurs n'écrivent que des messages "text" ; les messages "system" viennent des fonctions serveur.
drop policy if exists market_messages_member_insert on public.rg_market_messages;
create policy market_messages_member_insert on public.rg_market_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and kind = 'text' and public.rg_market_is_member(conversation_id));

-- Nom affiché : boutique, organisation, profil agricole, profil ZUMUYA. Jamais l'adresse e-mail.
create or replace function private.rg_display_name(p_user uuid)
returns text language sql stable security definer set search_path = public, auth as $f$
  select coalesce(
    (select s.store_name from public.commerce_stores s where s.owner_id = p_user and s.is_active order by s.created_at limit 1),
    (select o.public_name from public.rg_organizations o where o.owner_id = p_user order by o.created_at limit 1),
    (select a.business_name from public.rg_agro_profiles a where a.user_id = p_user and nullif(trim(a.business_name),'') is not null),
    (select nullif(trim(p.display_name),'') from public.rg_profiles p where p.user_id = p_user),
    (select nullif(trim(u.raw_user_meta_data->>'name'),'') from auth.users u where u.id = p_user and (u.raw_user_meta_data->>'name') not like '%@%'),
    'Utilisateur ZUMUYA')
$f$;

-- Conversation unique par couple d'utilisateurs et par contexte (commande, livraison, produit…).
create or replace function private.rg_chat_between(a uuid, b uuid, p_subject text, p_ctx_type text, p_ctx_id text)
returns uuid language plpgsql security definer set search_path = public, auth as $f$
declare cid uuid; a_role text; b_role text;
begin
  if a is null or b is null or a = b then raise exception 'Destinataire invalide.'; end if;
  if not exists (select 1 from auth.users where id = b) then raise exception 'Ce compte utilisateur est introuvable.'; end if;
  select c.id into cid from public.rg_market_conversations c
   where c.context_type is not distinct from p_ctx_type and c.context_id is not distinct from p_ctx_id
     and exists (select 1 from public.rg_market_conversation_members m where m.conversation_id = c.id and m.user_id = a)
     and exists (select 1 from public.rg_market_conversation_members m where m.conversation_id = c.id and m.user_id = b)
     and (select count(*) from public.rg_market_conversation_members m where m.conversation_id = c.id) = 2
   order by c.updated_at desc limit 1;
  if cid is not null then return cid; end if;
  if (select count(*) from public.rg_market_conversations where created_by = a and created_at > now() - interval '24 hours') >= 60 then
    raise exception 'Trop de nouvelles conversations aujourd’hui. Réessayez demain.'; end if;
  insert into public.rg_market_conversations(subject, context_type, context_id, created_by)
  values (left(coalesce(nullif(trim(p_subject),''), 'Nouvelle conversation'), 120), p_ctx_type, p_ctx_id, a) returning id into cid;
  select raw_user_meta_data->>'account_type' into a_role from auth.users where id = a;
  select raw_user_meta_data->>'account_type' into b_role from auth.users where id = b;
  insert into public.rg_market_conversation_members(conversation_id, user_id, display_name, account_type)
  values (cid, a, private.rg_display_name(a), a_role), (cid, b, private.rg_display_name(b), b_role);
  return cid;
end $f$;

-- Ouvre (ou retrouve) une conversation. L'identifiant utilisateur du destinataire n'a pas besoin d'être public :
--   kind = 'user' | 'org' (restaurant, hôtel, entreprise…) | 'store' (boutique) | 'rest' (restaurant du service de restauration)
--        | 'delivery_offer' (échange vendeur <-> société de livraison autour d'une offre)
create or replace function public.rg_chat_open(p_kind text, p_ref text, p_subject text default null, p_ctx_type text default null, p_ctx_id text default null)
returns uuid language plpgsql security definer set search_path = public, private as $f$
declare me uuid := auth.uid(); other uuid; cid uuid; v_org uuid; v_req uuid; v_reqid uuid; v_orgname text;
begin
  if me is null then raise exception 'Connexion requise.'; end if;
  if p_ref is null then raise exception 'Destinataire invalide.'; end if;
  if p_kind in ('user','org','store','delivery_offer') and p_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Destinataire invalide.'; end if;
  if p_kind = 'user' then other := p_ref::uuid;
  elsif p_kind = 'org' then
    select owner_id into other from public.rg_organizations where id = p_ref::uuid and verification_status = 'verified';
  elsif p_kind = 'store' then
    select owner_id into other from public.commerce_stores where id = p_ref::uuid and is_active;
  elsif p_kind = 'rest' then
    select case when data->>'ownerAuthId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (data->>'ownerAuthId')::uuid end
      into other from public.rg_rests where id = p_ref;
  elsif p_kind = 'delivery_offer' then
    select f.org_id, r.requester_id, r.id into v_org, v_req, v_reqid
      from public.rg_delivery_offers f join public.rg_delivery_requests r on r.id = f.request_id where f.id = p_ref::uuid;
    if v_org is null then raise exception 'Offre introuvable.'; end if;
    select public_name into v_orgname from public.rg_organizations where id = v_org;
    if me = v_req then select owner_id into other from public.rg_organizations where id = v_org;
    elsif public.rg_has_org_permission(v_org, 'orders') then other := v_req;
    else raise exception 'Accès refusé.'; end if;
    p_ctx_type := 'delivery_request'; p_ctx_id := v_reqid::text;
  else raise exception 'Type de contact inconnu.'; end if;
  if other is null then raise exception 'Ce contact n’est pas joignable par messagerie pour le moment.'; end if;
  if other = me then raise exception 'Vous ne pouvez pas vous écrire à vous-même.'; end if;
  cid := private.rg_chat_between(me, other, p_subject, p_ctx_type, p_ctx_id);
  if p_kind = 'delivery_offer' and v_orgname is not null then
    update public.rg_market_conversation_members set display_name = v_orgname
     where conversation_id = cid and user_id <> v_req;
  end if;
  return cid;
end $f$;

-- Compatibilité avec les anciens liens messagerie.html?to=<uuid>
create or replace function public.rg_market_start_conversation(p_other_user uuid, p_subject text default 'Nouvelle conversation')
returns uuid language plpgsql security definer set search_path = public, private as $f$
begin
  return public.rg_chat_open('user', p_other_user::text, p_subject);
end $f$;

create or replace function public.rg_chat_threads()
returns table(conversation_id uuid, subject text, context_type text, context_id text, updated_at timestamptz,
              other_user_id uuid, other_name text, other_role text, last_body text, last_at timestamptz,
              last_sender uuid, last_kind text, unread_count bigint)
language sql stable security definer set search_path = public as $f$
  select c.id, c.subject, c.context_type, c.context_id, c.updated_at,
         o.user_id, o.display_name, o.account_type,
         lm.body, lm.created_at, lm.sender_id, lm.kind,
         (select count(*) from public.rg_market_messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid()
             and m.created_at > coalesce(me.last_read_at, me.joined_at))
  from public.rg_market_conversation_members me
  join public.rg_market_conversations c on c.id = me.conversation_id
  left join lateral (select x.user_id, x.display_name, x.account_type from public.rg_market_conversation_members x
                      where x.conversation_id = c.id and x.user_id <> auth.uid() limit 1) o on true
  left join lateral (select m.body, m.created_at, m.sender_id, m.kind from public.rg_market_messages m
                      where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  where me.user_id = auth.uid()
  order by coalesce(lm.created_at, c.updated_at) desc
  limit 200
$f$;

create or replace function public.rg_chat_unread_total()
returns bigint language sql stable security definer set search_path = public as $f$
  select count(*) from public.rg_market_conversation_members me
  join public.rg_market_messages m on m.conversation_id = me.conversation_id
  where me.user_id = auth.uid() and m.sender_id <> auth.uid() and m.created_at > coalesce(me.last_read_at, me.joined_at)
$f$;

create or replace function public.rg_chat_mark_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $f$
  update public.rg_market_conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid()
$f$;

-- Chaque nouveau message remonte la conversation et marque l'expéditeur comme à jour.
create or replace function private.rg_chat_after_message()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  update public.rg_market_conversations set updated_at = now() where id = new.conversation_id;
  update public.rg_market_conversation_members set last_read_at = now()
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $f$;
drop trigger if exists rg_chat_after_message_trg on public.rg_market_messages;
create trigger rg_chat_after_message_trg after insert on public.rg_market_messages
  for each row execute function private.rg_chat_after_message();

-- Temps réel (les politiques RLS s'appliquent aux abonnements)
do $b$ begin alter publication supabase_realtime add table public.rg_market_messages;
exception when duplicate_object then null; when undefined_object then null; end $b$;
do $b$ begin alter publication supabase_realtime add table public.rg_delivery_offers;
exception when duplicate_object then null; when undefined_object then null; end $b$;

-- ------------------------------------------------------------
-- E. Droits d'exécution
-- ------------------------------------------------------------
revoke all on function private.rg_zone_covers(double precision,double precision,numeric,text,double precision,double precision,text) from public, anon, authenticated;
revoke all on function private.rg_is_delivery_org(uuid) from public, anon, authenticated;
revoke all on function private.rg_display_name(uuid) from public, anon, authenticated;
revoke all on function private.rg_chat_between(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function private.rg_chat_after_message() from public, anon, authenticated;

revoke all on function public.rg_delivery_set_availability(uuid,boolean,text) from public, anon;
revoke all on function public.rg_delivery_save_zone(uuid,uuid,text,text,text,double precision,double precision,numeric,numeric,numeric,boolean) from public, anon;
revoke all on function public.rg_delivery_delete_zone(uuid) from public, anon;
revoke all on function public.rg_delivery_suggest(double precision,double precision,text,double precision,double precision,text) from public, anon;
revoke all on function public.rg_delivery_request_create(text,uuid,text,text,double precision,double precision,text,text,double precision,double precision,uuid[],text) from public, anon;
revoke all on function public.rg_delivery_request_cancel(uuid) from public, anon;
revoke all on function public.rg_delivery_my_requests(text,uuid) from public, anon;
revoke all on function public.rg_delivery_inbox(uuid) from public, anon;
revoke all on function public.rg_delivery_respond(uuid,boolean,numeric,text) from public, anon;
revoke all on function public.rg_delivery_set_status(uuid,text) from public, anon;
revoke all on function public.rg_chat_open(text,text,text,text,text) from public, anon;
revoke all on function public.rg_market_start_conversation(uuid,text) from public, anon;
revoke all on function public.rg_chat_threads() from public, anon;
revoke all on function public.rg_chat_unread_total() from public, anon;
revoke all on function public.rg_chat_mark_read(uuid) from public, anon;

grant execute on function public.rg_delivery_set_availability(uuid,boolean,text) to authenticated;
grant execute on function public.rg_delivery_save_zone(uuid,uuid,text,text,text,double precision,double precision,numeric,numeric,numeric,boolean) to authenticated;
grant execute on function public.rg_delivery_delete_zone(uuid) to authenticated;
grant execute on function public.rg_delivery_suggest(double precision,double precision,text,double precision,double precision,text) to authenticated;
grant execute on function public.rg_delivery_request_create(text,uuid,text,text,double precision,double precision,text,text,double precision,double precision,uuid[],text) to authenticated;
grant execute on function public.rg_delivery_request_cancel(uuid) to authenticated;
grant execute on function public.rg_delivery_my_requests(text,uuid) to authenticated;
grant execute on function public.rg_delivery_inbox(uuid) to authenticated;
grant execute on function public.rg_delivery_respond(uuid,boolean,numeric,text) to authenticated;
grant execute on function public.rg_delivery_set_status(uuid,text) to authenticated;
grant execute on function public.rg_chat_open(text,text,text,text,text) to authenticated;
grant execute on function public.rg_market_start_conversation(uuid,text) to authenticated;
grant execute on function public.rg_chat_threads() to authenticated;
grant execute on function public.rg_chat_unread_total() to authenticated;
grant execute on function public.rg_chat_mark_read(uuid) to authenticated;

notify pgrst, 'reload schema';
-- FIN MIGRATION 17
