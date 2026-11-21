-- ZUMAYA GROUP : boutique vendeur complète (médias, activation auto, statistiques). Relançable.

-- 1) Colonnes
ALTER TABLE public.commerce_products
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.commerce_stores
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 2) Bucket public + règles de stockage (dossier = UID du vendeur)
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('commerce-media','commerce-media',true,52428800,
 ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=52428800,
 allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "commerce media upload own folder" ON storage.objects;
CREATE POLICY "commerce media upload own folder" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='commerce-media' AND (storage.foldername(name))[1]=(select auth.uid())::text);
DROP POLICY IF EXISTS "commerce media owner update" ON storage.objects;
CREATE POLICY "commerce media owner update" ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id='commerce-media' AND (storage.foldername(name))[1]=(select auth.uid())::text)
 WITH CHECK (bucket_id='commerce-media' AND (storage.foldername(name))[1]=(select auth.uid())::text);
DROP POLICY IF EXISTS "commerce media owner delete" ON storage.objects;
CREATE POLICY "commerce media owner delete" ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id='commerce-media' AND (storage.foldername(name))[1]=(select auth.uid())::text);
DROP POLICY IF EXISTS "commerce media public read" ON storage.objects;
CREATE POLICY "commerce media public read" ON storage.objects FOR SELECT TO anon,authenticated
 USING (bucket_id='commerce-media');

-- 3) Activation automatique des boutiques (création = vérifiée)
CREATE OR REPLACE FUNCTION private.commerce_stores_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
begin
  if auth.uid() is not null and not public.rg_is_platform_owner() then
    if tg_op='UPDATE' then
      if new.owner_id<>old.owner_id then raise exception 'Propriétaire non modifiable'; end if;
      if new.verification_status<>old.verification_status then raise exception 'Seule la plateforme vérifie une boutique'; end if;
    else new.verification_status:='verified'; end if;
  end if;
  return new;
end $f$;

DROP POLICY IF EXISTS store_insert ON public.commerce_stores;
CREATE POLICY store_insert ON public.commerce_stores FOR INSERT TO authenticated
 WITH CHECK (owner_id=(select auth.uid()));

UPDATE public.commerce_stores SET verification_status='verified', is_active=true
 WHERE verification_status='pending';

