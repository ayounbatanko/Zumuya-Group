-- ============================================================
-- ZUMUYA GROUP — MIGRATION 10
-- Organisations de livraison, invitations de livreurs,
-- missions logistiques et correction de privilèges.
-- Compatible avec les tables du projet v2. Relançable.
-- ============================================================

create extension if not exists pgcrypto;

-- A. Correction non publique des privilèges de la table commandes.
-- L'application doit utiliser une session Supabase authentifiée.
-- Ne pas accorder les écritures de rg_orders au rôle anon : cela
-- exposerait les commandes et les données clients.
do $$
begin
  if to_regclass('public.rg_orders') is not null then
    grant select, insert, update on table public.rg_orders to authenticated;
  end if;
  if to_regclass('public.rg_users') is not null then
    grant select, insert, update on table public.rg_users to authenticated;
  end if;
  if to_regclass('public.rg_rests') is not null then
    grant select on table public.rg_rests to anon, authenticated;
    grant insert, update on table public.rg_rests to authenticated;
  end if;
  if to_regclass('public.rg_chats') is not null then
    grant select, insert, update on table public.rg_chats to authenticated;
  end if;
end $$;

-- B. Registre des organisations de livraison.
create table if not exists public.rg_delivery_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique references public.rg_organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_name text not null,
  country_code text,
  city text,
  service_radius_km numeric(8,2) not null default 35 check(service_radius_km > 0),
  contact_phone text,
  verification_status text not null default 'pending'
    check(verification_status in ('pending','verified','suspended')),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rg_delivery_org_owner_idx
  on public.rg_delivery_organizations(owner_id);
create index if not exists rg_delivery_org_city_idx
  on public.rg_delivery_organizations(country_code,city);

-- C. Livreurs rattachés exclusivement à une organisation.
create table if not exists public.rg_delivery_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  delivery_org_id uuid not null references public.rg_delivery_organizations(id) on delete cascade,
  display_name text not null,
  phone text,
  vehicle_type text,
  member_status text not null default 'active'
    check(member_status in ('invited','active','suspended','left')),
  created_at timestamptz not null default now()
);
create index if not exists rg_delivery_members_org_idx
  on public.rg_delivery_members(delivery_org_id,member_status);

