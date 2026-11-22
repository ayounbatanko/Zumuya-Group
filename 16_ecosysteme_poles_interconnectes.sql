-- ============================================================
-- ZUMUYA GROUP — MIGRATION 16
-- ECOSYSTEME MULTI-POLES AUTONOMES ET INTERCONNECTES
-- À exécuter après 00_RESET..., 10_logistique... et 11_equipes...
-- Migration additive, relançable, sans suppression de données.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Catalogue officiel des pôles. Les codes sont stables et indépendants
--    des libellés affichés dans les interfaces.
create table if not exists public.rg_module_catalog (
  module_code text primary key,
  label text not null,
  description text not null default '',
  rollout_status text not null default 'available'
    check (rollout_status in ('available','maintenance','coming_soon')),
  sort_order integer not null default 100,
  settings_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.rg_module_catalog(module_code,label,description,rollout_status,sort_order) values
('restaurant','Restaurant','Menus, commandes, cuisine, salle, personnel, achats et livraisons.', 'available',10),
('hotel','Hôtel et hébergement','Chambres, réservations, clients, services, personnel et approvisionnement.','available',20),
('agro','Agriculture','Production, récoltes, stocks, catalogue, ventes et approvisionnement.','available',30),
('marketplace','Marketplace','Boutique, catalogue, vendeurs, commandes, paiements et expéditions.','available',40),
('delivery','Service de livraison','Entreprise de transport, flotte, livreurs, missions, zones, tarifs et facturation.','available',50)
on conflict(module_code) do update set
 label=excluded.label, description=excluded.description,
 rollout_status=excluded.rollout_status, sort_order=excluded.sort_order,
 updated_at=now();

-- 2) Activation des pôles au niveau du compte utilisateur.
create table if not exists public.rg_user_modules (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_code text not null references public.rg_module_catalog(module_code),
  status text not null default 'active' check(status in ('active','paused','suspended')),
  configuration jsonb not null default '{}'::jsonb,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,module_code)
);

-- 3) Association explicite entre une organisation et ses pôles.
--    Une organisation peut activer plusieurs pôles sans fusionner leurs données.
create table if not exists public.rg_org_modules (
  organization_id uuid not null references public.rg_organizations(id) on delete cascade,
  module_code text not null references public.rg_module_catalog(module_code),
  status text not null default 'active' check(status in ('active','paused','suspended')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(organization_id,module_code)
);

create index if not exists rg_org_modules_module_idx on public.rg_org_modules(module_code,status);
create index if not exists rg_organizations_owner_idx on public.rg_organizations(owner_id);

-- 4) Initialisation des modules existants sans écraser les configurations.
insert into public.rg_user_modules(user_id,module_code,status,configuration)
select distinct o.owner_id,
  case
    when o.organization_type in ('restaurant','restauration') then 'restaurant'
    when o.organization_type='hotel' then 'hotel'
    when o.organization_type in ('agro','agro_producer','agro_trader') then 'agro'
    when o.organization_type='marketplace' then 'marketplace'
    when o.organization_type in ('delivery_service','delivery','logistics') then 'delivery'
    else null
  end,
  'active','{}'::jsonb
from public.rg_organizations o
where o.owner_id is not null
  and o.organization_type in ('restaurant','restauration','hotel','agro','agro_producer','agro_trader','marketplace','delivery_service','delivery','logistics')
on conflict(user_id,module_code) do nothing;

do $function$
begin
  insert into public.rg_org_modules(organization_id,module_code,status)
  select o.id,
    case
      when o.organization_type in ('restaurant','restauration') then 'restaurant'
      when o.organization_type='hotel' then 'hotel'
      when o.organization_type in ('agro','agro_producer','agro_trader') then 'agro'
      when o.organization_type='marketplace' then 'marketplace'
      when o.organization_type in ('delivery_service','delivery','logistics') then 'delivery'
      else null
    end,
    'active'
  from public.rg_organizations o
  where o.organization_type in ('restaurant','restauration','hotel','agro','agro_producer','agro_trader','marketplace','delivery_service','delivery','logistics')
  on conflict(organization_id,module_code) do nothing;
end;
$function$;

-- 5) Relations inter-entreprises : consentement explicite des deux parties.
create table if not exists public.rg_business_links (
  id uuid primary key default gen_random_uuid(),
  source_org_id uuid not null references public.rg_organizations(id) on delete cascade,
  target_org_id uuid not null references public.rg_organizations(id) on delete cascade,
  relationship_type text not null check(relationship_type in ('supplier','delivery_provider','marketplace_seller','hotel_service','business_partner','other')),
  status text not null default 'pending' check(status in ('pending','active','rejected','suspended','ended')),
  terms jsonb not null default '{}'::jsonb,
  requested_by uuid not null default auth.uid() references auth.users(id),
  responded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_org_id,target_org_id,relationship_type),
  check(source_org_id <> target_org_id)
);
create index if not exists rg_business_links_source_idx on public.rg_business_links(source_org_id,status);
create index if not exists rg_business_links_target_idx on public.rg_business_links(target_org_id,status);

