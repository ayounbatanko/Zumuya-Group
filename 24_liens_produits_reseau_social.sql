-- ZUMUYA GROUP — lien produit dans les publications sociales et contact vendeur
alter table public.zg_social_posts
  add column if not exists product_url text,
  add column if not exists product_title text;
alter table public.zg_social_posts
  drop constraint if exists zg_social_product_url_check;
alter table public.zg_social_posts
  add constraint zg_social_product_url_check
  check (product_url is null or (length(product_url)<=1000 and product_url ~* '^https?://'));
alter table public.zg_social_posts
  drop constraint if exists zg_social_product_title_check;
alter table public.zg_social_posts
  add constraint zg_social_product_title_check
  check (product_title is null or length(product_title)<=120);