-- 4) Suivi des vues produit
CREATE TABLE IF NOT EXISTS public.commerce_product_views(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.commerce_stores(id) ON DELETE CASCADE,
  viewer_id uuid,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS cpv_store_idx ON public.commerce_product_views(store_id,created_at);
CREATE INDEX IF NOT EXISTS cpv_product_idx ON public.commerce_product_views(product_id,created_at);
ALTER TABLE public.commerce_product_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_product_views FROM anon,authenticated;
GRANT SELECT ON public.commerce_product_views TO authenticated;
DROP POLICY IF EXISTS cpv_owner_read ON public.commerce_product_views;
CREATE POLICY cpv_owner_read ON public.commerce_product_views FOR SELECT TO authenticated
 USING (private.commerce_owns_store(store_id) OR (select public.rg_is_platform_owner()));

CREATE OR REPLACE FUNCTION public.commerce_track_view(p_product uuid, p_session text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
declare sid uuid; uid uuid:=auth.uid(); k text:=left(coalesce(p_session,''),64);
begin
  select p.store_id into sid from public.commerce_products p
   where p.id=p_product and p.status='active' and private.commerce_store_public(p.store_id);
  if sid is null then return; end if;
  if uid is not null and private.commerce_owns_store(sid) then return; end if;
  if k<>'' and exists(select 1 from public.commerce_product_views v
      where v.product_id=p_product and v.session_key=k and v.created_at>now()-interval '30 minutes') then return; end if;
  insert into public.commerce_product_views(product_id,store_id,viewer_id,session_key) values(p_product,sid,uid,nullif(k,''));
end $f$;
REVOKE ALL ON FUNCTION public.commerce_track_view(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commerce_track_view(uuid,text) TO anon,authenticated;

-- 5) Statistiques vendeur (période, boutique, produit optionnel)
CREATE OR REPLACE FUNCTION public.commerce_store_stats(p_store uuid, p_days int DEFAULT 30, p_product uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
declare
  d int:=greatest(1,least(coalesce(p_days,30),365));
  s0 timestamptz:=date_trunc('day',now())-((d-1)*interval '1 day');
  pv0 timestamptz:=s0-(d*interval '1 day');
  res jsonb;
begin
  if not (private.commerce_owns_store(p_store) or public.rg_is_platform_owner()) then
    raise exception 'Accès refusé';
  end if;
  with it as (
    select o.id oid,o.status,o.created_at,i.product_id,i.quantity q,i.unit_price*i.quantity amt
    from public.commerce_orders o join public.commerce_order_items i on i.order_id=o.id
    where o.store_id=p_store and (p_product is null or i.product_id=p_product)),
  vw as (
    select v.product_id,v.created_at from public.commerce_product_views v
    where v.store_id=p_store and (p_product is null or v.product_id=p_product)),
  cur as (select * from it where created_at>=s0 and status<>'cancelled'),
  prv as (select * from it where created_at>=pv0 and created_at<s0 and status<>'cancelled'),
  days as (select g::date dd from generate_series(s0,date_trunc('day',now()),interval '1 day') g),
  daily as (
    select jsonb_agg(jsonb_build_object('d',days.dd,
      'views',(select count(*) from vw where vw.created_at>=days.dd and vw.created_at<days.dd+1),
      'orders',(select count(distinct oid) from cur where cur.created_at>=days.dd and cur.created_at<days.dd+1),
      'revenue',(select coalesce(sum(amt),0) from cur where cur.created_at>=days.dd and cur.created_at<days.dd+1)) order by days.dd) a from days),
  vtot as (select count(*) n from vw where created_at>=s0),
  vprv as (select count(*) n from vw where created_at>=pv0 and created_at<s0),
  tops as (
    select jsonb_agg(jsonb_build_object('product_id',p.id,'title',p.title,'image',p.image_url,'status',p.status,
      'price',p.price,'stock',p.stock_quantity,
      'views',(select count(*) from public.commerce_product_views v where v.product_id=p.id and v.created_at>=s0),
      'units',(select coalesce(sum(q),0) from cur where cur.product_id=p.id),
      'revenue',(select coalesce(sum(amt),0) from cur where cur.product_id=p.id)) order by p.created_at desc) a
    from public.commerce_products p where p.store_id=p_store and (p_product is null or p.id=p_product)),
  sts as (
    select coalesce(jsonb_agg(jsonb_build_object('status',status,'count',c)),'[]'::jsonb) a
    from (select status,count(distinct oid) c from it where created_at>=s0 group by status) x)
  select jsonb_build_object(
    'days',d,
    'totals',jsonb_build_object(
      'revenue',(select coalesce(sum(amt),0) from cur),
      'orders',(select count(distinct oid) from cur),
      'units',(select coalesce(sum(q),0) from cur),
      'views',(select n from vtot),
      'pending',(select count(distinct oid) from it where status='pending'),
      'delivered_revenue',(select coalesce(sum(amt),0) from cur where status='delivered'),
      'products',(select count(*) from public.commerce_products where store_id=p_store),
      'active_products',(select count(*) from public.commerce_products where store_id=p_store and status='active'),
      'low_stock',(select count(*) from public.commerce_products where store_id=p_store and stock_quantity<=3)),
    'previous',jsonb_build_object(
      'revenue',(select coalesce(sum(amt),0) from prv),
      'orders',(select count(distinct oid) from prv),
      'views',(select n from vprv)),
    'daily',coalesce((select a from daily),'[]'::jsonb),
    'products',coalesce((select a from tops),'[]'::jsonb),
    'statuses',(select a from sts)) into res;
  return res;
end $f$;
REVOKE ALL ON FUNCTION public.commerce_store_stats(uuid,int,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commerce_store_stats(uuid,int,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
