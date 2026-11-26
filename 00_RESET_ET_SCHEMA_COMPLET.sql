-- ============================================================================
-- ZUMUYA GROUP — SCRIPT MAÎTRE SUPABASE
-- Réinitialisation + schéma complet organisé
-- ============================================================================
-- À exécuter dans Supabase > SQL Editor (projet de config.js)
--
-- MODE D'EMPLOI :
-- 1. Lisez toute la section 0 (RÉINITIALISATION) avant d'exécuter.
-- 2. Pour un projet NEUF : sautez la section 0, exécutez à partir de la section 1.
-- 3. Pour RÉINITIALISER un projet existant : décommentez la section 0, exécutez
--    TOUT le fichier d'un coup (ou section par section).
-- 4. Après exécution : créez un compte sur compte.html, puis exécutez le bloc
--    « DEVENEZ PROPRIÉTAIRE » en bas avec votre e-mail.
--
-- ATTENTION : la section 0 SUPPRIME les tables métier ZUMUYA (données perdues).
--             Les utilisateurs auth.users ne sont PAS supprimés.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. RÉINITIALISATION (OPTIONNELLE — décommenter pour tout nettoyer)
-- ============================================================================
/*
DO $$
DECLARE
  r record;
BEGIN
  -- Arrêter le job cron de dispatch s'il existe
  BEGIN
    DELETE FROM cron.job WHERE jobname = 'rg-dispatch';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Supprimer les politiques de toutes les tables public qui commencent par rg_
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename LIKE 'rg_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  -- Supprimer les triggers liés
  DROP TRIGGER IF EXISTS rg_on_auth_user_created ON auth.users;
  DROP TRIGGER IF EXISTS rg_customer_profile_sync ON auth.users;
  DROP TRIGGER IF EXISTS rg_orders_guard_trg ON public.rg_orders;
  DROP TRIGGER IF EXISTS rg_orders_dispatch ON public.rg_orders;
  DROP TRIGGER IF EXISTS rg_partner_review ON public.rg_partner_applications;
  DROP TRIGGER IF EXISTS rg_agro_group_leader_trg ON public.rg_agro_groups;

  -- Vues
  DROP VIEW IF EXISTS public.rg_room_folios CASCADE;

  -- Tables (ordre inverse des dépendances)
  DROP TABLE IF EXISTS public.rg_agro_group_order_members CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_group_orders CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_group_messages CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_group_offers CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_group_members CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_groups CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_requests CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_products CASCADE;
  DROP TABLE IF EXISTS public.rg_agro_profiles CASCADE;
  DROP TABLE IF EXISTS public.rg_customer_favorites CASCADE;
  DROP TABLE IF EXISTS public.rg_customer_addresses CASCADE;
  DROP TABLE IF EXISTS public.rg_customer_profiles CASCADE;
  DROP TABLE IF EXISTS public.rg_partner_applications CASCADE;
  DROP TABLE IF EXISTS public.rg_payment_transactions CASCADE;
  DROP TABLE IF EXISTS public.rg_service_records CASCADE;
  DROP TABLE IF EXISTS public.rg_establishments CASCADE;
  DROP TABLE IF EXISTS public.rg_organizations CASCADE;
  DROP TABLE IF EXISTS public.rg_profiles CASCADE;
  DROP TABLE IF EXISTS public.rg_platform_owners CASCADE;
  DROP TABLE IF EXISTS public.rg_countries CASCADE;
  DROP TABLE IF EXISTS public.rg_chats CASCADE;
  DROP TABLE IF EXISTS public.rg_orders CASCADE;
  DROP TABLE IF EXISTS public.rg_rests CASCADE;
  DROP TABLE IF EXISTS public.rg_users CASCADE;

  -- Fonctions
  DROP FUNCTION IF EXISTS public.rg_is_platform_owner() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_platform_set_country_enabled(text, boolean) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_handle_new_user() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_sync_customer_profile() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_status_rank(text) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_orders_guard() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_dist_km(double precision, double precision, double precision, double precision) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_now_ms() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_dispatch_order(text) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_dispatch_tick() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_orders_dispatch_trg() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_driver_accept(text, text) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_driver_refuse(text, text) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_partner_review_stamp() CASCADE;
  DROP FUNCTION IF EXISTS public.rg_agro_is_group_member(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.rg_agro_add_group_leader() CASCADE;
END $$;
*/

