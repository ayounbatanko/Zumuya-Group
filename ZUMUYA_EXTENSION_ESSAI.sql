-- ZUMUYA GROUP — EXTENSION ESSAI (à exécuter après SUPABASE-INSTALLATION-COMPLETE.sql)
-- Idempotent : peut être relancé sans dupliquer les tables.
create extension if not exists pgcrypto;

-- 1) Activation immédiate des organisations : statut par défaut vérifié.
alter table public.rg_organizations alter column verification_status set default 'verified';
drop policy if exists orgs_ins on public.rg_organizations;
create policy orgs_ins on public.rg_organizations for insert to authenticated
with check (owner_id = auth.uid() and verification_status = 'verified');
drop policy if exists orgs_read on public.rg_organizations;
create policy orgs_read on public.rg_organizations for select to anon, authenticated
using (verification_status = 'verified' or owner_id = auth.uid() or public.rg_is_platform_owner());
drop policy if exists orgs_upd on public.rg_organizations;
create policy orgs_upd on public.rg_organizations for update to authenticated
using (owner_id = auth.uid() or public.rg_is_platform_owner())
with check (owner_id = auth.uid() or public.rg_is_platform_owner());

-- 2) Profil client et adresses de livraison.
create table if not exists public.rg_customer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text, phone text, country_code text default '+225', avatar_url text,
 preferred_language text not null default 'fr', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.rg_customer_profiles enable row level security;
drop policy if exists customer_profile_self on public.rg_customer_profiles;
create policy customer_profile_self on public.rg_customer_profiles for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.rg_customer_profiles to authenticated;

create or replace function public.rg_sync_customer_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 if coalesce(new.raw_user_meta_data->>'account_type','') = 'customer' then
  insert into public.rg_customer_profiles(user_id,full_name,phone,country_code)
  values(new.id,new.raw_user_meta_data->>'name',new.phone,
   coalesce(new.raw_user_meta_data->>'country_code','+225'))
  on conflict(user_id) do update set full_name=excluded.full_name, phone=excluded.phone,
   country_code=excluded.country_code, updated_at=now();
 end if;
 return new;
end; $$;
drop trigger if exists rg_customer_profile_sync on auth.users;
create trigger rg_customer_profile_sync after insert or update on auth.users
for each row execute function public.rg_sync_customer_profile();

create table if not exists public.rg_customer_addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 label text not null default 'Maison', recipient_name text, phone text,
 country text not null default 'Côte d’Ivoire', city text not null, district text,
 address_details text, latitude double precision, longitude double precision,
 is_default boolean not null default false, created_at timestamptz not null default now()
);
alter table public.rg_customer_addresses enable row level security;
drop policy if exists customer_addresses_self on public.rg_customer_addresses;
create policy customer_addresses_self on public.rg_customer_addresses for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.rg_customer_addresses to authenticated;
create index if not exists rg_customer_addresses_user_idx on public.rg_customer_addresses(user_id);

create table if not exists public.rg_customer_favorites (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 item_type text not null check(item_type in ('restaurant','agro_product')),
 item_id text not null, created_at timestamptz not null default now(), unique(user_id,item_type,item_id)
);
alter table public.rg_customer_favorites enable row level security;
drop policy if exists customer_favorites_self on public.rg_customer_favorites;
create policy customer_favorites_self on public.rg_customer_favorites for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,delete on public.rg_customer_favorites to authenticated;

-- 3) Profil Agro enrichi et fiche produit professionnelle.
alter table public.rg_agro_profiles
 add column if not exists description text,
 add column if not exists logo_url text,
 add column if not exists contact_email text,
 add column if not exists whatsapp_phone text,
 add column if not exists service_radius_km numeric(8,2) not null default 30,
 add column if not exists is_active boolean not null default true,
 add column if not exists is_available boolean not null default true;
alter table public.rg_agro_products
 add column if not exists currency_code text not null default 'XOF',
 add column if not exists minimum_order numeric(14,2) not null default 1,
 add column if not exists origin_city text,
 add column if not exists harvest_date date,
 add column if not exists quality_grade text,
 add column if not exists delivery_available boolean not null default true;

