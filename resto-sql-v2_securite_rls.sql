-- ÉTAPE 2 (SÉCURITÉ) : remplace les politiques "using (true)" par des règles réelles.
-- ⚠️ À EXÉCUTER SEULEMENT APRÈS avoir migré la connexion vers Supabase Auth (ext/auth-bridge.js),
--    sinon l'application actuelle (clé anonyme) n'aura plus accès aux données.
-- Prérequis : chaque ligne rg_users.data contient "authId" = auth.users.id (voir migration en bas).

create or replace function public.rg_role() returns text language sql stable security definer set search_path=public as $$
  select data->>'role' from public.rg_users where data->>'authId' = auth.uid()::text limit 1 $$;
create or replace function public.rg_uid() returns text language sql stable security definer set search_path=public as $$
  select data->>'id' from public.rg_users where data->>'authId' = auth.uid()::text limit 1 $$;
create or replace function public.rg_is_owner() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.rg_role()='owner',false) $$;

alter table public.rg_users  enable row level security;
alter table public.rg_rests  enable row level security;
alter table public.rg_orders enable row level security;
alter table public.rg_chats  enable row level security;

drop policy if exists rg_users_all on public.rg_users;  drop policy if exists rg_rests_all on public.rg_rests;
drop policy if exists rg_orders_all on public.rg_orders; drop policy if exists rg_chats_all on public.rg_chats;

-- Utilisateurs : chacun lit/modifie sa ligne ; le propriétaire gère tout ; les livreurs/restaurants se voient entre eux via rg_rests.
create policy users_self  on public.rg_users for select to authenticated using (data->>'authId'=auth.uid()::text or public.rg_is_owner());
create policy users_upd   on public.rg_users for update to authenticated using (data->>'authId'=auth.uid()::text or public.rg_is_owner());
create policy users_ins   on public.rg_users for insert to authenticated with check (data->>'authId'=auth.uid()::text or public.rg_is_owner());
create policy users_del   on public.rg_users for delete to authenticated using (public.rg_is_owner());

-- Restaurants : lecture publique (catalogue), écriture par le propriétaire du restaurant ou le propriétaire de la plateforme.
create policy rests_read  on public.rg_rests for select to anon, authenticated using (true);
create policy rests_write on public.rg_rests for all to authenticated
  using (data->>'ownerId'=public.rg_uid() or public.rg_is_owner())
  with check (data->>'ownerId'=public.rg_uid() or public.rg_is_owner());

-- Commandes : visibles par le client, le livreur affecté, le restaurant concerné et le propriétaire.
create policy orders_read on public.rg_orders for select to authenticated using (
  data->>'clientId'=public.rg_uid() or data->>'driverId'=public.rg_uid()
  or exists(select 1 from public.rg_rests r where r.data->>'id'=rg_orders.data->>'restId' and r.data->>'ownerId'=public.rg_uid())
  or (data->'offer'->>'driverId')=public.rg_uid() or public.rg_is_owner());
create policy orders_ins  on public.rg_orders for insert to authenticated with check (data->>'clientId'=public.rg_uid());
create policy orders_upd  on public.rg_orders for update to authenticated using (
  data->>'clientId'=public.rg_uid() or data->>'driverId'=public.rg_uid() or (data->'offer'->>'driverId')=public.rg_uid()
  or exists(select 1 from public.rg_rests r where r.data->>'id'=rg_orders.data->>'restId' and r.data->>'ownerId'=public.rg_uid())
  or public.rg_is_owner());

-- Messagerie : l'expéditeur, le destinataire ou le propriétaire.
create policy chats_rw on public.rg_chats for all to authenticated
  using (data->>'from'=public.rg_uid() or data->>'to'=public.rg_uid() or public.rg_is_owner())
  with check (data->>'from'=public.rg_uid() or public.rg_is_owner());
-- Visiteurs (support de la page de connexion) : insertion seule.
create policy chats_visitor_ins on public.rg_chats for insert to anon with check (data->>'visitor'='true');

notify pgrst, 'reload schema';

-- MIGRATION des comptes existants (à faire une fois, avec l'API admin) :
--   pour chaque rg_users : créer l'utilisateur Auth (e-mail = <téléphone>@restogest.app), puis
--   update public.rg_users set data = data || jsonb_build_object('authId','<uuid auth>') where data->>'id'='<id>';
-- Les mots de passe en clair/SHA-256 de l'ancienne base doivent ensuite être supprimés de data.