-- ============================================================================
-- 1. PORTAIL — Pays, propriétaires, profils, organisations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rg_countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rg_countries (code, name, enabled) VALUES
  ('NE', 'Niger', true),
  ('BF', 'Burkina Faso', false),
  ('ML', 'Mali', false),
  ('BJ', 'Bénin', false),
  ('TG', 'Togo', false),
  ('CI', 'Côte d''Ivoire', false),
  ('SN', 'Sénégal', false),
  ('GH', 'Ghana', false),
  ('NG', 'Nigeria', false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rg_platform_owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rg_is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rg_platform_owners WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_platform_set_country_enabled(p_code text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.rg_is_platform_owner() THEN
    RAISE EXCEPTION 'Accès réservé au propriétaire de la plateforme.';
  END IF;
  UPDATE public.rg_countries SET enabled = p_enabled WHERE code = p_code;
END;
$$;

CREATE TABLE IF NOT EXISTS public.rg_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rg_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rg_profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      NEW.phone,
      'Utilisateur'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rg_on_auth_user_created ON auth.users;
CREATE TRIGGER rg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rg_handle_new_user();

-- Comptes déjà existants
INSERT INTO public.rg_profiles (user_id, display_name)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'name',
    NULLIF(split_part(COALESCE(email, ''), '@', 1), ''),
    phone,
    'Utilisateur'
  )
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rg_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text,
  public_name text NOT NULL,
  country_code text REFERENCES public.rg_countries(code),
  organization_type text,
  city text,
  address text,
  contact_phone text,
  latitude double precision,
  longitude double precision,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status text NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.rg_organizations(id) ON DELETE CASCADE,
  name text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.rg_organizations(id) ON DELETE CASCADE,
  module_code text,
  record_type text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.rg_organizations(id) ON DELETE SET NULL,
  module_code text,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'XOF',
  provider text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  country_code text REFERENCES public.rg_countries(code),
  city text,
  organization_name text NOT NULL,
  contact_phone text,
  contact_email text,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rg_partner_apps_active_uq
  ON public.rg_partner_applications (user_id, category)
  WHERE status IN ('pending', 'approved');

CREATE OR REPLACE FUNCTION public.rg_partner_review_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rg_partner_review ON public.rg_partner_applications;
CREATE TRIGGER rg_partner_review
  BEFORE UPDATE ON public.rg_partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.rg_partner_review_stamp();

-- ============================================================================
-- 2. CLIENT — Profils, adresses, favoris
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rg_customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  country_code text DEFAULT '+227',
  avatar_url text,
  preferred_language text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rg_sync_customer_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'customer' THEN
    INSERT INTO public.rg_customer_profiles (user_id, full_name, phone, country_code)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'name',
      NEW.phone,
      COALESCE(NEW.raw_user_meta_data->>'country_code', '+227')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      country_code = EXCLUDED.country_code,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rg_customer_profile_sync ON auth.users;
CREATE TRIGGER rg_customer_profile_sync
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rg_sync_customer_profile();

CREATE TABLE IF NOT EXISTS public.rg_customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Maison',
  recipient_name text,
  phone text,
  country text NOT NULL DEFAULT 'Niger',
  city text NOT NULL,
  district text,
  address_details text,
  latitude double precision,
  longitude double precision,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rg_customer_addresses_user_idx
  ON public.rg_customer_addresses (user_id);

CREATE TABLE IF NOT EXISTS public.rg_customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('restaurant', 'agro_product')),
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

-- ============================================================================
-- 3. AGRO — Profils, produits, demandes, coopération
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rg_agro_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('restaurant', 'agro_producer', 'agro_trader')),
  business_name text NOT NULL,
  country text NOT NULL DEFAULT 'Niger',
  city text NOT NULL,
  address text,
  phone text,
  contact_email text,
  whatsapp_phone text,
  description text,
  logo_url text,
  lat double precision,
  lng double precision,
  service_radius_km numeric(8, 2) NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_agro_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.rg_agro_profiles(user_id) ON DELETE CASCADE,
  product_name text NOT NULL,
  description text,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  price numeric(14, 2) NOT NULL DEFAULT 0,
  quantity numeric(14, 2) NOT NULL DEFAULT 0,
  availability text NOT NULL DEFAULT 'available'
    CHECK (availability IN ('available', 'limited', 'unavailable')),
  photo_url text,
  currency_code text NOT NULL DEFAULT 'XOF',
  minimum_order numeric(14, 2) NOT NULL DEFAULT 1,
  origin_city text,
  harvest_date date,
  quality_grade text,
  delivery_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rg_agro_products_owner_idx ON public.rg_agro_products (owner_id);
