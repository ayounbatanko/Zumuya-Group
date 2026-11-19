-- ZUMUYA AGRO — Pôle 04 : profils géolocalisés, catalogue et demandes d'approvisionnement
-- À exécuter dans Supabase SQL Editor après sql-portail.sql.
create extension if not exists pgcrypto;

create table if not exists public.rg_agro_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('restaurant','agro_producer','agro_trader')),
  business_name text not null,
  country text not null,
  city text not null,
  address text not null,
  phone text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rg_agro_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  product_name text not null,
  description text, photo_url text,
  category text not null,
  unit text not null default 'kg',
  price numeric(14,2) not null check (price >= 0),
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  availability text not null default 'available' check (availability in ('available','limited','unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rg_agro_products_owner_idx on public.rg_agro_products(owner_id);
create index if not exists rg_agro_products_category_idx on public.rg_agro_products(category);

create table if not exists public.rg_agro_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  supplier_id uuid not null references public.rg_agro_profiles(user_id) on delete cascade,
  product_id uuid not null references public.rg_agro_products(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rg_agro_not_self_request check (restaurant_id <> supplier_id)
);
create index if not exists rg_agro_requests_restaurant_idx on public.rg_agro_requests(restaurant_id,created_at desc);
create index if not exists rg_agro_requests_supplier_idx on public.rg_agro_requests(supplier_id,created_at desc);

alter table public.rg_agro_profiles enable row level security;
alter table public.rg_agro_products enable row level security;
alter table public.rg_agro_requests enable row level security;

drop policy if exists agro_profiles_read on public.rg_agro_profiles;
create policy agro_profiles_read on public.rg_agro_profiles for select to authenticated using (true);
drop policy if exists agro_profiles_insert on public.rg_agro_profiles;
create policy agro_profiles_insert on public.rg_agro_profiles for insert to authenticated with check (user_id = auth.uid() and role = (auth.jwt()->'user_metadata'->>'account_type'));
drop policy if exists agro_profiles_update on public.rg_agro_profiles;
create policy agro_profiles_update on public.rg_agro_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and role = (auth.jwt()->'user_metadata'->>'account_type'));

drop policy if exists agro_products_read on public.rg_agro_products;
create policy agro_products_read on public.rg_agro_products for select to anon, authenticated using (availability <> 'unavailable');
drop policy if exists agro_products_insert on public.rg_agro_products;
create policy agro_products_insert on public.rg_agro_products for insert to authenticated with check (owner_id = auth.uid() and exists(select 1 from public.rg_agro_profiles p where p.user_id=auth.uid() and p.role in ('agro_producer','agro_trader')));
drop policy if exists agro_products_update on public.rg_agro_products;
create policy agro_products_update on public.rg_agro_products for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists agro_products_delete on public.rg_agro_products;
create policy agro_products_delete on public.rg_agro_products for delete to authenticated using (owner_id = auth.uid());

drop policy if exists agro_requests_read on public.rg_agro_requests;
create policy agro_requests_read on public.rg_agro_requests for select to authenticated using (restaurant_id = auth.uid() or supplier_id = auth.uid());
drop policy if exists agro_requests_insert on public.rg_agro_requests;
create policy agro_requests_insert on public.rg_agro_requests for insert to authenticated with check (
  restaurant_id = auth.uid()
  and exists(select 1 from public.rg_agro_profiles r where r.user_id=auth.uid() and r.role='restaurant')
  and exists(select 1 from public.rg_agro_products p where p.id=product_id and p.owner_id=supplier_id and p.availability in ('available','limited'))
);
drop policy if exists agro_requests_update on public.rg_agro_requests;
create policy agro_requests_update on public.rg_agro_requests for update to authenticated using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

grant select,insert,update on public.rg_agro_profiles to authenticated;
grant select on public.rg_agro_profiles to anon;
grant select on public.rg_agro_products to anon;
grant select,insert,update,delete on public.rg_agro_products to authenticated;
grant select,insert,update on public.rg_agro_requests to authenticated;
-- Activer les mises à jour en direct si la publication Realtime existe.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rg_agro_products') then
      execute 'alter publication supabase_realtime add table public.rg_agro_products';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rg_agro_requests') then
      execute 'alter publication supabase_realtime add table public.rg_agro_requests';
    end if;
  end if;
end $$;
notify pgrst, 'reload schema';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('zumuya-agro-products','zumuya-agro-products',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists agro_product_images_public_read on storage.objects;
create policy agro_product_images_public_read on storage.objects for select to anon,authenticated using (bucket_id='zumuya-agro-products');
drop policy if exists agro_product_images_owner_insert on storage.objects;
create policy agro_product_images_owner_insert on storage.objects for insert to authenticated with check (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists agro_product_images_owner_update on storage.objects;
create policy agro_product_images_owner_update on storage.objects for update to authenticated using (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists agro_product_images_owner_delete on storage.objects;
create policy agro_product_images_owner_delete on storage.objects for delete to authenticated using (bucket_id='zumuya-agro-products' and (storage.foldername(name))[1]=auth.uid()::text);
