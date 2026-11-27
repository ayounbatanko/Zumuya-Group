-- ZUMAYA GROUP — lecture publique limitée au fil public du réseau social.
-- Les interactions restent réservées aux comptes connectés.
drop policy if exists zg_social_profiles_public_read on public.zg_social_profiles;
create policy zg_social_profiles_public_read on public.zg_social_profiles for select to anon using (true);
drop policy if exists zg_social_posts_public_read on public.zg_social_posts;
create policy zg_social_posts_public_read on public.zg_social_posts for select to anon using (visibility = 'public');
grant select on public.zg_social_profiles, public.zg_social_posts to anon;