CREATE INDEX IF NOT EXISTS rg_agro_products_category_idx ON public.rg_agro_products (category);
CREATE INDEX IF NOT EXISTS rg_agro_products_availability_idx ON public.rg_agro_products (availability);

CREATE TABLE IF NOT EXISTS public.rg_agro_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.rg_agro_products(id) ON DELETE SET NULL,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity numeric(14, 2),
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rg_agro_requests_from_idx ON public.rg_agro_requests (from_user_id);
CREATE INDEX IF NOT EXISTS rg_agro_requests_to_idx ON public.rg_agro_requests (to_user_id);

-- Groupes de coopération
CREATE TABLE IF NOT EXISTS public.rg_agro_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  group_type text NOT NULL DEFAULT 'cooperative'
    CHECK (group_type IN ('cooperative', 'joint_purchase', 'joint_delivery', 'market_group')),
  city text,
  country text DEFAULT 'Niger',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_agro_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.rg_agro_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('leader', 'producer', 'trader', 'transporter', 'member')),
  membership_status text NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('pending', 'active', 'blocked')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS rg_agro_group_members_user_idx ON public.rg_agro_group_members (user_id);

CREATE OR REPLACE FUNCTION public.rg_agro_is_group_member(p_group uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rg_agro_group_members m
    WHERE m.group_id = p_group
      AND m.user_id = auth.uid()
      AND m.membership_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_agro_add_group_leader()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rg_agro_group_members (group_id, user_id, member_role, membership_status)
  VALUES (NEW.id, NEW.created_by, 'leader', 'active')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rg_agro_group_leader_trg ON public.rg_agro_groups;
CREATE TRIGGER rg_agro_group_leader_trg
  AFTER INSERT ON public.rg_agro_groups
  FOR EACH ROW EXECUTE FUNCTION public.rg_agro_add_group_leader();

CREATE TABLE IF NOT EXISTS public.rg_agro_group_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.rg_agro_groups(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.rg_agro_products(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  product_name text NOT NULL,
  quantity numeric(14, 2),
  unit text DEFAULT 'kg',
  unit_price numeric(14, 2),
  notes text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_agro_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.rg_agro_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_agro_group_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.rg_agro_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'fulfilled', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rg_agro_group_order_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_order_id uuid NOT NULL REFERENCES public.rg_agro_group_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity numeric(14, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_order_id, user_id)
);

-- ============================================================================
-- 4. RESTAURATION / HÔTEL / LIVRAISON (tables JSONB de coordination)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rg_users (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS public.rg_rests (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS public.rg_orders (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS public.rg_chats (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY
);

CREATE INDEX IF NOT EXISTS rg_users_seq_idx ON public.rg_users (seq);
CREATE INDEX IF NOT EXISTS rg_rests_seq_idx ON public.rg_rests (seq);
CREATE INDEX IF NOT EXISTS rg_orders_seq_idx ON public.rg_orders (seq);
CREATE INDEX IF NOT EXISTS rg_chats_seq_idx ON public.rg_chats (seq);
CREATE INDEX IF NOT EXISTS rg_orders_rest_idx ON public.rg_orders ((data->>'restId'));
CREATE INDEX IF NOT EXISTS rg_orders_client_idx ON public.rg_orders ((data->>'clientId'));
CREATE INDEX IF NOT EXISTS rg_orders_driver_idx ON public.rg_orders ((data->>'driverId'));
CREATE INDEX IF NOT EXISTS rg_orders_status_idx ON public.rg_orders ((data->>'status'));

-- Intégrité des statuts (pas de retour en arrière)
CREATE OR REPLACE FUNCTION public.rg_status_rank(s text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE s
    WHEN 'en attente' THEN 0
    WHEN 'acceptée' THEN 1
    WHEN 'préparée' THEN 2
    WHEN 'en route' THEN 3
    WHEN 'terminée' THEN 4
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.rg_orders_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  k text;
  ro int;
  rn int;
BEGIN
  IF left(NEW.id, 7) = '__chat_' THEN
    RETURN NEW;
  END IF;
  NEW.data := OLD.data || NEW.data;
  FOREACH k IN ARRAY ARRAY['driverId', 'driverPos', 'settled'] LOOP
    IF OLD.data->k IS NOT NULL AND OLD.data->k <> 'null'::jsonb
       AND (NEW.data->k IS NULL OR NEW.data->k = 'null'::jsonb) THEN
      NEW.data := jsonb_set(NEW.data, ARRAY[k], OLD.data->k);
    END IF;
  END LOOP;
  ro := public.rg_status_rank(OLD.data->>'status');
  rn := public.rg_status_rank(NEW.data->>'status');
  IF ro IS NOT NULL AND rn IS NOT NULL AND rn < ro THEN
    NEW.data := jsonb_set(NEW.data, '{status}', OLD.data->'status');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rg_orders_guard_trg ON public.rg_orders;
CREATE TRIGGER rg_orders_guard_trg
  BEFORE UPDATE ON public.rg_orders
  FOR EACH ROW EXECUTE FUNCTION public.rg_orders_guard();

-- Dispatch livreur côté serveur
CREATE OR REPLACE FUNCTION public.rg_dist_km(
  a1 double precision, o1 double precision,
  a2 double precision, o2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371 * asin(
    sqrt(
      sin(radians(a2 - a1) / 2)^2
      + cos(radians(a1)) * cos(radians(a2)) * sin(radians(o2 - o1) / 2)^2
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_now_ms()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
$$;

CREATE OR REPLACE FUNCTION public.rg_dispatch_order(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb;
  r jsonb;
  best text;
  tried jsonb;
BEGIN
  SELECT data INTO o FROM rg_orders WHERE id = p_id FOR UPDATE;
  IF o IS NULL THEN RETURN; END IF;
  IF o->>'status' NOT IN ('acceptée', 'préparée')
     OR COALESCE(o->>'driverId', '') <> ''
     OR COALESCE(o->>'deliveryMode', '') = 'room'
     OR COALESCE(o->>'serviceType', '') = 'À emporter' THEN
    RETURN;
  END IF;
  IF o->'offer' IS NOT NULL AND o->'offer' <> 'null'::jsonb
     AND COALESCE((o->'offer'->>'expires')::bigint, 0) > rg_now_ms() THEN
    RETURN;
  END IF;
  SELECT data INTO r FROM rg_rests WHERE id = o->>'restId';
  IF r IS NULL THEN RETURN; END IF;
  tried := COALESCE(o->'offerTried', '[]'::jsonb);
  SELECT u.data->>'id' INTO best
  FROM rg_users u
  WHERE u.data->>'role' = 'driver'
    AND COALESCE(u.data->>'disabled', 'false') <> 'true'
    AND COALESCE(u.data->>'inactive', 'false') <> 'true'
    AND NOT jsonb_exists(tried, u.data->>'id')
    AND NOT EXISTS (
      SELECT 1 FROM rg_orders x
      WHERE x.data->>'driverId' = u.data->>'id'
        AND COALESCE(x.data->>'status', '') NOT IN ('terminée', 'annulée', 'refusée')
    )
  ORDER BY CASE
    WHEN u.data->>'lat' IS NOT NULL AND r->>'lat' IS NOT NULL THEN
      rg_dist_km(
        (u.data->>'lat')::double precision, (u.data->>'lng')::double precision,
        (r->>'lat')::double precision, (r->>'lng')::double precision
      )
    ELSE 9999
  END
  LIMIT 1;
  IF best IS NULL THEN
    IF (o->'offer' IS NOT NULL AND o->'offer' <> 'null'::jsonb)
       OR jsonb_array_length(tried) > 0 THEN
      UPDATE rg_orders
      SET data = data || jsonb_build_object('offer', null, 'offerTried', '[]'::jsonb)
      WHERE id = p_id;
    END IF;
    RETURN;
  END IF;
  UPDATE rg_orders
  SET data = data || jsonb_build_object(
    'offer', jsonb_build_object('driverId', best, 'expires', rg_now_ms() + 90000),
    'offerTried', tried || to_jsonb(best)
  )
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_dispatch_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM rg_orders
    WHERE data->>'status' IN ('acceptée', 'préparée')
      AND COALESCE(data->>'driverId', '') = ''
      AND COALESCE(data->>'deliveryMode', '') <> 'room'
      AND COALESCE(data->>'serviceType', '') <> 'À emporter'
  LOOP
    PERFORM rg_dispatch_order(r.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_orders_dispatch_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  PERFORM public.rg_dispatch_order(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rg_orders_dispatch ON public.rg_orders;
CREATE TRIGGER rg_orders_dispatch
  AFTER INSERT OR UPDATE ON public.rg_orders
  FOR EACH ROW
  WHEN (
    NEW.data->>'status' IN ('acceptée', 'préparée')
    AND COALESCE(NEW.data->>'driverId', '') = ''
  )
  EXECUTE FUNCTION public.rg_orders_dispatch_trg();

CREATE OR REPLACE FUNCTION public.rg_driver_accept(p_order text, p_driver text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb;
BEGIN
  SELECT data INTO o FROM rg_orders WHERE id = p_order FOR UPDATE;
  IF o IS NULL
     OR COALESCE(o->>'driverId', '') <> ''
     OR (o->'offer'->>'driverId') IS DISTINCT FROM p_driver THEN
    RETURN false;
  END IF;
  UPDATE rg_orders
  SET data = data || jsonb_build_object('driverId', p_driver, 'offer', null)
  WHERE id = p_order;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_driver_refuse(p_order text, p_driver text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb;
BEGIN
  SELECT data INTO o FROM rg_orders WHERE id = p_order FOR UPDATE;
  IF o IS NULL OR (o->'offer'->>'driverId') IS DISTINCT FROM p_driver THEN
    RETURN;
  END IF;
  UPDATE rg_orders
  SET data = data || jsonb_build_object(
    'offer', jsonb_build_object('driverId', p_driver, 'expires', 0)
  )
  WHERE id = p_order;
  PERFORM rg_dispatch_order(p_order);
END;
$$;

-- Vue notes de chambre (hôtel)
CREATE OR REPLACE VIEW public.rg_room_folios
WITH (security_invoker = true)
AS
SELECT
  o.data->>'restId' AS rest_id,
  COALESCE(o.data->>'buildingNumber', '?') AS building,
  COALESCE(o.data->>'roomNumber', '?') AS room,
  count(*) AS nb_orders,
  sum(COALESCE((o.data->>'total')::numeric, 0)) AS total
FROM public.rg_orders o
WHERE o.data->>'deliveryMode' = 'room'
  AND COALESCE(o.data->>'status', '') NOT IN ('annulée', 'refusée')
  AND o.data->>'settled' IS NULL
GROUP BY 1, 2, 3;

-- Cron dispatch (toutes les 15 s) — nécessite l'extension pg_cron
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  DELETE FROM cron.job WHERE jobname = 'rg-dispatch';
  PERFORM cron.schedule('rg-dispatch', '15 seconds', 'SELECT public.rg_dispatch_tick()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponible (%) : activez-le dans Database > Extensions puis relancez la section cron.', SQLERRM;
END $$;

-- ============================================================================
-- 5. RLS (Row Level Security) + grants
-- ============================================================================

-- Portail
ALTER TABLE public.rg_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_platform_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_partner_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS countries_read ON public.rg_countries;
CREATE POLICY countries_read ON public.rg_countries
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS profiles_read ON public.rg_profiles;
CREATE POLICY profiles_read ON public.rg_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.rg_is_platform_owner());

DROP POLICY IF EXISTS profiles_upd ON public.rg_profiles;
CREATE POLICY profiles_upd ON public.rg_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orgs_read ON public.rg_organizations;
CREATE POLICY orgs_read ON public.rg_organizations
  FOR SELECT TO anon, authenticated
  USING (
    verification_status = 'verified'
    OR owner_id = auth.uid()
    OR public.rg_is_platform_owner()
  );

DROP POLICY IF EXISTS orgs_ins ON public.rg_organizations;
CREATE POLICY orgs_ins ON public.rg_organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND verification_status = 'verified');

DROP POLICY IF EXISTS orgs_upd ON public.rg_organizations;
CREATE POLICY orgs_upd ON public.rg_organizations
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.rg_is_platform_owner())
  WITH CHECK (owner_id = auth.uid() OR public.rg_is_platform_owner());

DROP POLICY IF EXISTS ests_read ON public.rg_establishments;
CREATE POLICY ests_read ON public.rg_establishments
  FOR SELECT TO authenticated
  USING (
    public.rg_is_platform_owner()
    OR EXISTS (
      SELECT 1 FROM public.rg_organizations o
      WHERE o.id = organization_id AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS records_read ON public.rg_service_records;
CREATE POLICY records_read ON public.rg_service_records
  FOR SELECT TO authenticated
  USING (
    public.rg_is_platform_owner()
    OR EXISTS (
      SELECT 1 FROM public.rg_organizations o
      WHERE o.id = organization_id AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pay_read ON public.rg_payment_transactions;
CREATE POLICY pay_read ON public.rg_payment_transactions
  FOR SELECT TO authenticated
  USING (
    public.rg_is_platform_owner()
    OR EXISTS (
      SELECT 1 FROM public.rg_organizations o
      WHERE o.id = organization_id AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS apps_read ON public.rg_partner_applications;
CREATE POLICY apps_read ON public.rg_partner_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.rg_is_platform_owner());

DROP POLICY IF EXISTS apps_ins ON public.rg_partner_applications;
CREATE POLICY apps_ins ON public.rg_partner_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS apps_upd ON public.rg_partner_applications;
CREATE POLICY apps_upd ON public.rg_partner_applications
  FOR UPDATE TO authenticated
  USING (public.rg_is_platform_owner())
  WITH CHECK (public.rg_is_platform_owner());

-- Client
ALTER TABLE public.rg_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_customer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_profile_self ON public.rg_customer_profiles;
CREATE POLICY customer_profile_self ON public.rg_customer_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS customer_addresses_self ON public.rg_customer_addresses;
CREATE POLICY customer_addresses_self ON public.rg_customer_addresses
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS customer_favorites_self ON public.rg_customer_favorites;
CREATE POLICY customer_favorites_self ON public.rg_customer_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Agro
ALTER TABLE public.rg_agro_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_group_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_group_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rg_agro_group_order_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agro_profiles_read ON public.rg_agro_profiles;
CREATE POLICY agro_profiles_read ON public.rg_agro_profiles
  FOR SELECT TO authenticated
  USING (is_active = true OR user_id = auth.uid() OR public.rg_is_platform_owner());

DROP POLICY IF EXISTS agro_profiles_write ON public.rg_agro_profiles;
CREATE POLICY agro_profiles_write ON public.rg_agro_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS agro_products_read ON public.rg_agro_products;
CREATE POLICY agro_products_read ON public.rg_agro_products
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS agro_products_write ON public.rg_agro_products;
CREATE POLICY agro_products_write ON public.rg_agro_products
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS agro_requests_read ON public.rg_agro_requests;
CREATE POLICY agro_requests_read ON public.rg_agro_requests
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.rg_is_platform_owner());

DROP POLICY IF EXISTS agro_requests_ins ON public.rg_agro_requests;
CREATE POLICY agro_requests_ins ON public.rg_agro_requests
  FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS agro_requests_upd ON public.rg_agro_requests;
CREATE POLICY agro_requests_upd ON public.rg_agro_requests
  FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS agro_groups_read ON public.rg_agro_groups;
CREATE POLICY agro_groups_read ON public.rg_agro_groups
  FOR SELECT TO authenticated
  USING (is_open OR created_by = auth.uid() OR public.rg_agro_is_group_member(id));

DROP POLICY IF EXISTS agro_groups_insert ON public.rg_agro_groups;
CREATE POLICY agro_groups_insert ON public.rg_agro_groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS agro_groups_update ON public.rg_agro_groups;
CREATE POLICY agro_groups_update ON public.rg_agro_groups
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rg_agro_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid()
        AND m.member_role = 'leader' AND m.membership_status = 'active'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rg_agro_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid()
        AND m.member_role = 'leader' AND m.membership_status = 'active'
    )
  );

DROP POLICY IF EXISTS agro_group_members_read ON public.rg_agro_group_members;
CREATE POLICY agro_group_members_read ON public.rg_agro_group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.rg_agro_is_group_member(group_id));

DROP POLICY IF EXISTS agro_group_members_join ON public.rg_agro_group_members;
CREATE POLICY agro_group_members_join ON public.rg_agro_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND member_role IN ('producer', 'trader', 'transporter', 'member')
    AND membership_status = 'active'
    AND EXISTS (SELECT 1 FROM public.rg_agro_groups g WHERE g.id = group_id AND g.is_open)
  );

DROP POLICY IF EXISTS agro_group_offers_read ON public.rg_agro_group_offers;
CREATE POLICY agro_group_offers_read ON public.rg_agro_group_offers
  FOR SELECT TO authenticated
  USING (public.rg_agro_is_group_member(group_id));

DROP POLICY IF EXISTS agro_group_offers_insert ON public.rg_agro_group_offers;
CREATE POLICY agro_group_offers_insert ON public.rg_agro_group_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND public.rg_agro_is_group_member(group_id)
  );

DROP POLICY IF EXISTS agro_group_messages_all ON public.rg_agro_group_messages;
CREATE POLICY agro_group_messages_all ON public.rg_agro_group_messages
  FOR ALL TO authenticated
  USING (public.rg_agro_is_group_member(group_id))
  WITH CHECK (user_id = auth.uid() AND public.rg_agro_is_group_member(group_id));

DROP POLICY IF EXISTS agro_group_orders_all ON public.rg_agro_group_orders;
CREATE POLICY agro_group_orders_all ON public.rg_agro_group_orders
  FOR ALL TO authenticated
  USING (public.rg_agro_is_group_member(group_id))
  WITH CHECK (created_by = auth.uid() AND public.rg_agro_is_group_member(group_id));

DROP POLICY IF EXISTS agro_group_order_members_all ON public.rg_agro_group_order_members;
CREATE POLICY agro_group_order_members_all ON public.rg_agro_group_order_members
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rg_agro_group_orders go
      WHERE go.id = group_order_id AND public.rg_agro_is_group_member(go.group_id)
    )
  )
  WITH CHECK (user_id = auth.uid());

-- Service restauration (JSONB) — policies permissives pour compatibilité front actuel
-- À restreindre progressivement (auth.uid() dans data->>'clientId' / owner, etc.)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rg_users', 'rg_rests', 'rg_orders', 'rg_chats'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      t || '_all', t
    );
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Grants
GRANT SELECT ON public.rg_countries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.rg_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rg_organizations TO authenticated;
GRANT SELECT ON public.rg_establishments, public.rg_service_records, public.rg_payment_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rg_partner_applications TO authenticated;
GRANT EXECUTE ON FUNCTION public.rg_is_platform_owner() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rg_platform_set_country_enabled(text, boolean) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.rg_customer_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rg_customer_addresses TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.rg_customer_favorites TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.rg_agro_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rg_agro_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rg_agro_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rg_agro_groups TO authenticated;
GRANT SELECT, INSERT ON public.rg_agro_group_members TO authenticated;
GRANT SELECT, INSERT ON public.rg_agro_group_offers TO authenticated;
GRANT SELECT, INSERT ON public.rg_agro_group_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rg_agro_group_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rg_agro_group_order_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.rg_agro_is_group_member(uuid) TO authenticated;

GRANT SELECT ON public.rg_room_folios TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rg_users, public.rg_rests, public.rg_orders, public.rg_chats TO anon, authenticated;

REVOKE ALL ON FUNCTION public.rg_dispatch_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rg_driver_accept(text, text), public.rg_driver_refuse(text, text) FROM PUBLIC, anon, authenticated;
-- Les appels accept/refuse se font via security definer ; exposer si le front les appelle directement :
GRANT EXECUTE ON FUNCTION public.rg_driver_accept(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rg_driver_refuse(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 6. DEVENEZ PROPRIÉTAIRE (à exécuter APRÈS création du compte)
-- ============================================================================
-- 1) Créez d'abord votre compte sur compte.html et confirmez l'e-mail.
-- 2) Dans le SQL Editor, exécutez le bloc ci-dessous en remplaçant
--    l'adresse par la vôtre (ne committez PAS votre e-mail dans Git).
--
-- INSERT INTO public.rg_platform_owners (user_id, email)
-- SELECT id, email FROM auth.users
-- WHERE lower(email) = lower('VOTRE-EMAIL@exemple.com')
-- ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
--
-- ============================================================================
-- Fin du script maître ZUMUYA GROUP
-- ============================================================================