-- 4) Groupes de coopération : coopérative, achat groupé, livraison groupée, marché.
create table if not exists public.rg_agro_groups (
 id uuid primary key default gen_random_uuid(), name text not null, description text,
 group_type text not null default 'cooperative' check(group_type in('cooperative','joint_purchase','joint_delivery','market_group')),
 city text, country text default 'Côte d’Ivoire', created_by uuid not null references auth.users(id),
 is_open boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.rg_agro_group_members (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.rg_agro_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 member_role text not null default 'member' check(member_role in('leader','producer','trader','transporter','member')),
 membership_status text not null default 'active' check(membership_status in('pending','active','blocked')),
 joined_at timestamptz not null default now(), unique(group_id,user_id)
);
create index if not exists rg_agro_group_members_user_idx on public.rg_agro_group_members(user_id);
create or replace function public.rg_agro_is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.rg_agro_group_members m where m.group_id=p_group and m.user_id=auth.uid() and m.membership_status='active'); $$;
create or replace function public.rg_agro_add_group_leader()
returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.rg_agro_group_members(group_id,user_id,member_role,membership_status)
 values(new.id,new.created_by,'leader','active') on conflict(group_id,user_id) do nothing; return new; end; $$;
drop trigger if exists rg_agro_group_leader_trg on public.rg_agro_groups;
create trigger rg_agro_group_leader_trg after insert on public.rg_agro_groups
for each row execute function public.rg_agro_add_group_leader();

alter table public.rg_agro_groups enable row level security;
alter table public.rg_agro_group_members enable row level security;
drop policy if exists agro_groups_read on public.rg_agro_groups;
create policy agro_groups_read on public.rg_agro_groups for select to authenticated
using(is_open or created_by=auth.uid() or public.rg_agro_is_group_member(id));
drop policy if exists agro_groups_insert on public.rg_agro_groups;
create policy agro_groups_insert on public.rg_agro_groups for insert to authenticated with check(created_by=auth.uid());
drop policy if exists agro_groups_update on public.rg_agro_groups;
create policy agro_groups_update on public.rg_agro_groups for update to authenticated
using(created_by=auth.uid() or exists(select 1 from public.rg_agro_group_members m where m.group_id=id and m.user_id=auth.uid() and m.member_role='leader' and m.membership_status='active'))
with check(created_by=auth.uid() or exists(select 1 from public.rg_agro_group_members m where m.group_id=id and m.user_id=auth.uid() and m.member_role='leader' and m.membership_status='active'));
drop policy if exists agro_group_members_read on public.rg_agro_group_members;
create policy agro_group_members_read on public.rg_agro_group_members for select to authenticated
using(user_id=auth.uid() or public.rg_agro_is_group_member(group_id));
drop policy if exists agro_group_members_join on public.rg_agro_group_members;
create policy agro_group_members_join on public.rg_agro_group_members for insert to authenticated
with check(user_id=auth.uid() and member_role in('producer','trader','transporter','member') and membership_status='active'
 and exists(select 1 from public.rg_agro_groups g where g.id=group_id and g.is_open));
drop policy if exists agro_group_members_update on public.rg_agro_group_members;
grant select,insert,update on public.rg_agro_groups to authenticated;
grant select,insert on public.rg_agro_group_members to authenticated;
grant execute on function public.rg_agro_is_group_member(uuid) to authenticated;

