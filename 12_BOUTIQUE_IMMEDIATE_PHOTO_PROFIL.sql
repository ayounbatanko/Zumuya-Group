-- =============================================================
-- ZUMAYA GROUP - Boutique immediate + photo de profil
-- Migration additive, compatible avec le portail rg_organizations.
-- À exécuter dans Supabase SQL Editor avant le déploiement GitHub.
-- =============================================================

-- 1) Profil : rôle protégé côté base et URL de la photo
ALTER TABLE public.rg_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'customer';

-- Synchroniser les comptes existants depuis leurs métadonnées initiales.
-- account_type reste non modifiable par les utilisateurs via l'API.
UPDATE public.rg_profiles p
SET account_type = CASE
  WHEN u.raw_user_meta_data->>'account_type' IN
    ('restaurant','hotel','delivery','agro_producer','agro_trader','commerce')
    THEN u.raw_user_meta_data->>'account_type'
  ELSE 'customer'
END
FROM auth.users u
WHERE u.id = p.user_id;

-- Mise à jour du trigger de création du profil.
CREATE OR REPLACE FUNCTION public.rg_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rg_profiles (user_id, display_name, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NULLIF(split_part(COALESCE(NEW.email,''),'@',1),''), NEW.phone, 'Utilisateur'),
    CASE WHEN NEW.raw_user_meta_data->>'account_type' IN
      ('restaurant','hotel','delivery','agro_producer','agro_trader','commerce')
      THEN NEW.raw_user_meta_data->>'account_type' ELSE 'customer' END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rg_on_auth_user_created ON auth.users;
CREATE TRIGGER rg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.rg_handle_new_user();

-- Les comptes ne peuvent changer que leur nom et leur photo, jamais leur rôle.
REVOKE UPDATE ON public.rg_profiles FROM authenticated;
GRANT SELECT ON public.rg_profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.rg_profiles TO authenticated;

-- 2) Boutiques : création immédiate, statut de vérification séparé.
-- Une boutique créée est utilisable par son propriétaire immédiatement.
DROP POLICY IF EXISTS orgs_ins ON public.rg_organizations;
CREATE POLICY orgs_ins ON public.rg_organizations
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid())
  AND ((organization_type = 'commerce' AND verification_status = 'pending')
    OR (organization_type <> 'commerce' AND verification_status = 'verified'))
);

-- Empêcher le propriétaire de s'auto-vérifier ou de suspendre/réactiver.
CREATE OR REPLACE FUNCTION public.rg_guard_organization_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_type = 'commerce' THEN
      NEW.verification_status := 'pending';
    END IF;
  ELSIF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       AND NOT public.rg_is_platform_owner() THEN
      RAISE EXCEPTION 'La vérification est réservée à l’administration ZUMAYA.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rg_organization_verification_guard ON public.rg_organizations;
CREATE TRIGGER rg_organization_verification_guard
BEFORE INSERT OR UPDATE ON public.rg_organizations
FOR EACH ROW EXECUTE FUNCTION public.rg_guard_organization_verification();

-- Synchroniser le type de compte depuis l'organisation réellement créée.
CREATE OR REPLACE FUNCTION public.rg_sync_profile_role_from_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_type text;
BEGIN
  v_type := CASE NEW.organization_type
    WHEN 'commerce' THEN 'commerce'
    WHEN 'restaurant' THEN 'restaurant'
    WHEN 'hotel' THEN 'hotel'
    WHEN 'delivery' THEN 'delivery'
    WHEN 'agro' THEN 'agro_producer'
    WHEN 'agro_trader' THEN 'agro_trader'
    ELSE NULL
  END;
  IF v_type IS NOT NULL THEN
    INSERT INTO public.rg_profiles(user_id, account_type)
    VALUES (NEW.owner_id, v_type)
    ON CONFLICT (user_id) DO UPDATE SET account_type = EXCLUDED.account_type;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rg_sync_profile_role_from_org ON public.rg_organizations;
CREATE TRIGGER rg_sync_profile_role_from_org
AFTER INSERT ON public.rg_organizations
FOR EACH ROW EXECUTE FUNCTION public.rg_sync_profile_role_from_organization();

-- 3) Catalogue simple du commerçant, attaché à son organisation.
CREATE TABLE IF NOT EXISTS public.rg_commerce_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.rg_organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  description text,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  currency_code text NOT NULL DEFAULT 'XOF',
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rg_commerce_products_org_idx
  ON public.rg_commerce_products(organization_id, created_at DESC);
ALTER TABLE public.rg_commerce_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rg_commerce_products_read ON public.rg_commerce_products;
CREATE POLICY rg_commerce_products_read ON public.rg_commerce_products
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rg_organizations o
    WHERE o.id = organization_id AND o.owner_id = (SELECT auth.uid())
  ) OR public.rg_is_platform_owner()
);
DROP POLICY IF EXISTS rg_commerce_products_insert ON public.rg_commerce_products;
CREATE POLICY rg_commerce_products_insert ON public.rg_commerce_products
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rg_organizations o
    WHERE o.id = organization_id
      AND o.owner_id = (SELECT auth.uid())
      AND o.organization_type = 'commerce'
  )
);
DROP POLICY IF EXISTS rg_commerce_products_update ON public.rg_commerce_products;
CREATE POLICY rg_commerce_products_update ON public.rg_commerce_products
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rg_organizations o
    WHERE o.id = organization_id AND o.owner_id = (SELECT auth.uid())
      AND o.organization_type = 'commerce')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rg_organizations o
    WHERE o.id = organization_id AND o.owner_id = (SELECT auth.uid())
      AND o.organization_type = 'commerce')
);
DROP POLICY IF EXISTS rg_commerce_products_delete ON public.rg_commerce_products;
CREATE POLICY rg_commerce_products_delete ON public.rg_commerce_products
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rg_organizations o
    WHERE o.id = organization_id AND o.owner_id = (SELECT auth.uid())
      AND o.organization_type = 'commerce')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rg_commerce_products TO authenticated;

-- 4) Stockage des photos de profil.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('zumaya-profile-photos','zumaya-profile-photos',true,5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS zumaya_profile_photo_public_read ON storage.objects;
CREATE POLICY zumaya_profile_photo_public_read ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'zumaya-profile-photos');

DROP POLICY IF EXISTS zumaya_profile_photo_insert ON storage.objects;
CREATE POLICY zumaya_profile_photo_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'zumaya-profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (SELECT 1 FROM public.rg_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.account_type NOT IN ('restaurant','hotel'))
);
DROP POLICY IF EXISTS zumaya_profile_photo_update ON storage.objects;
CREATE POLICY zumaya_profile_photo_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'zumaya-profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (SELECT 1 FROM public.rg_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.account_type NOT IN ('restaurant','hotel'))
)
WITH CHECK (
  bucket_id = 'zumaya-profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
DROP POLICY IF EXISTS zumaya_profile_photo_delete ON storage.objects;
CREATE POLICY zumaya_profile_photo_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'zumaya-profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

NOTIFY pgrst, 'reload schema';
