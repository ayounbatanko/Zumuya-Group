-- ZUMUYA GROUP — 16 : réseau logistique multi-entreprises
-- À exécuter APRÈS 10_logistique_organisations.sql et 11_equipes_livreurs_approvisionnement.sql.
-- Migration additive et relançable : ne supprime aucune donnée existante.
create extension if not exists pgcrypto;

-- Complète le registre livraison à partir de la fiche professionnelle déjà créée.
insert into public.rg_delivery_organizations(organization_id,owner_id,public_name,country_code,city,contact_phone,verification_status)
select o.id,o.owner_id,coalesce(nullif(o.public_name,''),'Société de livraison'),o.country_code,o.city,o.contact_phone,
       case when o.verification_status='verified' then 'verified' else 'pending' end
from public.rg_organizations o
where o.owner_id is not null and lower(coalesce(o.organization_type,'')) in ('delivery_service','delivery','logistics')
on conflict (organization_id) do update set
 public_name=excluded.public_name, country_code=excluded.country_code, city=excluded.city,
 contact_phone=excluded.contact_phone, updated_at=now();

create table if not exists public.rg_delivery_partnerships (
 id uuid primary key default gen_random_uuid(),
 delivery_org_id uuid not null references public.rg_delivery_organizations(id) on delete cascade,
 partner_org_id uuid not null references public.rg_organizations(id) on delete cascade,
 partner_type text not null check(partner_type in ('restaurant','hotel','agro_producer','agro_trader','marketplace','commerce')),
 partnership_status text not null default 'pending' check(partnership_status in ('pending','active','rejected','suspended','ended')),
 proposed_terms jsonb not null default '{}'::jsonb,
 agreed_terms jsonb not null default '{}'::jsonb,
 requested_by uuid not null default auth.uid() references auth.users(id),
 responded_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(delivery_org_id,partner_org_id)
);
create index if not exists rg_delivery_partners_delivery_idx on public.rg_delivery_partnerships(delivery_org_id,partnership_status);
create index if not exists rg_delivery_partners_partner_idx on public.rg_delivery_partnerships(partner_org_id,partnership_status);

