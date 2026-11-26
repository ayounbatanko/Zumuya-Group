-- ZUMUYA GROUP — 19 : pilotage unifié, historique, exports et équipe propriétaire
-- À exécuter APRÈS les migrations 00 à 18 et z_hospitality_native.sql.
-- Relançable sans perte de données.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Journal d'activité transversal (restaurant, hôtel, agro, marketplace,
--    livraison et autres organisations disposant d'un org_id).
-- ---------------------------------------------------------------------------
create table if not exists public.rg_activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.rg_organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  module_code text not null default 'platform',
  table_name text not null,
  record_id text,
  action text not null,
  summary text not null default '',
  created_at timestamptz not null default now()
);
alter table public.rg_activity_events drop constraint if exists rg_activity_events_org_id_fkey;
create index if not exists rg_activity_org_date_idx on public.rg_activity_events(org_id,created_at desc);
create index if not exists rg_activity_actor_date_idx on public.rg_activity_events(actor_id,created_at desc);
create index if not exists rg_activity_module_date_idx on public.rg_activity_events(module_code,created_at desc);

create or replace function public.rg_capture_activity()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_row jsonb;
  v_org uuid;
  v_actor uuid;
  v_id text;
  v_module text := 'platform';
  v_summary text := '';
  v_type text;
begin
  if tg_op='DELETE' then v_row:=to_jsonb(old); else v_row:=to_jsonb(new); end if;

  begin v_org:=nullif(coalesce(v_row->>'org_id',v_row->>'organization_id'),'')::uuid;
  exception when others then v_org:=null; end;

  begin v_actor:=coalesce(auth.uid(),nullif(coalesce(v_row->>'updated_by',v_row->>'created_by',v_row->>'user_id',v_row->>'owner_id',v_row->>'buyer_id',v_row->>'seller_id'),'')::uuid);
  exception when others then v_actor:=auth.uid(); end;

  v_id:=coalesce(v_row->>'id',v_row->>'uuid',v_row->>'order_id','');
  if v_org is not null then
    select organization_type into v_type from public.rg_organizations where id=v_org;
    v_module:=coalesce(v_type,'business');
  elsif v_actor is not null then
    select organization_type into v_type from public.rg_organizations where owner_id=v_actor order by created_at limit 1;
    v_module:=coalesce(v_type,'account');
  end if;

  v_summary:=left(coalesce(v_row->>'title',v_row->>'name',v_row->>'public_name',v_row->>'order_number',v_row->>'status',tg_table_name),180);
  insert into public.rg_activity_events(org_id,actor_id,module_code,table_name,record_id,action,summary)
  values(v_org,v_actor,v_module,tg_table_name,nullif(v_id,''),lower(tg_op),v_summary);

  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.rg_capture_activity() from public;

-- Installer le journal sur les tables métier existantes qui ont un rattachement
-- organisation/utilisateur. Les tables d'audit sont exclues pour éviter les boucles.
do $$
declare r record;
begin
  for r in
    select c.table_schema,c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
    where c.table_schema='public' and t.table_type='BASE TABLE'
      and c.column_name in ('org_id','organization_id','user_id','owner_id')
      and c.table_name not in ('rg_activity_events','z_hospitality_audit')
    group by c.table_schema,c.table_name
  loop
    execute format('drop trigger if exists rg_activity_capture on %I.%I',r.table_schema,r.table_name);
    execute format('create trigger rg_activity_capture after insert or update or delete on %I.%I for each row execute function public.rg_capture_activity()',r.table_schema,r.table_name);
  end loop;
end $$;

alter table public.rg_activity_events enable row level security;
drop policy if exists rg_activity_read_own on public.rg_activity_events;
create policy rg_activity_read_own on public.rg_activity_events for select to authenticated
using (
  actor_id=auth.uid()
  or public.rg_is_platform_owner()
  or (org_id is not null and exists(select 1 from public.rg_organizations o where o.id=org_id and o.owner_id=auth.uid()))
  or (org_id is not null and public.z_hosp_can(org_id,'reports'))
);
revoke all on public.rg_activity_events from anon,authenticated;
grant select on public.rg_activity_events to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Comptes d'équipe du propriétaire ZUMUYA GROUP (permissions séparées).
--    La création Auth est faite par l'Edge Function platform-team-admin.
-- ---------------------------------------------------------------------------
create table if not exists public.rg_platform_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  permissions text[] not null default '{}',
  status text not null default 'active' check(status in ('active','suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rg_platform_team_permissions_check check (
    permissions <@ array['dashboard','partners','organizations','subscriptions','payments','reports','exports','team']::text[]
  )
);
create index if not exists rg_platform_team_status_idx on public.rg_platform_team_members(status);

