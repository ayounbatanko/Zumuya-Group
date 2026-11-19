-- ZUMUYA GROUP — Compatibilité des profils Supabase Auth téléphone + e-mail
-- À exécuter dans Supabase > SQL Editor après le schéma principal.
-- Les clients ont un numéro de téléphone ; les comptes professionnels ont un e-mail.

create table if not exists public.rg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.rg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rg_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      nullif(new.phone, ''),
      'Utilisateur'
    )
  )
  on conflict (user_id) do update
    set display_name = coalesce(public.rg_profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists rg_on_auth_user_created on auth.users;
create trigger rg_on_auth_user_created
after insert on auth.users
for each row execute function public.rg_handle_new_user();

insert into public.rg_profiles (user_id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    nullif(u.phone, ''),
    'Utilisateur'
  )
from auth.users u
on conflict (user_id) do update
  set display_name = coalesce(public.rg_profiles.display_name, excluded.display_name);