create table if not exists public.rg_delivery_fleet (
 id uuid primary key default gen_random_uuid(),
 delivery_org_id uuid not null references public.rg_delivery_organizations(id) on delete cascade,
 label text not null, vehicle_type text not null check(vehicle_type in ('motorcycle','bicycle','car','van','truck','refrigerated_truck')),
 registration_number text, capacity_kg numeric(10,2), capacity_m3 numeric(10,2), is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create index if not exists rg_delivery_fleet_org_idx on public.rg_delivery_fleet(delivery_org_id,is_active);

create table if not exists public.rg_delivery_events (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.rg_delivery_jobs(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, event_type text not null,
 event_note text, latitude double precision, longitude double precision, proof_url text,
 created_at timestamptz not null default now()
);
create index if not exists rg_delivery_events_job_idx on public.rg_delivery_events(job_id,created_at);

create table if not exists public.rg_delivery_incidents (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.rg_delivery_jobs(id) on delete cascade,
 reported_by uuid not null default auth.uid() references auth.users(id), incident_type text not null,
 description text not null, incident_status text not null default 'open' check(incident_status in ('open','investigating','resolved','rejected')),
 resolution_note text, created_at timestamptz not null default now(), resolved_at timestamptz
);
create index if not exists rg_delivery_incidents_job_idx on public.rg_delivery_incidents(job_id,incident_status);

create table if not exists public.rg_delivery_rates (
 id uuid primary key default gen_random_uuid(), delivery_org_id uuid not null references public.rg_delivery_organizations(id) on delete cascade,
 zone_name text not null, vehicle_type text not null default 'motorcycle', base_fee_minor bigint not null default 0 check(base_fee_minor>=0),
 per_km_minor bigint not null default 0 check(per_km_minor>=0), per_kg_minor bigint not null default 0 check(per_kg_minor>=0),
 currency_code text not null default 'XOF', is_active boolean not null default true, created_at timestamptz not null default now()
);

-- Droits RLS : une entreprise ne voit que ses partenariats et missions associées.
alter table public.rg_delivery_partnerships enable row level security;
alter table public.rg_delivery_fleet enable row level security;
alter table public.rg_delivery_events enable row level security;
alter table public.rg_delivery_incidents enable row level security;
alter table public.rg_delivery_rates enable row level security;

drop policy if exists delivery_partnership_read on public.rg_delivery_partnerships;
create policy delivery_partnership_read on public.rg_delivery_partnerships for select to authenticated using (
 public.rg_is_delivery_org_owner(delivery_org_id) or exists(select 1 from public.rg_organizations o where o.id=partner_org_id and o.owner_id=auth.uid()) or public.rg_is_platform_owner()
);
drop policy if exists delivery_fleet_read on public.rg_delivery_fleet;
create policy delivery_fleet_read on public.rg_delivery_fleet for select to authenticated using(public.rg_is_delivery_org_owner(delivery_org_id) or public.rg_is_platform_owner());
drop policy if exists delivery_events_read on public.rg_delivery_events;
create policy delivery_events_read on public.rg_delivery_events for select to authenticated using (
 exists(select 1 from public.rg_delivery_jobs j where j.id=job_id and (j.requested_by=auth.uid() or j.assigned_driver=auth.uid() or public.rg_is_delivery_org_owner(j.delivery_org_id))) or public.rg_is_platform_owner()
);
drop policy if exists delivery_incidents_read on public.rg_delivery_incidents;
create policy delivery_incidents_read on public.rg_delivery_incidents for select to authenticated using (
 reported_by=auth.uid() or exists(select 1 from public.rg_delivery_jobs j where j.id=job_id and (j.requested_by=auth.uid() or j.assigned_driver=auth.uid() or public.rg_is_delivery_org_owner(j.delivery_org_id))) or public.rg_is_platform_owner()
);
drop policy if exists delivery_rates_read on public.rg_delivery_rates;
create policy delivery_rates_read on public.rg_delivery_rates for select to authenticated using(public.rg_is_delivery_org_owner(delivery_org_id) or public.rg_is_platform_owner());

grant select on public.rg_delivery_partnerships,public.rg_delivery_fleet,public.rg_delivery_events,public.rg_delivery_incidents,public.rg_delivery_rates to authenticated;

-- Toutes les écritures passent par RPC vérifiées.
create or replace function public.rg_delivery_bootstrap()
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org public.rg_organizations%rowtype; v_delivery uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise.'; end if;
 select * into v_org from public.rg_organizations where owner_id=auth.uid() order by created_at desc limit 1;
 if not found then raise exception 'Complétez d’abord la fiche de votre société dans Mon compte.'; end if;
 if lower(coalesce(v_org.organization_type,'')) not in ('delivery_service','delivery','logistics') then raise exception 'Ce compte n’est pas enregistré comme société de livraison.'; end if;
 insert into public.rg_delivery_organizations(organization_id,owner_id,public_name,country_code,city,contact_phone,verification_status)
 values(v_org.id,auth.uid(),v_org.public_name,v_org.country_code,v_org.city,v_org.contact_phone,case when v_org.verification_status='verified' then 'verified' else 'pending' end)
 on conflict(organization_id) do update set public_name=excluded.public_name,city=excluded.city,contact_phone=excluded.contact_phone,updated_at=now()
 returning id into v_delivery;
 return v_delivery;
end $$;

create or replace function public.rg_delivery_partner_request(p_partner_org uuid,p_partner_type text,p_terms jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_delivery uuid; v_id uuid;
begin
 select id into v_delivery from public.rg_delivery_organizations where owner_id=auth.uid() limit 1;
 if v_delivery is null then raise exception 'Organisation de livraison introuvable.'; end if;
 if p_partner_type not in ('restaurant','hotel','agro_producer','agro_trader','marketplace','commerce') then raise exception 'Catégorie partenaire invalide.'; end if;
 if not exists(select 1 from public.rg_organizations where id=p_partner_org and verification_status='verified') then raise exception 'Entreprise partenaire introuvable ou non vérifiée.'; end if;
 insert into public.rg_delivery_partnerships(delivery_org_id,partner_org_id,partner_type,proposed_terms,requested_by)
 values(v_delivery,p_partner_org,p_partner_type,coalesce(p_terms,'{}'::jsonb),auth.uid())
 on conflict(delivery_org_id,partner_org_id) do update set partnership_status='pending',proposed_terms=excluded.proposed_terms,requested_by=auth.uid(),updated_at=now()
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.rg_delivery_partner_respond(p_partnership uuid,p_accept boolean,p_terms jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.rg_delivery_partnerships p set partnership_status=case when p_accept then 'active' else 'rejected' end,
 agreed_terms=coalesce(p_terms,'{}'::jsonb),responded_at=now(),updated_at=now()
 where p.id=p_partnership and exists(select 1 from public.rg_organizations o where o.id=p.partner_org_id and o.owner_id=auth.uid());
 if not found then raise exception 'Seul le partenaire destinataire peut répondre à cette demande.'; end if;
end $$;

create or replace function public.rg_delivery_add_fleet(p_label text,p_vehicle_type text,p_registration text default null,p_capacity_kg numeric default null,p_capacity_m3 numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_id uuid;
begin
 select id into v_org from public.rg_delivery_organizations where owner_id=auth.uid() limit 1;
 if v_org is null then raise exception 'Organisation de livraison introuvable.'; end if;
 insert into public.rg_delivery_fleet(delivery_org_id,label,vehicle_type,registration_number,capacity_kg,capacity_m3)
 values(v_org,trim(p_label),p_vehicle_type,nullif(trim(p_registration),''),p_capacity_kg,p_capacity_m3) returning id into v_id;
 return v_id;
end $$;

create or replace function public.rg_delivery_create_rate(p_zone text,p_vehicle text,p_base bigint,p_km bigint,p_kg bigint default 0)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_id uuid;
begin
 select id into v_org from public.rg_delivery_organizations where owner_id=auth.uid() limit 1;
 if v_org is null then raise exception 'Organisation de livraison introuvable.'; end if;
 insert into public.rg_delivery_rates(delivery_org_id,zone_name,vehicle_type,base_fee_minor,per_km_minor,per_kg_minor)
 values(v_org,trim(p_zone),p_vehicle,greatest(p_base,0),greatest(p_km,0),greatest(coalesce(p_kg,0),0)) returning id into v_id;
 return v_id;
end $$;

create or replace function public.rg_delivery_assign_partner_job(p_job uuid,p_driver uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
 select delivery_org_id into v_org from public.rg_delivery_jobs where id=p_job for update;
 if v_org is null or not public.rg_is_delivery_org_owner(v_org) then raise exception 'Action réservée à la société de livraison.'; end if;
 if not exists(select 1 from public.rg_delivery_members where user_id=p_driver and delivery_org_id=v_org and member_status='active') then raise exception 'Livreur non actif dans cette société.'; end if;
 update public.rg_delivery_jobs set assigned_driver=p_driver,job_status='accepted',updated_at=now() where id=p_job and job_status in ('requested','accepted');
 if not found then raise exception 'Mission indisponible ou déjà terminée.'; end if;
end $$;

create or replace function public.rg_delivery_add_event(p_job uuid,p_type text,p_note text default null,p_lat double precision default null,p_lng double precision default null,p_proof text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.rg_delivery_jobs j where j.id=p_job and (j.requested_by=auth.uid() or j.assigned_driver=auth.uid() or public.rg_is_delivery_org_owner(j.delivery_org_id))) then raise exception 'Accès à cette mission refusé.'; end if;
 insert into public.rg_delivery_events(job_id,actor_id,event_type,event_note,latitude,longitude,proof_url) values(p_job,auth.uid(),p_type,p_note,p_lat,p_lng,p_proof) returning id into v_id;
 return v_id;
end $$;

create or replace function public.rg_delivery_report_incident(p_job uuid,p_type text,p_description text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.rg_delivery_jobs j where j.id=p_job and (j.requested_by=auth.uid() or j.assigned_driver=auth.uid() or public.rg_is_delivery_org_owner(j.delivery_org_id))) then raise exception 'Accès à cette mission refusé.'; end if;
 insert into public.rg_delivery_incidents(job_id,reported_by,incident_type,description) values(p_job,auth.uid(),p_type,trim(p_description)) returning id into v_id;
 return v_id;
end $$;

grant execute on function public.rg_delivery_bootstrap() to authenticated;
grant execute on function public.rg_delivery_partner_request(uuid,text,jsonb) to authenticated;
grant execute on function public.rg_delivery_partner_respond(uuid,boolean,jsonb) to authenticated;
grant execute on function public.rg_delivery_add_fleet(text,text,text,numeric,numeric) to authenticated;
grant execute on function public.rg_delivery_create_rate(text,text,bigint,bigint,bigint) to authenticated;
grant execute on function public.rg_delivery_assign_partner_job(uuid,uuid) to authenticated;
grant execute on function public.rg_delivery_add_event(uuid,text,text,double precision,double precision,text) to authenticated;
grant execute on function public.rg_delivery_report_incident(uuid,text,text) to authenticated;
notify pgrst,'reload schema';

-- Une entreprise partenaire peut transmettre une mission à une société avec laquelle elle a un partenariat actif.
create or replace function public.rg_delivery_partner_create_job(
 p_delivery_org uuid,p_source_type text,p_pickup_name text,p_pickup_phone text,p_pickup_address text,
 p_pickup_lat double precision,p_pickup_lng double precision,p_dropoff_name text,p_dropoff_phone text,
 p_dropoff_address text,p_dropoff_lat double precision,p_dropoff_lng double precision,p_goods text,
 p_fee bigint default 0
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_partner uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise.'; end if;
 select id into v_partner from public.rg_organizations where owner_id=auth.uid() order by created_at desc limit 1;
 if v_partner is null then raise exception 'Fiche professionnelle introuvable.'; end if;
 if not exists(select 1 from public.rg_delivery_partnerships where delivery_org_id=p_delivery_org and partner_org_id=v_partner and partnership_status='active') then
  raise exception 'Aucun partenariat actif avec cette société de livraison.';
 end if;
 if p_source_type not in ('customer_order','supplier_restock','hotel_order','restaurant_order') then raise exception 'Type de mission invalide.'; end if;
 insert into public.rg_delivery_jobs(delivery_org_id,source_type,requested_by,pickup_name,pickup_phone,pickup_address,pickup_lat,pickup_lng,
 dropoff_name,dropoff_phone,dropoff_address,dropoff_lat,dropoff_lng,goods_summary,delivery_fee_minor)
 values(p_delivery_org,p_source_type,auth.uid(),p_pickup_name,p_pickup_phone,p_pickup_address,p_pickup_lat,p_pickup_lng,
 p_dropoff_name,p_dropoff_phone,p_dropoff_address,p_dropoff_lat,p_dropoff_lng,p_goods,greatest(coalesce(p_fee,0),0)) returning id into v_id;
 return v_id;
end $$;
grant execute on function public.rg_delivery_partner_create_job(uuid,text,text,text,text,double precision,double precision,text,text,text,double precision,double precision,text,bigint) to authenticated;
notify pgrst,'reload schema';

-- Annuaire limité aux fiches publiques des sociétés vérifiées et disponibles.
drop policy if exists delivery_org_directory_read on public.rg_delivery_organizations;
create policy delivery_org_directory_read on public.rg_delivery_organizations
for select to authenticated using(verification_status='verified' and is_available=true);
grant select on public.rg_delivery_organizations to authenticated;
notify pgrst,'reload schema';
