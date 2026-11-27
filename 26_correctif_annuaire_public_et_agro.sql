-- ZUMAYA : correctifs annuaire public et accès Agro.
-- Migration additive, aucune donnée métier supprimée.

create or replace function public.rg_public_partner_directory()
returns table(id uuid, organization_type text, public_name text, city text, address text, latitude double precision, longitude double precision)
language sql stable security invoker set search_path=public,pg_temp
as $$
  select o.id,o.organization_type,o.public_name,o.city,o.address,o.latitude,o.longitude
  from public.rg_organizations o
  where o.public_name is not null
    and o.organization_type in ('restaurant','hotel','agro','agro_trader','marketplace','delivery','delivery_service','logistics')
$$;
revoke all on function public.rg_public_partner_directory() from public;
grant execute on function public.rg_public_partner_directory() to anon,authenticated;

alter table public.rg_agro_profiles alter column is_active set default true;
update public.rg_agro_profiles set is_active=true where is_active is null;
alter table public.rg_agro_profiles alter column is_active set not null;

drop policy if exists agro_profiles_insert on public.rg_agro_profiles;
create policy agro_profiles_insert on public.rg_agro_profiles
for insert to authenticated
with check (user_id=(select auth.uid()) and role in ('restaurant','agro_producer','agro_trader'));
drop policy if exists agro_profiles_update on public.rg_agro_profiles;
create policy agro_profiles_update on public.rg_agro_profiles
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and role in ('restaurant','agro_producer','agro_trader'));

create or replace function public.rg_public_agro_profiles()
returns table(user_id uuid,business_name text,city text,role text,is_active boolean)
language sql stable security definer set search_path=public,pg_temp
as $$
 select p.user_id,p.business_name,p.city,p.role,p.is_active
 from public.rg_agro_profiles p where p.is_active=true
$$;
revoke all on function public.rg_public_agro_profiles() from public;
grant execute on function public.rg_public_agro_profiles() to anon,authenticated;


drop policy if exists orgs_public_partner_directory_read on public.rg_organizations;
create policy orgs_public_partner_directory_read on public.rg_organizations
for select to anon,authenticated
using (public_name is not null and organization_type in ('restaurant','hotel','agro','agro_trader','marketplace','delivery','delivery_service','logistics'));
revoke select on public.rg_organizations from anon;
grant select (id,organization_type,public_name,city,address,latitude,longitude) on public.rg_organizations to anon;
revoke select on public.rg_agro_profiles from anon;
grant select (user_id,business_name,city,role,is_active) on public.rg_agro_profiles to anon;

grant select on public.rg_agro_products to anon,authenticated;
notify pgrst,'reload schema';