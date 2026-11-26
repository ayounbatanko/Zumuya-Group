-- ZUMUYA GROUP — 11 : équipes, livreurs rattachés, permissions, audit, approvisionnement professionnel.
-- Idempotent : peut être rejoué. À exécuter dans Supabase > SQL Editor APRÈS 00_RESET… et 07_… (portefeuilles).
-- Règle : toute restriction est contrôlée ICI (RLS + fonctions SECURITY DEFINER), pas seulement dans l'interface.

-- ============================================================================
-- 0. Outils
-- ============================================================================
-- Organisations dont je suis le propriétaire (compte principal) — rg_organizations.owner_id = auth.uid()
create or replace function public.rg_my_owned_orgs() returns setof uuid
language sql stable security definer set search_path=public as $$
  select id from public.rg_organizations where owner_id = auth.uid()
$$;

-- ============================================================================
-- 1. Membres d'équipe : employés (staff) et livreurs, créés UNIQUEMENT par une organisation
-- ============================================================================
create table if not exists public.rg_team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rg_organizations(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,  -- un compte = un seul rattachement
  kind text not null check (kind in ('staff','driver')),
  job_title text,                                   -- Responsable, Caissier, Cuisinier, Stock, Comptable, Serveur…
  full_name text not null,
  phone text,
  vehicle text,                                     -- livreurs
  permissions text[] not null default '{}',         -- voir liste des modules ci-dessous
  status text not null default 'active' check (status in ('active','suspended','disabled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rg_team_members_org_idx on public.rg_team_members(org_id);

-- Modules de permission reconnus (staff) :
--   dash, pos, orders, menu, hist, report, drivers, stock, supply, finance, settings, team
-- Un livreur n'a aucune permission de gestion : son espace est fixe (resto-driver.html).
create or replace function public.rg_valid_permissions(p text[]) returns boolean
language sql immutable as $$
  select coalesce(p <@ array['dash','pos','orders','menu','hist','report','drivers','stock','supply','finance','settings','team'], true)
$$;

alter table public.rg_team_members drop constraint if exists rg_team_members_perm_chk;
alter table public.rg_team_members add constraint rg_team_members_perm_chk check (public.rg_valid_permissions(permissions));

-- Le compte principal a TOUS les droits ; un employé actif a ceux qui lui sont accordés.
create or replace function public.rg_has_org_permission(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.rg_organizations o where o.id=p_org and o.owner_id=auth.uid())
      or exists(select 1 from public.rg_team_members m
                where m.org_id=p_org and m.user_id=auth.uid() and m.kind='staff'
                  and m.status='active' and p_perm = any(m.permissions))
$$;

-- Mon rattachement (utilisé par l'interface pour afficher seulement les rubriques autorisées)
create or replace function public.rg_my_membership() returns jsonb
language sql stable security definer set search_path=public as $$
  select coalesce((select jsonb_build_object('member_id',m.id,'org_id',m.org_id,'kind',m.kind,'status',m.status,
            'permissions',to_jsonb(m.permissions),'job_title',m.job_title,'full_name',m.full_name)
          from public.rg_team_members m where m.user_id=auth.uid()),'null'::jsonb)
$$;

alter table public.rg_team_members enable row level security;
drop policy if exists team_read on public.rg_team_members;
create policy team_read on public.rg_team_members for select to authenticated
  using (user_id=auth.uid() or org_id in (select public.rg_my_owned_orgs())
         or public.rg_has_org_permission(org_id,'team') or public.rg_is_platform_owner());
-- Aucune écriture directe : tout passe par les fonctions ci-dessous (ou l'Edge Function en service_role).
revoke insert, update, delete on public.rg_team_members from anon, authenticated;
grant select on public.rg_team_members to authenticated;

-- Modifier permissions / titre / téléphone d'un membre (compte principal, ou employé ayant la permission « team »).
create or replace function public.rg_team_update_member(p_member uuid, p_permissions text[], p_job_title text default null,
                                                         p_full_name text default null, p_phone text default null, p_vehicle text default null)
returns void language plpgsql security definer set search_path=public as $$
declare m public.rg_team_members;
begin
  select * into m from public.rg_team_members where id=p_member;
  if not found then raise exception 'Membre introuvable'; end if;
  if not (m.org_id in (select public.rg_my_owned_orgs())) then
    -- un employé « team » peut gérer les livreurs, mais jamais les autres employés ni s'attribuer des droits
    if not (public.rg_has_org_permission(m.org_id,'team') and m.kind='driver') then raise exception 'Accès refusé'; end if;
  end if;
  if m.user_id=auth.uid() then raise exception 'Vous ne pouvez pas modifier vos propres autorisations'; end if;
  if m.kind='driver' then p_permissions:='{}'; end if;
  if not public.rg_valid_permissions(coalesce(p_permissions,'{}')) then raise exception 'Permission inconnue'; end if;
  update public.rg_team_members set
    permissions=coalesce(p_permissions,permissions), job_title=coalesce(p_job_title,job_title),
    full_name=coalesce(nullif(trim(p_full_name),''),full_name), phone=coalesce(p_phone,phone),
    vehicle=coalesce(p_vehicle,vehicle), updated_at=now()
  where id=p_member;
  insert into public.rg_audit_log(org_id,actor_id,action,target,details)
  values(m.org_id,auth.uid(),'team.update',p_member::text,jsonb_build_object('permissions',p_permissions,'job_title',p_job_title));
end $$;

-- Suspendre / réactiver / désactiver. (L'Edge Function bloque aussi la connexion côté Auth.)
create or replace function public.rg_team_set_status(p_member uuid, p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare m public.rg_team_members;
begin
  if p_status not in ('active','suspended','disabled') then raise exception 'Statut invalide'; end if;
  select * into m from public.rg_team_members where id=p_member;
  if not found then raise exception 'Membre introuvable'; end if;
  if not (m.org_id in (select public.rg_my_owned_orgs())) then
    if not (public.rg_has_org_permission(m.org_id,'team') and m.kind='driver') then raise exception 'Accès refusé'; end if;
  end if;
  if m.user_id=auth.uid() then raise exception 'Action impossible sur votre propre compte'; end if;
  update public.rg_team_members set status=p_status, updated_at=now() where id=p_member;
  insert into public.rg_audit_log(org_id,actor_id,action,target,details)
  values(m.org_id,auth.uid(),'team.status',p_member::text,jsonb_build_object('status',p_status));
end $$;

-- ============================================================================
-- 2. Journal d'audit (lecture : compte principal + propriétaire plateforme ; écriture : via fonction)
-- ============================================================================
create table if not exists public.rg_audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.rg_organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rg_audit_org_idx on public.rg_audit_log(org_id, created_at desc);
alter table public.rg_audit_log enable row level security;
drop policy if exists audit_read on public.rg_audit_log;
create policy audit_read on public.rg_audit_log for select to authenticated
  using (org_id in (select public.rg_my_owned_orgs()) or public.rg_is_platform_owner());
revoke insert, update, delete on public.rg_audit_log from anon, authenticated;
grant select on public.rg_audit_log to authenticated;

-- Écriture d'une action par le compte principal ou un employé actif de l'organisation.
create or replace function public.rg_audit(p_org uuid, p_action text, p_target text default null, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not (p_org in (select public.rg_my_owned_orgs())
          or exists(select 1 from public.rg_team_members m where m.org_id=p_org and m.user_id=auth.uid() and m.status='active')) then
    return;   -- silencieux : une journalisation ne doit jamais bloquer l'utilisateur
  end if;
  insert into public.rg_audit_log(org_id,actor_id,action,target,details)
  values(p_org,auth.uid(),left(p_action,60),left(p_target,120),coalesce(p_details,'{}'));
end $$;

-- ============================================================================
-- 3. Verrou : aucun compte « delivery » ou « staff » ne peut être créé par inscription publique
--    (l'interface publique n'a plus de formulaire, mais l'API Auth reste appelable : on bloque côté base).
--    Seule l'Edge Function (service_role) pose app_metadata.managed_by_org = true.
-- ============================================================================
create or replace function public.rg_guard_account_type() returns trigger
language plpgsql security definer set search_path=public, auth as $$
declare newt text; oldt text; managed boolean;
begin
  managed := coalesce((new.raw_app_meta_data->>'managed_by_org')::boolean, false);
  newt := new.raw_user_meta_data->>'account_type';
  if tg_op='UPDATE' then oldt := old.raw_user_meta_data->>'account_type'; end if;
  if newt in ('delivery','staff') and not managed then
    if tg_op='INSERT' then
      new.raw_user_meta_data := coalesce(new.raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('account_type','customer');
    else
      -- on rétablit l'ancienne valeur (ou « customer ») : un utilisateur ne peut pas se promouvoir livreur/employé
      new.raw_user_meta_data := coalesce(new.raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('account_type',coalesce(oldt,'customer'));
    end if;
  end if;
  -- un compte géré par une organisation ne peut pas changer de catégorie ni de rattachement lui-même
  if tg_op='UPDATE' and managed and (old.raw_user_meta_data->>'account_type') in ('delivery','staff') then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data,'{}'::jsonb)
      || jsonb_build_object('account_type',old.raw_user_meta_data->>'account_type','organization_id',old.raw_user_meta_data->>'organization_id');
  end if;
  return new;
end $$;
drop trigger if exists rg_guard_account_type_ins on auth.users;
create trigger rg_guard_account_type_ins before insert on auth.users for each row execute function public.rg_guard_account_type();
drop trigger if exists rg_guard_account_type_upd on auth.users;
create trigger rg_guard_account_type_upd before update of raw_user_meta_data on auth.users for each row execute function public.rg_guard_account_type();

-- OPTIONNEL (à lancer volontairement) : les anciens comptes « delivery » auto-inscrits n'appartiennent à aucun restaurant dans rg_team_members,
-- donc l'espace livreur leur est désormais refusé. Cette requête les ramène en « client ». Chaque restaurant doit ensuite recréer ses livreurs (Mon équipe).
-- Vérifiez d'abord : select id,email from auth.users where raw_user_meta_data->>'account_type'='delivery';
/*
update auth.users u set raw_user_meta_data = raw_user_meta_data || '{"account_type":"customer"}'::jsonb
where raw_user_meta_data->>'account_type' in ('delivery','staff')
  and coalesce((raw_app_meta_data->>'managed_by_org')::boolean,false)=false
  and not exists(select 1 from public.rg_team_members m where m.user_id=u.id);
*/

-- ============================================================================
-- 4. Approvisionnement professionnel (séparé des commandes clients rg_orders)
--    Acheteur : restaurant / hôtel / commerçant (compte principal ou employé avec permission « supply »)
--    Fournisseur : producteur ou commerçant agricole (rg_agro_profiles / rg_agro_products)
-- ============================================================================
create table if not exists public.rg_supply_orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('APP-'||to_char(now(),'YYMMDD')||'-'||upper(substr(md5(random()::text),1,5))),
  buyer_user_id uuid not null references auth.users(id) on delete cascade,     -- compte principal de l'acheteur
  buyer_org_id uuid references public.rg_organizations(id) on delete set null,
  placed_by uuid references auth.users(id) on delete set null,                 -- personne qui a passé la commande (employé ?)
  buyer_name text, buyer_phone text,                                           -- copie lisible par le fournisseur
  supplier_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','confirmed','refused','delivering','received','cancelled')),
  total numeric(14,2) not null default 0,
  currency_code text not null default 'XOF',
  delivery_address text,
  delivery_note text,
  refusal_reason text,
  payment_mode text not null default 'on_delivery' check (payment_mode in ('on_delivery','wallet','transfer')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz, shipped_at timestamptz, received_at timestamptz,
  updated_at timestamptz not null default now(),
  check (buyer_user_id <> supplier_id)
);
create index if not exists rg_supply_orders_buyer_idx on public.rg_supply_orders(buyer_user_id, created_at desc);
create index if not exists rg_supply_orders_supplier_idx on public.rg_supply_orders(supplier_id, created_at desc);

create table if not exists public.rg_supply_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.rg_supply_orders(id) on delete cascade,
  product_id uuid references public.rg_agro_products(id) on delete set null,
  product_name text not null,           -- copie figée au moment de la commande
  unit text not null,
  unit_price numeric(14,2) not null,    -- prix figé, calculé côté serveur
  quantity numeric(14,2) not null check (quantity > 0),
  line_total numeric(14,2) not null
);
create index if not exists rg_supply_items_order_idx on public.rg_supply_order_items(order_id);

alter table public.rg_supply_orders enable row level security;
alter table public.rg_supply_order_items enable row level security;

drop policy if exists supply_read on public.rg_supply_orders;
create policy supply_read on public.rg_supply_orders for select to authenticated
  using (buyer_user_id=auth.uid() or supplier_id=auth.uid() or placed_by=auth.uid()
         or (buyer_org_id is not null and public.rg_has_org_permission(buyer_org_id,'supply'))
         or public.rg_is_platform_owner());
drop policy if exists supply_items_read on public.rg_supply_order_items;
create policy supply_items_read on public.rg_supply_order_items for select to authenticated
  using (exists(select 1 from public.rg_supply_orders o where o.id=order_id));   -- hérite de la RLS de la commande
revoke insert, update, delete on public.rg_supply_orders, public.rg_supply_order_items from anon, authenticated;
grant select on public.rg_supply_orders, public.rg_supply_order_items to authenticated;

-- Passer une commande : les prix, le fournisseur et les quantités sont VÉRIFIÉS ET CALCULÉS ICI (jamais confiés au navigateur).
-- p_items : [{"product_id":"…","quantity":12.5}, …] — tous les produits doivent appartenir au même fournisseur.
create or replace function public.rg_supply_place_order(p_items jsonb, p_org uuid default null, p_address text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare buyer uuid; sup uuid; oid uuid; it jsonb; prod public.rg_agro_products; qty numeric; tot numeric:=0; n int:=0; cur text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Commande vide'; end if;
  if jsonb_array_length(p_items)>50 then raise exception 'Trop de lignes'; end if;
  if p_org is not null then
    if not public.rg_has_org_permission(p_org,'supply') then raise exception 'Vous n''avez pas l''autorisation d''acheter pour cette organisation'; end if;
    select owner_id into buyer from public.rg_organizations where id=p_org;
  else buyer:=auth.uid(); end if;
  if buyer is null then raise exception 'Organisation invalide'; end if;

  select owner_id into sup from public.rg_agro_products where id=((p_items->0)->>'product_id')::uuid;
  if sup is null then raise exception 'Produit introuvable'; end if;
  insert into public.rg_supply_orders(buyer_user_id,buyer_org_id,placed_by,supplier_id,delivery_address,delivery_note,buyer_name,buyer_phone)
  values(buyer,p_org,auth.uid(),sup,left(p_address,300),left(p_note,500),
    coalesce((select public_name from public.rg_organizations where id=p_org),
             (select business_name from public.rg_agro_profiles where user_id=buyer),
             (select raw_user_meta_data->>'name' from auth.users where id=buyer),'Client professionnel'),
    coalesce((select contact_phone from public.rg_organizations where id=p_org),
             (select phone from public.rg_agro_profiles where user_id=buyer)))
  returning id into oid;
  if sup=buyer then raise exception 'Vous ne pouvez pas commander vos propres produits'; end if;
  if not exists(select 1 from public.rg_agro_profiles where user_id=sup and is_active) then raise exception 'Fournisseur indisponible'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := round((it->>'quantity')::numeric,2);
    select * into prod from public.rg_agro_products where id=(it->>'product_id')::uuid for update;
    if not found or prod.owner_id<>sup then raise exception 'Tous les produits doivent venir du même fournisseur'; end if;
    if prod.availability='unavailable' then raise exception '« % » est indisponible', prod.product_name; end if;
    if qty is null or qty<=0 then raise exception 'Quantité invalide'; end if;
    if qty < prod.minimum_order then raise exception 'Commande minimale pour « % » : % %', prod.product_name, prod.minimum_order, prod.unit; end if;
    if qty > prod.quantity then raise exception 'Stock insuffisant pour « % » (disponible : % %)', prod.product_name, prod.quantity, prod.unit; end if;
    insert into public.rg_supply_order_items(order_id,product_id,product_name,unit,unit_price,quantity,line_total)
    values(oid,prod.id,prod.product_name,prod.unit,prod.price,qty,round(prod.price*qty,2));
    tot := tot + round(prod.price*qty,2); n:=n+1; cur:=prod.currency_code;
  end loop;
  update public.rg_supply_orders set total=tot, currency_code=coalesce(cur,'XOF') where id=oid;
  if p_org is not null then perform public.rg_audit(p_org,'supply.order',oid::text,jsonb_build_object('lines',n,'total',tot)); end if;
  return oid;
end $$;

-- Le fournisseur confirme ou refuse. À la confirmation, le stock est réservé (décrémenté) ; au refus/annulation il n'a pas bougé ou est restitué.
create or replace function public.rg_supply_respond(p_order uuid, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare o public.rg_supply_orders; i record;
begin
  select * into o from public.rg_supply_orders where id=p_order for update;
  if not found or o.supplier_id<>auth.uid() then raise exception 'Accès refusé'; end if;
  if o.status<>'pending' then raise exception 'Cette commande a déjà été traitée'; end if;
  if p_accept then
    for i in select * from public.rg_supply_order_items where order_id=p_order loop
      update public.rg_agro_products set quantity=quantity-i.quantity, updated_at=now()
      where id=i.product_id and quantity>=i.quantity;
      if not found then raise exception 'Stock insuffisant pour « % » : mettez à jour votre catalogue', i.product_name; end if;
    end loop;
    update public.rg_supply_orders set status='confirmed', confirmed_at=now(), updated_at=now() where id=p_order;
  else
    update public.rg_supply_orders set status='refused', refusal_reason=left(p_reason,300), updated_at=now() where id=p_order;
  end if;
end $$;

-- Fournisseur : « en livraison ». Acheteur : « reçu » (déclenche l'enregistrement de la transaction).
create or replace function public.rg_supply_advance(p_order uuid, p_paid boolean default null)
returns text language plpgsql security definer set search_path=public as $$
declare o public.rg_supply_orders; ok boolean;
begin
  select * into o from public.rg_supply_orders where id=p_order for update;
  if not found then raise exception 'Commande introuvable'; end if;
  if o.status='confirmed' and o.supplier_id=auth.uid() then
    update public.rg_supply_orders set status='delivering', shipped_at=now(), updated_at=now() where id=p_order;
    return 'delivering';
  elsif o.status='delivering' and (o.buyer_user_id=auth.uid()
        or (o.buyer_org_id is not null and public.rg_has_org_permission(o.buyer_org_id,'supply'))) then
    update public.rg_supply_orders set status='received', received_at=now(), updated_at=now(),
           payment_status=case when payment_mode='on_delivery' and coalesce(p_paid,false) then 'paid' else payment_status end
    where id=p_order;
    -- la transaction est conservée dans rg_supply_orders (statut « received », montant, mode et état du paiement)
    if o.buyer_org_id is not null then perform public.rg_audit(o.buyer_org_id,'supply.received',o.id::text,jsonb_build_object('total',o.total)); end if;
    return 'received';
  end if;
  raise exception 'Action impossible dans l''état actuel (%)', o.status;
end $$;

-- Annulation : par l'acheteur tant que la commande est « en attente », ou par le fournisseur avant livraison (le stock est alors restitué).
create or replace function public.rg_supply_cancel(p_order uuid, p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare o public.rg_supply_orders; i record; is_buyer boolean;
begin
  select * into o from public.rg_supply_orders where id=p_order for update;
  if not found then raise exception 'Commande introuvable'; end if;
  is_buyer := o.buyer_user_id=auth.uid() or (o.buyer_org_id is not null and public.rg_has_org_permission(o.buyer_org_id,'supply'));
  if not (is_buyer and o.status='pending') and not (o.supplier_id=auth.uid() and o.status in ('pending','confirmed')) then
    raise exception 'Annulation impossible'; end if;
  if o.status='confirmed' then
    for i in select * from public.rg_supply_order_items where order_id=p_order loop
      update public.rg_agro_products set quantity=quantity+i.quantity, updated_at=now() where id=i.product_id;
    end loop;
  end if;
  update public.rg_supply_orders set status='cancelled', refusal_reason=left(p_reason,300), updated_at=now() where id=p_order;
end $$;

-- ============================================================================
-- 5. Droits d'exécution
-- ============================================================================
revoke all on function public.rg_team_update_member(uuid,text[],text,text,text,text) from public, anon;
revoke all on function public.rg_team_set_status(uuid,text) from public, anon;
revoke all on function public.rg_audit(uuid,text,text,jsonb) from public, anon;
revoke all on function public.rg_supply_place_order(jsonb,uuid,text,text) from public, anon;
revoke all on function public.rg_supply_respond(uuid,boolean,text) from public, anon;
revoke all on function public.rg_supply_advance(uuid,boolean) from public, anon;
revoke all on function public.rg_supply_cancel(uuid,text) from public, anon;
revoke all on function public.rg_my_membership() from public, anon;
grant execute on function public.rg_team_update_member(uuid,text[],text,text,text,text) to authenticated;
grant execute on function public.rg_team_set_status(uuid,text) to authenticated;
grant execute on function public.rg_audit(uuid,text,text,jsonb) to authenticated;
grant execute on function public.rg_supply_place_order(jsonb,uuid,text,text) to authenticated;
grant execute on function public.rg_supply_respond(uuid,boolean,text) to authenticated;
grant execute on function public.rg_supply_advance(uuid,boolean) to authenticated;
grant execute on function public.rg_supply_cancel(uuid,text) to authenticated;
grant execute on function public.rg_my_membership() to authenticated;
grant execute on function public.rg_has_org_permission(uuid,text) to authenticated;

-- ============================================================================
-- 6. Répartition des courses : uniquement entre les livreurs rattachés au restaurant de la commande
--    (l'ancienne version proposait la course à n'importe quel livreur du réseau)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rg_dispatch_order(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb;
  r jsonb;
  best text;
  tried jsonb;
BEGIN
  SELECT data INTO o FROM rg_orders WHERE id = p_id FOR UPDATE;
  IF o IS NULL THEN RETURN; END IF;
  IF o->>'status' NOT IN ('acceptée', 'préparée')
     OR COALESCE(o->>'driverId', '') <> ''
     OR COALESCE(o->>'deliveryMode', '') = 'room'
     OR COALESCE(o->>'serviceType', '') = 'À emporter' THEN
    RETURN;
  END IF;
  IF o->'offer' IS NOT NULL AND o->'offer' <> 'null'::jsonb
     AND COALESCE((o->'offer'->>'expires')::bigint, 0) > rg_now_ms() THEN
    RETURN;
  END IF;
  SELECT data INTO r FROM rg_rests WHERE id = o->>'restId';
  IF r IS NULL THEN RETURN; END IF;
  tried := COALESCE(o->'offerTried', '[]'::jsonb);
  SELECT u.data->>'id' INTO best
  FROM rg_users u
  WHERE u.data->>'role' = 'driver'
    AND u.data->>'restId' = o->>'restId'   -- un livreur ne reçoit QUE les courses du restaurant qui l'a créé
    AND COALESCE(u.data->>'disabled', 'false') <> 'true'
    AND COALESCE(u.data->>'inactive', 'false') <> 'true'
    AND NOT jsonb_exists(tried, u.data->>'id')
    AND NOT EXISTS (
      SELECT 1 FROM rg_orders x
      WHERE x.data->>'driverId' = u.data->>'id'
        AND COALESCE(x.data->>'status', '') NOT IN ('terminée', 'annulée', 'refusée')
    )
  ORDER BY CASE
    WHEN u.data->>'lat' IS NOT NULL AND r->>'lat' IS NOT NULL THEN
      rg_dist_km(
        (u.data->>'lat')::double precision, (u.data->>'lng')::double precision,
        (r->>'lat')::double precision, (r->>'lng')::double precision
      )
    ELSE 9999
  END
  LIMIT 1;
  IF best IS NULL THEN
    IF (o->'offer' IS NOT NULL AND o->'offer' <> 'null'::jsonb)
       OR jsonb_array_length(tried) > 0 THEN
      UPDATE rg_orders
      SET data = data || jsonb_build_object('offer', null, 'offerTried', '[]'::jsonb)
      WHERE id = p_id;
    END IF;
    RETURN;
  END IF;
  UPDATE rg_orders
  SET data = data || jsonb_build_object(
    'offer', jsonb_build_object('driverId', best, 'expires', rg_now_ms() + 90000),
    'offerTried', tried || to_jsonb(best)
  )
  WHERE id = p_id;
END;
$$;