-- 6) Flux de travail inter-pôles. Il référence une commande, un achat,
--    une expédition ou une opération sans mélanger les tables métier.
create table if not exists public.rg_workflow_events (
  id uuid primary key default gen_random_uuid(),
  source_org_id uuid references public.rg_organizations(id) on delete set null,
  target_org_id uuid references public.rg_organizations(id) on delete set null,
  source_module text not null references public.rg_module_catalog(module_code),
  target_module text not null references public.rg_module_catalog(module_code),
  event_type text not null,
  reference_type text,
  reference_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check(status in ('new','seen','accepted','processing','completed','rejected','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rg_workflow_target_idx on public.rg_workflow_events(target_org_id,status,created_at desc);
create index if not exists rg_workflow_source_idx on public.rg_workflow_events(source_org_id,created_at desc);

-- 7) Fonction de propriété locale : ne dépend pas des fonctions optionnelles du projet.
create or replace function public.rg_ecosystem_owns_org(p_org uuid)
returns boolean language sql stable security definer set search_path=public
as $function$
  select exists(select 1 from public.rg_organizations o where o.id=p_org and o.owner_id=auth.uid())
$function$;

-- 8) Activation / mise à jour d'un pôle et rattachement de l'organisation.
create or replace function public.rg_ecosystem_set_module(
  p_module text,
  p_org uuid default null,
  p_configuration jsonb default '{}'::jsonb,
  p_status text default 'active'
) returns void language plpgsql security definer set search_path=public
as $function$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_status not in ('active','paused') then raise exception 'Statut non autorisé.'; end if;
  if not exists(select 1 from public.rg_module_catalog where module_code=p_module and rollout_status='available') then
    raise exception 'Pôle indisponible.';
  end if;
  insert into public.rg_user_modules(user_id,module_code,status,configuration)
  values(auth.uid(),p_module,p_status,coalesce(p_configuration,'{}'::jsonb))
  on conflict(user_id,module_code) do update set status=excluded.status,
    configuration=public.rg_user_modules.configuration || excluded.configuration,updated_at=now();
  if p_org is not null then
    if not public.rg_ecosystem_owns_org(p_org) then raise exception 'Organisation non autorisée.'; end if;
    insert into public.rg_org_modules(organization_id,module_code,status,configuration)
    values(p_org,p_module,p_status,coalesce(p_configuration,'{}'::jsonb))
    on conflict(organization_id,module_code) do update set status=excluded.status,
      configuration=public.rg_org_modules.configuration || excluded.configuration,updated_at=now();
  end if;
end;
$function$;

-- 9) Demande de collaboration entre deux organisations.
create or replace function public.rg_ecosystem_request_link(
  p_source_org uuid,p_target_org uuid,p_relationship text,p_terms jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public
as $function$
declare v_id uuid;
begin
  if not public.rg_ecosystem_owns_org(p_source_org) then raise exception 'Organisation source non autorisée.'; end if;
  if not exists(select 1 from public.rg_organizations where id=p_target_org and verification_status='verified') then
    raise exception 'Organisation destinataire introuvable ou non vérifiée.';
  end if;
  insert into public.rg_business_links(source_org_id,target_org_id,relationship_type,terms,requested_by)
  values(p_source_org,p_target_org,p_relationship,coalesce(p_terms,'{}'::jsonb),auth.uid())
  on conflict(source_org_id,target_org_id,relationship_type) do update set
    status='pending',terms=excluded.terms,requested_by=auth.uid(),updated_at=now()
  returning id into v_id;
  return v_id;
end;
$function$;

-- 10) Acceptation / refus par l'organisation destinataire uniquement.
create or replace function public.rg_ecosystem_respond_link(p_link uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public
as $function$
begin
  update public.rg_business_links l set status=case when p_accept then 'active' else 'rejected' end,
    responded_by=auth.uid(),updated_at=now()
  where l.id=p_link and public.rg_ecosystem_owns_org(l.target_org_id);
  if not found then raise exception 'Seule l’organisation destinataire peut répondre.'; end if;
end;
$function$;

-- 11) Emission d'un événement métier vers un partenaire actif.
create or replace function public.rg_ecosystem_emit_event(
  p_source_org uuid,p_target_org uuid,p_source_module text,p_target_module text,
  p_event_type text,p_reference_type text default null,p_reference_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public
as $function$
declare v_id uuid;
begin
  if not public.rg_ecosystem_owns_org(p_source_org) then raise exception 'Organisation source non autorisée.'; end if;
  if not exists(select 1 from public.rg_business_links l where l.source_org_id=p_source_org
    and l.target_org_id=p_target_org and l.status='active')
    and not exists(select 1 from public.rg_business_links l where l.source_org_id=p_target_org
    and l.target_org_id=p_source_org and l.status='active') then
    raise exception 'Aucune collaboration active entre ces organisations.';
  end if;
  if not exists(select 1 from public.rg_org_modules where organization_id=p_source_org and module_code=p_source_module and status='active') then
    raise exception 'Pôle source inactif.';
  end if;
  insert into public.rg_workflow_events(source_org_id,target_org_id,source_module,target_module,event_type,reference_type,reference_id,payload,created_by)
  values(p_source_org,p_target_org,p_source_module,p_target_module,p_event_type,p_reference_type,p_reference_id,coalesce(p_payload,'{}'::jsonb),auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;

-- 12) Le destinataire met à jour uniquement ses événements reçus.
create or replace function public.rg_ecosystem_update_event(p_event uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $function$
begin
  if p_status not in ('seen','accepted','processing','completed','rejected','cancelled') then raise exception 'Statut invalide.'; end if;
  update public.rg_workflow_events e set status=p_status,updated_at=now()
  where e.id=p_event and public.rg_ecosystem_owns_org(e.target_org_id);
  if not found then raise exception 'Événement introuvable ou accès refusé.'; end if;
end;
$function$;


-- Annuaire limité aux organisations professionnelles vérifiées.
-- Ne publie jamais les coordonnées privées ni les données financières.
create or replace function public.rg_ecosystem_search_partners(p_query text default '',p_module text default null)
returns table(id uuid,public_name text,organization_type text,city text,country_code text)
language sql stable security definer set search_path=public
as $function$
  select o.id,o.public_name,o.organization_type,o.city,o.country_code
  from public.rg_organizations o
  where o.verification_status='verified'
    and o.owner_id is not null
    and o.owner_id<>auth.uid()
    and (coalesce(trim(p_query),'')='' or o.public_name ilike '%'||left(trim(p_query),80)||'%' or coalesce(o.city,'') ilike '%'||left(trim(p_query),80)||'%')
    and (p_module is null or
      (p_module='restaurant' and o.organization_type in ('restaurant')) or
      (p_module='hotel' and o.organization_type='hotel') or
      (p_module='agro' and o.organization_type in ('agro','agro_producer','agro_trader')) or
      (p_module='marketplace' and o.organization_type in ('marketplace','commerce')) or
      (p_module='delivery' and o.organization_type in ('delivery','delivery_service','logistics')))
  order by o.public_name limit 100
$function$;

-- 13) RLS : séparation des espaces et lecture uniquement des collaborations autorisées.
alter table public.rg_module_catalog enable row level security;
alter table public.rg_user_modules enable row level security;
alter table public.rg_org_modules enable row level security;
alter table public.rg_business_links enable row level security;
alter table public.rg_workflow_events enable row level security;

drop policy if exists rg_module_catalog_read on public.rg_module_catalog;
create policy rg_module_catalog_read on public.rg_module_catalog for select to authenticated using(true);
drop policy if exists rg_user_modules_read on public.rg_user_modules;
create policy rg_user_modules_read on public.rg_user_modules for select to authenticated using(user_id=auth.uid());
drop policy if exists rg_org_modules_read on public.rg_org_modules;
create policy rg_org_modules_read on public.rg_org_modules for select to authenticated using(public.rg_ecosystem_owns_org(organization_id));
drop policy if exists rg_business_links_read on public.rg_business_links;
create policy rg_business_links_read on public.rg_business_links for select to authenticated using(public.rg_ecosystem_owns_org(source_org_id) or public.rg_ecosystem_owns_org(target_org_id));
drop policy if exists rg_workflow_events_read on public.rg_workflow_events;
create policy rg_workflow_events_read on public.rg_workflow_events for select to authenticated using(public.rg_ecosystem_owns_org(source_org_id) or public.rg_ecosystem_owns_org(target_org_id));

revoke insert,update,delete on public.rg_user_modules,public.rg_org_modules,public.rg_business_links,public.rg_workflow_events from anon,authenticated;
grant select on public.rg_module_catalog,public.rg_user_modules,public.rg_org_modules,public.rg_business_links,public.rg_workflow_events to authenticated;
revoke all on function public.rg_ecosystem_owns_org(uuid) from public,anon;
revoke all on function public.rg_ecosystem_search_partners(text,text) from public,anon;
revoke all on function public.rg_ecosystem_set_module(text,uuid,jsonb,text) from public,anon;
revoke all on function public.rg_ecosystem_request_link(uuid,uuid,text,jsonb) from public,anon;
revoke all on function public.rg_ecosystem_respond_link(uuid,boolean) from public,anon;
revoke all on function public.rg_ecosystem_emit_event(uuid,uuid,text,text,text,text,uuid,jsonb) from public,anon;
revoke all on function public.rg_ecosystem_update_event(uuid,text) from public,anon;
grant execute on function public.rg_ecosystem_owns_org(uuid) to authenticated;
grant execute on function public.rg_ecosystem_search_partners(text,text) to authenticated;
grant execute on function public.rg_ecosystem_set_module(text,uuid,jsonb,text) to authenticated;
grant execute on function public.rg_ecosystem_request_link(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.rg_ecosystem_respond_link(uuid,boolean) to authenticated;
grant execute on function public.rg_ecosystem_emit_event(uuid,uuid,text,text,text,text,uuid,jsonb) to authenticated;
grant execute on function public.rg_ecosystem_update_event(uuid,text) to authenticated;

notify pgrst,'reload schema';
-- FIN MIGRATION 16 — ECOSYSTEME MULTI-POLES
