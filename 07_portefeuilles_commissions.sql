
-- ZUMUYA GROUP — Portefeuilles sécurisés et commissions
-- À exécuter dans Supabase SQL Editor après les scripts existants.
create table if not exists public.rg_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency_code text not null default 'XOF' check (currency_code='XOF'),
  balance_minor bigint not null default 0 check (balance_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.rg_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('deposit','sale','purchase','commission','withdrawal','refund','adjustment')),
  amount_minor bigint not null check (amount_minor > 0),
  direction text not null check (direction in ('credit','debit')),
  status text not null default 'posted' check (status in ('pending','posted','failed','reversed')),
  reference text unique,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists rg_wallet_ledger_user_date on public.rg_wallet_ledger(user_id,created_at desc);
create table if not exists public.rg_wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null default 'XOF',
  payment_method jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','paid','rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create table if not exists public.rg_wallet_payout_methods (
  user_id uuid primary key references auth.users(id) on delete cascade,
  method_type text not null check(method_type in ('mobile_money','bank')),
  destination text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.rg_wallet_settings (
  id boolean primary key default true check (id),
  commission_percent numeric(5,2) not null default 5.00 check (commission_percent >= 0 and commission_percent <= 30),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.rg_wallet_settings(id,commission_percent) values(true,5.00) on conflict(id) do nothing;

create or replace function public.rg_wallet_create_for_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.rg_wallets(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end $$;
drop trigger if exists rg_wallet_auth_insert on auth.users;
create trigger rg_wallet_auth_insert after insert on auth.users
for each row execute function public.rg_wallet_create_for_user();
insert into public.rg_wallets(user_id) select id from auth.users on conflict do nothing;

alter table public.rg_wallets enable row level security;
alter table public.rg_wallet_ledger enable row level security;
alter table public.rg_wallet_withdrawals enable row level security;
alter table public.rg_wallet_settings enable row level security;
alter table public.rg_wallet_payout_methods enable row level security;
drop policy if exists wallet_self_read on public.rg_wallets;
create policy wallet_self_read on public.rg_wallets for select to authenticated using(user_id=auth.uid() or public.rg_is_platform_owner());
drop policy if exists wallet_ledger_self_read on public.rg_wallet_ledger;
create policy wallet_ledger_self_read on public.rg_wallet_ledger for select to authenticated using(user_id=auth.uid() or public.rg_is_platform_owner());
drop policy if exists wallet_withdraw_self_read on public.rg_wallet_withdrawals;
create policy wallet_withdraw_self_read on public.rg_wallet_withdrawals for select to authenticated using(user_id=auth.uid() or public.rg_is_platform_owner());
drop policy if exists wallet_withdraw_self_insert on public.rg_wallet_withdrawals;
create policy wallet_withdraw_self_insert on public.rg_wallet_withdrawals for insert to authenticated with check(user_id=auth.uid() and status='pending');
drop policy if exists payout_method_self on public.rg_wallet_payout_methods;
create policy payout_method_self on public.rg_wallet_payout_methods for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists wallet_settings_owner_read on public.rg_wallet_settings;
create policy wallet_settings_owner_read on public.rg_wallet_settings for select to authenticated using(public.rg_is_platform_owner());
grant select on public.rg_wallets,public.rg_wallet_ledger,public.rg_wallet_withdrawals,public.rg_wallet_settings,public.rg_wallet_payout_methods to authenticated;
grant insert,update on public.rg_wallet_payout_methods to authenticated;
revoke insert on public.rg_wallet_withdrawals from anon,authenticated;

-- Retrait : réserve immédiatement les fonds, sans autoriser le client à modifier le solde.
create or replace function public.rg_wallet_request_withdrawal(p_amount_minor bigint,p_method jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare wid uuid;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'Montant invalide'; end if;
 if p_method is null or p_method='{}'::jsonb then raise exception 'Moyen de paiement requis'; end if;
 update public.rg_wallets set balance_minor=balance_minor-p_amount_minor,updated_at=now()
 where user_id=auth.uid() and balance_minor>=p_amount_minor;
 if not found then raise exception 'Solde insuffisant'; end if;
 insert into public.rg_wallet_withdrawals(user_id,amount_minor,payment_method)
 values(auth.uid(),p_amount_minor,p_method) returning id into wid;
 insert into public.rg_wallet_ledger(user_id,entry_type,amount_minor,direction,status,reference,description)
 values(auth.uid(),'withdrawal',p_amount_minor,'debit','pending','withdrawal:'||wid,'Demande de retrait en attente');
 return wid;
end $$;
grant execute on function public.rg_wallet_request_withdrawal(bigint,jsonb) to authenticated;

-- Réglage de la commission : propriétaire uniquement.
create or replace function public.rg_wallet_set_commission(p_percent numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.rg_is_platform_owner() then raise exception 'Accès propriétaire requis'; end if;
 if p_percent < 0 or p_percent > 30 then raise exception 'Commission comprise entre 0 et 30 %'; end if;
 update public.rg_wallet_settings set commission_percent=p_percent,updated_at=now(),updated_by=auth.uid() where id=true;
end $$;
grant execute on function public.rg_wallet_set_commission(numeric) to authenticated;

-- À appeler exclusivement depuis une Edge Function/webhook de paiement vérifié (service_role).
-- Une référence unique garantit l'idempotence. Montants exprimés en unités mineures XOF.
create or replace function public.rg_wallet_settle_sale(p_reference text,p_buyer uuid,p_seller uuid,p_gross_minor bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare pct numeric; fee bigint; net bigint; owner_id uuid;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Traitement serveur uniquement'; end if;
 if p_reference is null or p_reference='' or p_gross_minor<=0 or p_buyer=p_seller then raise exception 'Paramètres de vente invalides'; end if;
 if exists(select 1 from public.rg_wallet_ledger where reference in (p_reference||':buyer',p_reference||':seller',p_reference||':owner')) then
   return jsonb_build_object('already_processed',true);
 end if;
 select commission_percent into pct from public.rg_wallet_settings where id=true;
 fee:=round(p_gross_minor*pct/100.0); net:=p_gross_minor-fee;
 select user_id into owner_id from public.rg_platform_owners limit 1;
 if owner_id is null then raise exception 'Portefeuille propriétaire non configuré'; end if;
 insert into public.rg_wallets(user_id) values(p_buyer),(p_seller),(owner_id) on conflict do nothing;
 update public.rg_wallets set balance_minor=balance_minor-p_gross_minor,updated_at=now()
 where user_id=p_buyer and balance_minor>=p_gross_minor;
 if not found then raise exception 'Solde acheteur insuffisant'; end if;
 update public.rg_wallets set balance_minor=balance_minor+net,updated_at=now() where user_id=p_seller;
 update public.rg_wallets set balance_minor=balance_minor+fee,updated_at=now() where user_id=owner_id;
 insert into public.rg_wallet_ledger(user_id,entry_type,amount_minor,direction,reference,description)
 values(p_buyer,'purchase',p_gross_minor,'debit',p_reference||':buyer','Achat en ligne'),
       (p_seller,'sale',net,'credit',p_reference||':seller','Produit vendu — montant net'),
       (owner_id,'commission',fee,'credit',p_reference||':owner','Commission ZUMUYA sur vente');
 return jsonb_build_object('gross_minor',p_gross_minor,'commission_minor',fee,'seller_net_minor',net,'commission_percent',pct);
end $$;
revoke all on function public.rg_wallet_settle_sale(text,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.rg_wallet_settle_sale(text,uuid,uuid,bigint) to service_role;
notify pgrst,'reload schema';