create or replace function public.rg_platform_can(p_permission text default null)
returns boolean language sql stable security definer set search_path=public as $$
  select public.rg_is_platform_owner()
  or exists (
    select 1 from public.rg_platform_team_members m
    where m.user_id=auth.uid() and m.status='active'
      and (p_permission is null or p_permission=any(m.permissions))
  )
$$;
revoke all on function public.rg_platform_can(text) from public;
grant execute on function public.rg_platform_can(text) to authenticated;

create or replace function public.rg_platform_access()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_owner boolean; v_permissions text[]:='{}';
begin
  v_owner:=public.rg_is_platform_owner();
  if not v_owner then
    select m.permissions into v_permissions from public.rg_platform_team_members m
    where m.user_id=auth.uid() and m.status='active';
  end if;
  return jsonb_build_object('is_owner',v_owner,'permissions',coalesce(v_permissions,'{}'::text[]));
end $$;
revoke all on function public.rg_platform_access() from public;
grant execute on function public.rg_platform_access() to authenticated;

alter table public.rg_platform_team_members enable row level security;
drop policy if exists rg_platform_team_owner_read on public.rg_platform_team_members;
create policy rg_platform_team_owner_read on public.rg_platform_team_members for select to authenticated
using (public.rg_is_platform_owner() or user_id=auth.uid());
drop policy if exists rg_platform_team_owner_write on public.rg_platform_team_members;
create policy rg_platform_team_owner_write on public.rg_platform_team_members for all to authenticated
using (public.rg_is_platform_owner()) with check (public.rg_is_platform_owner());
revoke all on public.rg_platform_team_members from anon,authenticated;
grant select on public.rg_platform_team_members to authenticated;
grant insert,update,delete on public.rg_platform_team_members to authenticated;

-- Données assainies pour les membres de gestion : aucun accès global direct aux tables.
create or replace function public.rg_platform_staff_snapshot(p_section text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v jsonb;
begin
  if public.rg_is_platform_owner() then
    raise exception 'Le propriétaire utilise son tableau de bord complet.';
  end if;
  if not public.rg_platform_can(p_section) then raise exception 'Permission insuffisante.'; end if;

  if p_section='dashboard' then
    select jsonb_build_object(
      'organizations',(select count(*) from public.rg_organizations),
      'partners_pending',(select count(*) from public.rg_partner_applications where status='pending'),
      'transactions',(select count(*) from public.rg_payment_transactions),
      'recent_activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from
        (select created_at,module_code,record_type,status from public.rg_service_records order by created_at desc limit 12) x)
    ) into v;
  elsif p_section='partners' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v
    from (select organization_name,country_code,category,city,status,created_at from public.rg_partner_applications order by created_at desc limit 100) x;
  elsif p_section='organizations' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v
    from (select public_name,legal_name,country_code,organization_type,verification_status,created_at from public.rg_organizations order by created_at desc limit 200) x;
  elsif p_section='subscriptions' then
    if to_regclass('public.zrh_subscription_requests') is not null then
      execute 'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select service_type,status,months,amount_minor,currency_code,created_at from public.zrh_subscription_requests order by created_at desc limit 100) x' into v;
    else
      v:='[]'::jsonb;
    end if;
  elsif p_section='payments' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v
    from (select module_code,amount_minor,currency_code,provider,status,created_at from public.rg_payment_transactions order by created_at desc limit 200) x;
  elsif p_section='reports' then
    select jsonb_build_object(
      'organizations',(select count(*) from public.rg_organizations),
      'transactions',(select count(*) from public.rg_payment_transactions),
      'activity',(select count(*) from public.rg_activity_events),
      'payments_total',(select coalesce(sum(amount_minor),0) from public.rg_payment_transactions where status in ('paid','succeeded','completed'))
    ) into v;
  elsif p_section='team' then
    select coalesce(jsonb_agg(jsonb_build_object('full_name',full_name,'email',email,'permissions',permissions,'status',status,'created_at',created_at)),'[]'::jsonb)
    into v from public.rg_platform_team_members;
  else
    raise exception 'Section non disponible pour ce compte.';
  end if;
  return coalesce(v,'{}'::jsonb);
