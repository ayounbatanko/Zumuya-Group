-- ============================================================
-- ZUMUYA GROUP — 21 : Abonnements Pro Restaurant & Hôtel
-- À exécuter APRÈS les migrations 00-20 et z_hospitality_native.sql
-- Gestion des abonnements Pro depuis le compte propriétaire
-- ============================================================

create extension if not exists pgcrypto;

-- Plans tarifaires (par pôle et durée)
create table if not exists public.zrh_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('restaurant','hotel')),
  months int not null check (months in (1,3,6,12)),
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency_code text not null default 'XOF',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_type, months)
);

-- Moyens de paiement (instructions envoyées aux établissements)
create table if not exists public.zrh_subscription_payment_methods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  instructions text not null default '',
  account_name text,
  account_number text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Abonnement courant d'un établissement (org)
create table if not exists public.zrh_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.rg_organizations(id) on delete cascade,
  service_type text not null check (service_type in ('restaurant','hotel')),
  status text not null default 'trial'
    check (status in ('trial','active','expired','suspended')),
  trial_ends_at timestamptz,
  pro_ends_at timestamptz,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zrh_subs_status_idx on public.zrh_subscriptions(status);
create index if not exists zrh_subs_service_idx on public.zrh_subscriptions(service_type);

-- Demandes de paiement / activation Pro
create table if not exists public.zrh_subscription_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rg_organizations(id) on delete cascade,
  service_type text not null check (service_type in ('restaurant','hotel')),
  months int not null check (months in (1,3,6,12)),
  amount_minor bigint not null default 0,
  currency_code text not null default 'XOF',
  status text not null default 'pending'
    check (status in ('pending','awaiting_payment','paid','approved','rejected','cancelled')),
  payment_reference text,
  payment_method_id uuid references public.zrh_subscription_payment_methods(id) on delete set null,
  owner_note text,
  requested_by uuid references auth.users(id) on delete set null,
  processed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zrh_req_status_idx on public.zrh_subscription_requests(status, created_at desc);
create index if not exists zrh_req_org_idx on public.zrh_subscription_requests(org_id);

-- Tarifs par défaut (modifiables depuis le propriétaire)
insert into public.zrh_subscription_plans (service_type, months, amount_minor, currency_code, active)
values
  ('restaurant', 1, 15000, 'XOF', true),
  ('restaurant', 3, 40000, 'XOF', true),
  ('restaurant', 6, 75000, 'XOF', true),
  ('restaurant',12,140000, 'XOF', true),
  ('hotel', 1, 20000, 'XOF', true),
  ('hotel', 3, 55000, 'XOF', true),
  ('hotel', 6,100000, 'XOF', true),
  ('hotel',12,180000, 'XOF', true)
on conflict (service_type, months) do nothing;

-- Initialiser un abonnement essai à la création d'une org restaurant/hôtel
create or replace function public.zrh_init_subscription()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
begin
  if new.organization_type in ('restaurant','hotel') then
    insert into public.zrh_subscriptions (org_id, service_type, status, trial_ends_at)
    values (new.id, new.organization_type, 'trial', now() + interval '30 days')
    on conflict (org_id) do nothing;
  end if;
  return new;
end;
$fn$;

drop trigger if exists zrh_org_init_sub on public.rg_organizations;
create trigger zrh_org_init_sub
  after insert on public.rg_organizations
  for each row execute function public.zrh_init_subscription();

