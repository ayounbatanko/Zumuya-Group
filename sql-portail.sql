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