-- D. Invitations à usage unique créées par l'organisation.
create table if not exists public.rg_delivery_invites (
  id uuid primary key default gen_random_uuid(),
  delivery_org_id uuid not null references public.rg_delivery_organizations(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rg_delivery_invites_org_idx
  on public.rg_delivery_invites(delivery_org_id,created_at desc);

-- E. Missions de livraison, pour commandes clients et réapprovisionnement B2B.
create table if not exists public.rg_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  delivery_org_id uuid references public.rg_delivery_organizations(id) on delete set null,
  source_type text not null check(source_type in ('customer_order','supplier_restock','hotel_order','restaurant_order')),
  source_order_id text,
  requested_by uuid references auth.users(id) on delete set null,
  pickup_name text not null,
  pickup_phone text,
  pickup_address text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_name text not null,
  dropoff_phone text,
  dropoff_address text not null,
  dropoff_lat double precision,
  dropoff_lng double precision,
  goods_summary text,
  delivery_fee_minor bigint not null default 0 check(delivery_fee_minor >= 0),
  currency_code text not null default 'XOF',
  assigned_driver uuid references auth.users(id) on delete set null,
  job_status text not null default 'requested'
    check(job_status in ('requested','accepted','pickup','in_transit','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rg_delivery_jobs_org_status_idx
  on public.rg_delivery_jobs(delivery_org_id,job_status,created_at desc);
create index if not exists rg_delivery_jobs_driver_idx
  on public.rg_delivery_jobs(assigned_driver,job_status);

-- F. Helper de sécurité : un utilisateur est propriétaire d'une organisation logistique.
create or replace function public.rg_is_delivery_org_owner(p_org uuid)
returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.rg_delivery_organizations d
    where d.id=p_org and d.owner_id=auth.uid()
  );
$$;

-- G. Invitation créée par l'organisation. Le code brut n'est stocké nulle part.
create or replace function public.rg_delivery_create_invite(
  p_email text,
  p_valid_hours integer default 72
)
returns text
language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_token text;
begin
  select id into v_org
  from public.rg_delivery_organizations
  where owner_id=auth.uid() and verification_status='verified' and is_available=true
  limit 1;
  if v_org is null then
    raise exception 'Aucune organisation de livraison vérifiée ne correspond à ce compte.';
  end if;
  if p_email is null or position('@' in p_email)=0 then
    raise exception 'Adresse e-mail invalide.';
  end if;
  v_token := encode(gen_random_bytes(24),'hex');
  insert into public.rg_delivery_invites(delivery_org_id,email,token_hash,expires_at)
  values(v_org,lower(trim(p_email)),encode(digest(v_token,'sha256'),'hex'),
         now()+make_interval(hours=>greatest(1,least(coalesce(p_valid_hours,72),168))));
  return v_token;
end;
$$;

-- H. Acceptation d'une invitation par le livreur connecté avec la même adresse e-mail.
create or replace function public.rg_delivery_accept_invite(
  p_token text,
  p_display_name text,
  p_phone text default null,
  p_vehicle_type text default 'Moto'
)
returns uuid
language plpgsql security definer set search_path=public as $$
declare v_inv public.rg_delivery_invites%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  v_email := lower(coalesce(auth.jwt()->>'email',''));
  select * into v_inv
  from public.rg_delivery_invites
  where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
    and lower(email)=v_email and accepted_at is null and expires_at>now()
  for update;
  if not found then raise exception 'Invitation invalide, expirée ou destinée à une autre adresse e-mail.'; end if;

  insert into public.rg_delivery_members(user_id,delivery_org_id,display_name,phone,vehicle_type,member_status)
  values(auth.uid(),v_inv.delivery_org_id,coalesce(nullif(trim(p_display_name),''),'Livreur'),p_phone,p_vehicle_type,'active')
  on conflict(user_id) do update set delivery_org_id=excluded.delivery_org_id,
    display_name=excluded.display_name,phone=excluded.phone,vehicle_type=excluded.vehicle_type,
    member_status='active';

  update public.rg_delivery_invites set accepted_by=auth.uid(),accepted_at=now() where id=v_inv.id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) ||
      jsonb_build_object('account_type','delivery','delivery_org_id',v_inv.delivery_org_id)
  where id=auth.uid();

  -- Compatibilité avec le tableau de données du portail livreur existant.
  if to_regclass('public.rg_users') is not null then
    insert into public.rg_users(id,data)
    values(auth.uid()::text,jsonb_build_object(
      'id',auth.uid()::text,'role','driver','name',coalesce(nullif(trim(p_display_name),''),'Livreur'),
      'email',v_email,'phone',p_phone,'deliveryOrgId',v_inv.delivery_org_id::text,
      'authUserId',auth.uid()::text,'inactive',false,'disabled',false
    ))
    on conflict(id) do update set data=public.rg_users.data || excluded.data;
  end if;

  return v_inv.delivery_org_id;
end;
$$;

-- I. Création d'une demande de course B2B ou client par un compte authentifié.
create or replace function public.rg_delivery_request_job(
  p_source_type text,
  p_source_order_id text,
  p_pickup_name text,
  p_pickup_phone text,
  p_pickup_address text,
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_dropoff_name text,
  p_dropoff_phone text,
  p_dropoff_address text,
  p_dropoff_lat double precision,
  p_dropoff_lng double precision,
  p_goods_summary text,
  p_delivery_fee_minor bigint default 0
)
returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_source_type not in ('customer_order','supplier_restock','hotel_order','restaurant_order') then
    raise exception 'Type de livraison invalide.';
  end if;
  insert into public.rg_delivery_jobs(
    source_type,source_order_id,requested_by,pickup_name,pickup_phone,pickup_address,
    pickup_lat,pickup_lng,dropoff_name,dropoff_phone,dropoff_address,dropoff_lat,
    dropoff_lng,goods_summary,delivery_fee_minor
  ) values(
    p_source_type,p_source_order_id,auth.uid(),p_pickup_name,p_pickup_phone,p_pickup_address,
    p_pickup_lat,p_pickup_lng,p_dropoff_name,p_dropoff_phone,p_dropoff_address,p_dropoff_lat,
    p_dropoff_lng,p_goods_summary,greatest(coalesce(p_delivery_fee_minor,0),0)
  ) returning id into v_id;
  return v_id;
end;
$$;

-- J. Attribution et changement d'état réservés à l'organisation ou au livreur affecté.
create or replace function public.rg_delivery_assign_driver(p_job uuid,p_driver uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
  select delivery_org_id into v_org from public.rg_delivery_jobs where id=p_job for update;
  if v_org is null or not public.rg_is_delivery_org_owner(v_org) then
    raise exception 'Action réservée à l’organisation de livraison.';
  end if;
  if not exists(select 1 from public.rg_delivery_members
    where user_id=p_driver and delivery_org_id=v_org and member_status='active') then
    raise exception 'Ce livreur ne fait pas partie de votre organisation.';
  end if;
  update public.rg_delivery_jobs set assigned_driver=p_driver,delivery_org_id=v_org,
    job_status='accepted',updated_at=now() where id=p_job;
end;
$$;

create or replace function public.rg_delivery_update_job(p_job uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('pickup','in_transit','delivered','cancelled') then
    raise exception 'Statut de livraison invalide.';
  end if;
  update public.rg_delivery_jobs
  set job_status=p_status,updated_at=now()
  where id=p_job and assigned_driver=auth.uid();
  if not found then raise exception 'Course non attribuée à ce livreur.'; end if;
end;
$$;

-- K. RLS stricte.
alter table public.rg_delivery_organizations enable row level security;
alter table public.rg_delivery_members enable row level security;
alter table public.rg_delivery_invites enable row level security;
alter table public.rg_delivery_jobs enable row level security;

drop policy if exists delivery_org_owner_read on public.rg_delivery_organizations;
create policy delivery_org_owner_read on public.rg_delivery_organizations
for select to authenticated using(owner_id=auth.uid() or public.rg_is_platform_owner());

drop policy if exists delivery_member_read on public.rg_delivery_members;
create policy delivery_member_read on public.rg_delivery_members
for select to authenticated using(
  user_id=auth.uid() or public.rg_is_delivery_org_owner(delivery_org_id) or public.rg_is_platform_owner()
);

drop policy if exists delivery_invite_owner_read on public.rg_delivery_invites;
create policy delivery_invite_owner_read on public.rg_delivery_invites
for select to authenticated using(public.rg_is_delivery_org_owner(delivery_org_id) or public.rg_is_platform_owner());

drop policy if exists delivery_jobs_access_read on public.rg_delivery_jobs;
create policy delivery_jobs_access_read on public.rg_delivery_jobs
for select to authenticated using(
  requested_by=auth.uid() or assigned_driver=auth.uid()
  or public.rg_is_delivery_org_owner(delivery_org_id) or public.rg_is_platform_owner()
);

grant select on public.rg_delivery_organizations,public.rg_delivery_members,
  public.rg_delivery_invites,public.rg_delivery_jobs to authenticated;
grant execute on function public.rg_is_delivery_org_owner(uuid) to authenticated;
grant execute on function public.rg_delivery_create_invite(text,integer) to authenticated;
grant execute on function public.rg_delivery_accept_invite(text,text,text,text) to authenticated;
grant execute on function public.rg_delivery_request_job(text,text,text,text,text,double precision,double precision,text,text,text,double precision,double precision,text,bigint) to authenticated;
grant execute on function public.rg_delivery_assign_driver(uuid,uuid) to authenticated;
grant execute on function public.rg_delivery_update_job(uuid,text) to authenticated;

-- L. Vue publique : les visiteurs voient les catalogues actifs, pas les espaces privés.
-- Les tables agro restent lisibles uniquement via les policies publiques déjà définies.
notify pgrst,'reload schema';
-- FIN MIGRATION 10
