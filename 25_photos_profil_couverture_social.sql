-- ZUMUYA GROUP — photos de profil et de couverture du réseau social
alter table public.zg_social_profiles
  add column if not exists avatar_url text,
  add column if not exists cover_url text;
alter table public.zg_social_profiles
  drop constraint if exists zg_social_avatar_url_check;
alter table public.zg_social_profiles
  add constraint zg_social_avatar_url_check
  check (avatar_url is null or (length(avatar_url)<=2000 and avatar_url ~* '^https?://'));
alter table public.zg_social_profiles
  drop constraint if exists zg_social_cover_url_check;
alter table public.zg_social_profiles
  add constraint zg_social_cover_url_check
  check (cover_url is null or (length(cover_url)<=2000 and cover_url ~* '^https?://'));