-- Le propriétaire (ou membre avec permission subscriptions) agit sur une demande
create or replace function public.zrh_subscription_owner_action(
  p_request_id uuid,
  p_action text,
  p_method_id uuid default null,
  p_owner_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_req public.zrh_subscription_requests%rowtype;
  v_months int;
begin
  if not (public.rg_is_platform_owner() or public.rg_platform_can('subscriptions')) then
    raise exception 'Action réservée au propriétaire ou à un membre autorisé (abonnements).';
  end if;

  select * into v_req from public.zrh_subscription_requests where id = p_request_id for update;
  if not found then raise exception 'Demande introuvable.'; end if;

  if p_action = 'send_instructions' then
    if p_method_id is null then raise exception 'Moyen de paiement requis.'; end if;
    update public.zrh_subscription_requests
      set status = 'awaiting_payment',
          payment_method_id = p_method_id,
          owner_note = coalesce(p_owner_note, owner_note),
          processed_by = auth.uid(),
          updated_at = now()
    where id = p_request_id;

  elsif p_action = 'approve' then
    v_months := v_req.months;
    update public.zrh_subscription_requests
      set status = 'approved',
          owner_note = coalesce(p_owner_note, owner_note),
          processed_by = auth.uid(),
          updated_at = now()
    where id = p_request_id;

    insert into public.zrh_subscriptions (org_id, service_type, status, pro_ends_at, updated_by, updated_at)
    values (
      v_req.org_id,
      v_req.service_type,
      'active',
      greatest(coalesce((select pro_ends_at from public.zrh_subscriptions where org_id = v_req.org_id), now()), now())
        + (v_months || ' months')::interval,
      auth.uid(),
      now()
    )
    on conflict (org_id) do update set
      status = 'active',
      pro_ends_at = greatest(coalesce(public.zrh_subscriptions.pro_ends_at, now()), now())
        + (v_months || ' months')::interval,
      updated_by = auth.uid(),
      updated_at = now();

  elsif p_action = 'reject' then
    update public.zrh_subscription_requests
      set status = 'rejected',
          owner_note = coalesce(p_owner_note, owner_note),
          processed_by = auth.uid(),
          updated_at = now()
    where id = p_request_id;

  else
    raise exception 'Action inconnue: %', p_action;
  end if;
end;
$fn$;

revoke all on function public.zrh_subscription_owner_action(uuid, text, uuid, text) from public;
grant execute on function public.zrh_subscription_owner_action(uuid, text, uuid, text) to authenticated;

-- Suspension / réactivation / prolongation manuelle par le propriétaire
create or replace function public.zrh_subscription_admin_set_status(
  p_org_id uuid,
  p_action text,
  p_months int default 1,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_org public.rg_organizations%rowtype;
begin
  if not (public.rg_is_platform_owner() or public.rg_platform_can('subscriptions')) then
    raise exception 'Action réservée au propriétaire ou à un membre autorisé (abonnements).';
  end if;

  select * into v_org from public.rg_organizations where id = p_org_id;
  if not found then raise exception 'Organisation introuvable.'; end if;
  if v_org.organization_type not in ('restaurant','hotel') then
    raise exception 'Abonnement Pro réservé aux restaurants et hôtels.';
  end if;

  if p_action = 'activate' then
    insert into public.zrh_subscriptions (org_id, service_type, status, pro_ends_at, note, updated_by, updated_at)
    values (
      p_org_id, v_org.organization_type, 'active',
      now() + (greatest(1, coalesce(p_months,1)) || ' months')::interval,
      p_note, auth.uid(), now()
    )
    on conflict (org_id) do update set
      status = 'active',
      pro_ends_at = greatest(coalesce(public.zrh_subscriptions.pro_ends_at, now()), now())
        + (greatest(1, coalesce(p_months,1)) || ' months')::interval,
      note = coalesce(p_note, public.zrh_subscriptions.note),
      updated_by = auth.uid(),
      updated_at = now();

  elsif p_action = 'suspend' then
    update public.zrh_subscriptions
      set status = 'suspended', note = coalesce(p_note, note),
          updated_by = auth.uid(), updated_at = now()
    where org_id = p_org_id;

  elsif p_action = 'unsuspend' then
    update public.zrh_subscriptions
      set status = case when pro_ends_at is not null and pro_ends_at > now() then 'active' else 'expired' end,
          note = coalesce(p_note, note),
          updated_by = auth.uid(), updated_at = now()
    where org_id = p_org_id;

  else
    raise exception 'Action inconnue: %', p_action;
  end if;
end;
$fn$;

revoke all on function public.zrh_subscription_admin_set_status(uuid, text, int, text) from public;
grant execute on function public.zrh_subscription_admin_set_status(uuid, text, int, text) to authenticated;

-- Un établissement demande un abonnement Pro
create or replace function public.zrh_subscription_request_pro(
  p_org_id uuid,
  p_months int,
  p_payment_reference text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $fn$
declare
  v_org public.rg_organizations%rowtype;
  v_plan public.zrh_subscription_plans%rowtype;
  v_id uuid;
begin
  select * into v_org from public.rg_organizations where id = p_org_id;
  if not found then raise exception 'Organisation introuvable.'; end if;
  if v_org.organization_type not in ('restaurant','hotel') then
    raise exception 'Réservé aux restaurants et hôtels.';
  end if;
  if v_org.owner_id <> auth.uid() and not public.z_hosp_is_owner(p_org_id) then
    raise exception 'Seul le compte principal de l''établissement peut demander un abonnement.';
  end if;

  select * into v_plan
  from public.zrh_subscription_plans
  where service_type = v_org.organization_type and months = p_months and active = true;
  if not found then raise exception 'Formule introuvable.'; end if;

  insert into public.zrh_subscription_requests (
    org_id, service_type, months, amount_minor, currency_code,
    status, payment_reference, requested_by
  ) values (
    p_org_id, v_org.organization_type, p_months, v_plan.amount_minor, v_plan.currency_code,
    'pending', p_payment_reference, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.zrh_subscription_request_pro(uuid, int, text) from public;
grant execute on function public.zrh_subscription_request_pro(uuid, int, text) to authenticated;

-- Vérifier si un établissement a le Pro actif
create or replace function public.zrh_is_pro(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.zrh_subscriptions s
    where s.org_id = p_org_id
      and s.status = 'active'
      and (s.pro_ends_at is null or s.pro_ends_at > now())
  )
  or exists (
    select 1 from public.zrh_subscriptions s
    where s.org_id = p_org_id
      and s.status = 'trial'
      and s.trial_ends_at > now()
  );
$fn$;

revoke all on function public.zrh_is_pro(uuid) from public;
grant execute on function public.zrh_is_pro(uuid) to authenticated, anon;

-- RLS
alter table public.zrh_subscription_plans enable row level security;
alter table public.zrh_subscription_payment_methods enable row level security;
alter table public.zrh_subscriptions enable row level security;
alter table public.zrh_subscription_requests enable row level security;

drop policy if exists zrh_plans_read on public.zrh_subscription_plans;
create policy zrh_plans_read on public.zrh_subscription_plans for select to authenticated using (true);

drop policy if exists zrh_plans_owner on public.zrh_subscription_plans;
create policy zrh_plans_owner on public.zrh_subscription_plans for all to authenticated
using (public.rg_is_platform_owner() or public.rg_platform_can('subscriptions'))
with check (public.rg_is_platform_owner() or public.rg_platform_can('subscriptions'));

drop policy if exists zrh_methods_read on public.zrh_subscription_payment_methods;
create policy zrh_methods_read on public.zrh_subscription_payment_methods for select to authenticated using (active = true or public.rg_is_platform_owner() or public.rg_platform_can('subscriptions'));

drop policy if exists zrh_methods_owner on public.zrh_subscription_payment_methods;
create policy zrh_methods_owner on public.zrh_subscription_payment_methods for all to authenticated
using (public.rg_is_platform_owner() or public.rg_platform_can('subscriptions'))
with check (public.rg_is_platform_owner() or public.rg_platform_can('subscriptions'));

drop policy if exists zrh_subs_read on public.zrh_subscriptions;
create policy zrh_subs_read on public.zrh_subscriptions for select to authenticated
using (
  public.rg_is_platform_owner()
  or public.rg_platform_can('subscriptions')
  or exists (select 1 from public.rg_organizations o where o.id = org_id and o.owner_id = auth.uid())
  or public.z_hosp_can(org_id, null)
);

drop policy if exists zrh_req_read on public.zrh_subscription_requests;
create policy zrh_req_read on public.zrh_subscription_requests for select to authenticated
using (
  public.rg_is_platform_owner()
  or public.rg_platform_can('subscriptions')
  or exists (select 1 from public.rg_organizations o where o.id = org_id and o.owner_id = auth.uid())
);

drop policy if exists zrh_req_insert on public.zrh_subscription_requests;
create policy zrh_req_insert on public.zrh_subscription_requests for insert to authenticated
with check (
  exists (select 1 from public.rg_organizations o where o.id = org_id and o.owner_id = auth.uid())
);

grant select on public.zrh_subscription_plans to authenticated;
grant select on public.zrh_subscription_payment_methods to authenticated;
grant select on public.zrh_subscriptions to authenticated;
grant select, insert on public.zrh_subscription_requests to authenticated;

-- Droits étendus pour le propriétaire (via RLS ci-dessus + RPCs)

comment on table public.zrh_subscriptions is 'Abonnements Pro des restaurants et hôtels ZUMUYA';
comment on table public.zrh_subscription_requests is 'Demandes d''activation Pro validées par le propriétaire';
comment on table public.zrh_subscription_plans is 'Tarifs Pro configurables depuis le compte propriétaire';
