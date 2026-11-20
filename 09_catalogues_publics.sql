-- ZUMUYA GROUP — publication des catalogues agricoles partenaires
-- Autorise uniquement la lecture publique des profils actifs et produits disponibles.
-- Les écritures restent réservées aux comptes authentifiés et propriétaires des lignes.
alter table public.rg_agro_profiles enable row level security;
alter table public.rg_agro_products enable row level security;
drop policy if exists agro_profiles_public_catalog_read on public.rg_agro_profiles;
create policy agro_profiles_public_catalog_read on public.rg_agro_profiles
 for select to anon, authenticated using (is_active = true);
drop policy if exists agro_products_public_catalog_read on public.rg_agro_products;
create policy agro_products_public_catalog_read on public.rg_agro_products
 for select to anon, authenticated using (availability <> 'unavailable');
grant select on public.rg_agro_profiles, public.rg_agro_products to anon, authenticated;