end $$;
revoke all on function public.rg_platform_staff_snapshot(text) from public;
grant execute on function public.rg_platform_staff_snapshot(text) to authenticated;

-- Export complet réservé au compte propriétaire. Inclut les tables métier
-- explicitement autorisées et applique les dates quand created_at existe.
create or replace function public.rg_platform_export_all(p_from date default null,p_to date default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb:='{}'::jsonb;
  v_table text;
  v_sql text;
  v_has_created boolean;
  v_data jsonb;
  v_tables text[]:=array[
    'commerce_product_views',
    'rg_agro_group_members',
    'rg_agro_group_messages',
    'rg_agro_group_offers',
    'rg_agro_group_order_members',
    'rg_agro_group_orders',
    'rg_agro_groups',
    'rg_agro_products',
    'rg_agro_profiles',
    'rg_agro_requests',
    'rg_audit_log',
    'rg_business_links',
    'rg_chats',
    'rg_commerce_products',
    'rg_countries',
    'rg_customer_addresses',
    'rg_customer_favorites',
    'rg_customer_profiles',
    'rg_delivery_events',
    'rg_delivery_fleet',
    'rg_delivery_incidents',
    'rg_delivery_invites',
    'rg_delivery_jobs',
    'rg_delivery_members',
    'rg_delivery_offers',
    'rg_delivery_organizations',
    'rg_delivery_partnerships',
    'rg_delivery_providers',
    'rg_delivery_rates',
    'rg_delivery_requests',
    'rg_delivery_zones',
    'rg_establishments',
    'rg_market_conversation_members',
    'rg_market_conversations',
    'rg_market_messages',
    'rg_module_catalog',
    'rg_orders',
    'rg_org_modules',
    'rg_organizations',
    'rg_partner_applications',
    'rg_payment_transactions',
    'rg_platform_owners',
    'rg_profiles',
    'rg_public_restaurants',
    'rg_rests',
    'rg_seller_locations',
    'rg_service_records',
    'rg_supply_order_items',
    'rg_supply_orders',
    'rg_team_members',
    'rg_user_modules',
    'rg_users',
    'rg_wallet_ledger',
    'rg_wallet_payout_methods',
    'rg_wallet_settings',
    'rg_wallet_withdrawals',
    'rg_wallets',
    'rg_workflow_events',
    'z_hospitality_audit',
    'z_hospitality_records',
    'z_hospitality_team',
    'rg_activity_events',
    'rg_platform_team_members'
  ];
begin
  if not public.rg_is_platform_owner() then raise exception 'Export réservé au propriétaire de ZUMUYA GROUP.'; end if;
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is not null then
      select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='created_at') into v_has_created;
      if v_has_created and (p_from is not null or p_to is not null) then
        v_sql:=format('select coalesce(jsonb_agg(to_jsonb(t)),$1) from public.%I t where ($2 is null or t.created_at >= $2::timestamptz) and ($3 is null or t.created_at < ($3 + 1)::timestamptz)',v_table);
        execute v_sql into v_data using '[]'::jsonb,p_from,p_to;
      else
        execute format('select coalesce(jsonb_agg(to_jsonb(t)),$1) from public.%I t',v_table) into v_data using '[]'::jsonb;
      end if;
      v_result:=v_result||jsonb_build_object(v_table,coalesce(v_data,'[]'::jsonb));
    end if;
  end loop;
  return jsonb_build_object('generated_at',now(),'period',jsonb_build_object('from',p_from,'to',p_to),'tables',v_result);
end $$;
revoke all on function public.rg_platform_export_all(date,date) from public;
grant execute on function public.rg_platform_export_all(date,date) to authenticated;

-- Vue RLS dédiée aux évènements du compte principal / du membre concerné.
comment on table public.rg_activity_events is 'Journal transversal ZUMUYA GROUP pour tableaux de bord et exports datés.';
comment on table public.rg_platform_team_members is 'Comptes secondaires du groupe de gestion ZUMUYA, permissions limitées.';
