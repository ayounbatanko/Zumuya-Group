-- ZUMUYA GROUP — pôle Réseau social (à exécuter une seule fois dans Supabase SQL Editor)
create table if not exists public.zg_social_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Membre',
 bio text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.zg_social_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null default '',
 media_urls jsonb not null default '[]'::jsonb,
 visibility text not null default 'public' check (visibility in ('public','followers','private')),
 created_at timestamptz not null default now(),
 constraint zg_social_post_content check (length(trim(body))>0 or jsonb_array_length(media_urls)>0)
);
create table if not exists public.zg_social_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 followed_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 check(follower_id<>followed_id)
);
create table if not exists public.zg_social_likes (
 post_id uuid not null references public.zg_social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.zg_social_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.zg_social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists zg_social_posts_created_idx on public.zg_social_posts(created_at desc);
create index if not exists zg_social_posts_user_idx on public.zg_social_posts(user_id,created_at desc);
create index if not exists zg_social_comments_post_idx on public.zg_social_comments(post_id,created_at);
alter table public.zg_social_profiles enable row level security;
alter table public.zg_social_posts enable row level security;
alter table public.zg_social_follows enable row level security;
alter table public.zg_social_likes enable row level security;
alter table public.zg_social_comments enable row level security;
drop policy if exists zg_social_profiles_read on public.zg_social_profiles;
create policy zg_social_profiles_read on public.zg_social_profiles for select to authenticated using(true);
drop policy if exists zg_social_profiles_insert on public.zg_social_profiles;
create policy zg_social_profiles_insert on public.zg_social_profiles for insert to authenticated with check(user_id=auth.uid());
drop policy if exists zg_social_profiles_update on public.zg_social_profiles;
create policy zg_social_profiles_update on public.zg_social_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists zg_social_posts_read on public.zg_social_posts;
create policy zg_social_posts_read on public.zg_social_posts for select to authenticated using(
 user_id=auth.uid() or visibility='public' or
 (visibility='followers' and exists(select 1 from public.zg_social_follows f where f.follower_id=auth.uid() and f.followed_id=user_id))
);
drop policy if exists zg_social_posts_insert on public.zg_social_posts;
create policy zg_social_posts_insert on public.zg_social_posts for insert to authenticated with check(user_id=auth.uid());
drop policy if exists zg_social_posts_delete on public.zg_social_posts;
create policy zg_social_posts_delete on public.zg_social_posts for delete to authenticated using(user_id=auth.uid());
drop policy if exists zg_social_follows_read on public.zg_social_follows;
create policy zg_social_follows_read on public.zg_social_follows for select to authenticated using(true);
drop policy if exists zg_social_follows_insert on public.zg_social_follows;
create policy zg_social_follows_insert on public.zg_social_follows for insert to authenticated with check(follower_id=auth.uid());
drop policy if exists zg_social_follows_delete on public.zg_social_follows;
create policy zg_social_follows_delete on public.zg_social_follows for delete to authenticated using(follower_id=auth.uid());
drop policy if exists zg_social_likes_read on public.zg_social_likes;
create policy zg_social_likes_read on public.zg_social_likes for select to authenticated using(true);
drop policy if exists zg_social_likes_insert on public.zg_social_likes;
create policy zg_social_likes_insert on public.zg_social_likes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists zg_social_likes_delete on public.zg_social_likes;
create policy zg_social_likes_delete on public.zg_social_likes for delete to authenticated using(user_id=auth.uid());
drop policy if exists zg_social_comments_read on public.zg_social_comments;
create policy zg_social_comments_read on public.zg_social_comments for select to authenticated using(exists(select 1 from public.zg_social_posts p where p.id=post_id));
drop policy if exists zg_social_comments_insert on public.zg_social_comments;
create policy zg_social_comments_insert on public.zg_social_comments for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.zg_social_posts p where p.id=post_id));
drop policy if exists zg_social_comments_delete on public.zg_social_comments;
create policy zg_social_comments_delete on public.zg_social_comments for delete to authenticated using(user_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('zg-social-media','zg-social-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=true,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists zg_social_media_upload on storage.objects;
create policy zg_social_media_upload on storage.objects for insert to authenticated with check(bucket_id='zg-social-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists zg_social_media_delete on storage.objects;
create policy zg_social_media_delete on storage.objects for delete to authenticated using(bucket_id='zg-social-media' and (storage.foldername(name))[1]=auth.uid()::text);