-- 5) Offres communes, chat, appels d'approvisionnement mutualisés.
create table if not exists public.rg_agro_group_offers (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.rg_agro_groups(id) on delete cascade,
 product_id uuid references public.rg_agro_products(id) on delete set null,
 seller_id uuid not null references auth.users(id), product_name text not null,
 quantity numeric(14,2) not null check(quantity>0), unit text not null default 'kg',
 unit_price numeric(14,2) not null check(unit_price>=0), currency_code text not null default 'XOF',
 delivery_city text, delivery_fee numeric(14,2) not null default 0, notes text,
 offer_status text not null default 'open' check(offer_status in('open','negotiating','accepted','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.rg_agro_group_messages (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.rg_agro_groups(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade, message text not null check(length(message)<=4000),
 created_at timestamptz not null default now()
);
create table if not exists public.rg_agro_group_orders (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.rg_agro_groups(id) on delete cascade,
 created_by uuid not null references auth.users(id), product_name text not null,
 quantity_target numeric(14,2) not null check(quantity_target>0), quantity_committed numeric(14,2) not null default 0,
 unit text not null default 'kg', target_price numeric(14,2), currency_code text not null default 'XOF',
 delivery_city text, deadline timestamptz,
 order_status text not null default 'collecting' check(order_status in('collecting','confirmed','in_delivery','completed','cancelled')),
 created_at timestamptz not null default now()
);
create table if not exists public.rg_agro_group_order_members (
 id uuid primary key default gen_random_uuid(), group_order_id uuid not null references public.rg_agro_group_orders(id) on delete cascade,
 user_id uuid not null references auth.users(id), quantity numeric(14,2) not null check(quantity>0),
 created_at timestamptz not null default now(), unique(group_order_id,user_id)
);

alter table public.rg_agro_group_offers enable row level security;
alter table public.rg_agro_group_messages enable row level security;
alter table public.rg_agro_group_orders enable row level security;
alter table public.rg_agro_group_order_members enable row level security;
drop policy if exists agro_group_offers_read on public.rg_agro_group_offers;
create policy agro_group_offers_read on public.rg_agro_group_offers for select to authenticated using(public.rg_agro_is_group_member(group_id));
drop policy if exists agro_group_offers_insert on public.rg_agro_group_offers;
create policy agro_group_offers_insert on public.rg_agro_group_offers for insert to authenticated with check(seller_id=auth.uid() and public.rg_agro_is_group_member(group_id) and exists(select 1 from public.rg_agro_profiles p where p.user_id=auth.uid() and p.role in('agro_producer','agro_trader')));
drop policy if exists agro_group_offers_update on public.rg_agro_group_offers;
create policy agro_group_offers_update on public.rg_agro_group_offers for update to authenticated using(seller_id=auth.uid()) with check(seller_id=auth.uid());
drop policy if exists agro_group_messages_read on public.rg_agro_group_messages;
create policy agro_group_messages_read on public.rg_agro_group_messages for select to authenticated using(public.rg_agro_is_group_member(group_id));
drop policy if exists agro_group_messages_insert on public.rg_agro_group_messages;
create policy agro_group_messages_insert on public.rg_agro_group_messages for insert to authenticated with check(sender_id=auth.uid() and public.rg_agro_is_group_member(group_id));
drop policy if exists agro_group_orders_read on public.rg_agro_group_orders;
create policy agro_group_orders_read on public.rg_agro_group_orders for select to authenticated using(public.rg_agro_is_group_member(group_id));
drop policy if exists agro_group_orders_insert on public.rg_agro_group_orders;
create policy agro_group_orders_insert on public.rg_agro_group_orders for insert to authenticated with check(created_by=auth.uid() and public.rg_agro_is_group_member(group_id));
drop policy if exists agro_group_orders_update on public.rg_agro_group_orders;
create policy agro_group_orders_update on public.rg_agro_group_orders for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
drop policy if exists agro_group_order_members_read on public.rg_agro_group_order_members;
create policy agro_group_order_members_read on public.rg_agro_group_order_members for select to authenticated
using(user_id=auth.uid() or exists(select 1 from public.rg_agro_group_orders o where o.id=group_order_id and public.rg_agro_is_group_member(o.group_id)));
drop policy if exists agro_group_order_members_insert on public.rg_agro_group_order_members;
create policy agro_group_order_members_insert on public.rg_agro_group_order_members for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.rg_agro_group_orders o where o.id=group_order_id and o.order_status='collecting' and public.rg_agro_is_group_member(o.group_id)));
grant select,insert,update on public.rg_agro_group_offers,public.rg_agro_group_orders to authenticated;
grant select,insert on public.rg_agro_group_messages,public.rg_agro_group_order_members to authenticated;

-- 6) Realtime pour les espaces collaboratifs.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['rg_agro_group_members','rg_agro_group_offers','rg_agro_group_messages','rg_agro_group_orders','rg_agro_group_order_members'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
notify pgrst,'reload schema';
-- Fin : configurez Auth Phone sans confirmation dans le Dashboard pour l'essai.

-- Participation atomique à un achat collectif : empêche les doublons
-- et met à jour la quantité engagée dans une seule transaction.
create or replace function public.rg_agro_join_group_order(p_order_id uuid,p_quantity numeric)
returns void language plpgsql security definer set search_path=public as $$
declare v_group uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantité invalide'; end if;
 select group_id,order_status into v_group,v_status from public.rg_agro_group_orders where id=p_order_id for update;
 if v_group is null then raise exception 'Besoin collectif introuvable'; end if;
 if v_status<>'collecting' then raise exception 'Ce besoin n’accepte plus de participation'; end if;
 if not public.rg_agro_is_group_member(v_group) then raise exception 'Vous devez être membre du collectif'; end if;
 insert into public.rg_agro_group_order_members(group_order_id,user_id,quantity)
 values(p_order_id,auth.uid(),p_quantity);
 update public.rg_agro_group_orders set quantity_committed=quantity_committed+p_quantity where id=p_order_id;
end; $$;
grant execute on function public.rg_agro_join_group_order(uuid,numeric) to authenticated;
