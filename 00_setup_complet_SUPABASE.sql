-- ============================================================
-- Service de Restauration (ZUMUYA) — Configuration Supabase
-- Projet : https://azfunhfjmybekzakhtbu.supabase.co
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- 1) Tables principales (idempotent)
create table if not exists public.rg_users (
  id   text primary key,
  data jsonb not null default '{}'::jsonb,
  seq  bigint generated always as identity
);

create table if not exists public.rg_rests (
  id   text primary key,
  data jsonb not null default '{}'::jsonb,
  seq  bigint generated always as identity
);

create table if not exists public.rg_orders (
  id   text primary key,
  data jsonb not null default '{}'::jsonb,
  seq  bigint generated always as identity
);

create table if not exists public.rg_chats (
  id   text primary key,
  data jsonb not null default '{}'::jsonb,
  seq  bigint generated always as identity
);

-- 2) Index de performance
create index if not exists rg_users_seq_idx  on public.rg_users (seq);
create index if not exists rg_rests_seq_idx  on public.rg_rests (seq);
create index if not exists rg_orders_seq_idx on public.rg_orders (seq);
create index if not exists rg_chats_seq_idx  on public.rg_chats (seq);

create index if not exists rg_orders_rest_idx   on public.rg_orders ((data->>'restId'));
create index if not exists rg_orders_client_idx on public.rg_orders ((data->>'clientId'));
create index if not exists rg_orders_driver_idx on public.rg_orders ((data->>'driverId'));
create index if not exists rg_orders_status_idx on public.rg_orders ((data->>'status'));
create index if not exists rg_users_role_idx    on public.rg_users ((data->>'role'));
create index if not exists rg_users_phone_idx   on public.rg_users ((data->>'phone'));
create index if not exists rg_users_email_idx   on public.rg_users ((data->>'email'));

-- 3) Realtime (pour mises à jour live)
do $$
begin
  begin
    alter publication supabase_realtime add table public.rg_users;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rg_rests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rg_orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rg_chats;
  exception when duplicate_object then null;
  end;
end $$;

-- 4) RLS activé + politiques OUVERTES (version actuelle = clé anon)
--    ⚠️ Ces politiques permettent à l'application actuelle de fonctionner.
--    Plus tard, remplacez-les par sql/v2_securite_rls.sql après migration Auth.
alter table public.rg_users  enable row level security;
alter table public.rg_rests  enable row level security;
alter table public.rg_orders enable row level security;
alter table public.rg_chats  enable row level security;

drop policy if exists "rg_users_all"  on public.rg_users;
drop policy if exists "rg_rests_all"  on public.rg_rests;
drop policy if exists "rg_orders_all" on public.rg_orders;
drop policy if exists "rg_chats_all"  on public.rg_chats;

create policy "rg_users_all"  on public.rg_users  for all to anon, authenticated using (true) with check (true);
create policy "rg_rests_all"  on public.rg_rests  for all to anon, authenticated using (true) with check (true);
create policy "rg_orders_all" on public.rg_orders for all to anon, authenticated using (true) with check (true);
create policy "rg_chats_all"  on public.rg_chats  for all to anon, authenticated using (true) with check (true);

-- 5) Droits
grant select, insert, update, delete on public.rg_users  to anon, authenticated;
grant select, insert, update, delete on public.rg_rests  to anon, authenticated;
grant select, insert, update, delete on public.rg_orders to anon, authenticated;
grant select, insert, update, delete on public.rg_chats  to anon, authenticated;

-- 6) Compte propriétaire plateforme (tankobama73@gmail.com)
--    Si le compte n'existe pas encore, il est créé. Sinon on force l'email.
insert into public.rg_users (id, data)
values (
  'owner1',
  jsonb_build_object(
    'id', 'owner1',
    'role', 'owner',
    'name', 'tankobama73@gmail.com',
    'phone', 'tankobama73@gmail.com',
    'email', 'tankobama73@gmail.com',
    'needsSetup', true
  )
)
on conflict (id) do update set
  data = public.rg_users.data || jsonb_build_object(
    'name', 'tankobama73@gmail.com',
    'phone', 'tankobama73@gmail.com',
    'email', 'tankobama73@gmail.com',
    'role', 'owner',
    'needsSetup', true
  );

-- 7) Recharger le cache PostgREST
notify pgrst, 'reload schema';

-- Terminé. Vérifiez dans Table Editor que rg_users, rg_rests, rg_orders, rg_chats existent.
