
-- ZUMUYA GROUP : provisioning professionnel à la création du compte
-- et correction de suppression de compte.
-- À exécuter dans Supabase SQL Editor. Sauvegarde conseillée.

CREATE OR REPLACE FUNCTION public.rg_provision_account_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE
  v_type text;
  v_name text;
  v_org uuid;
BEGIN
  v_type := COALESCE(NEW.raw_user_meta_data->>'account_type',
                    NEW.raw_user_meta_data->>'requested_account_type');
  v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'),''), 'Nouvel établissement');

  IF v_type IN ('restaurant','hotel','delivery','agro_producer','agro_trader','commerce','business') THEN
    INSERT INTO public.rg_organizations
      (public_name, organization_type, owner_id, verification_status, details)
    VALUES
      (v_name, v_type, NEW.id, 'verified',
       jsonb_build_object('created_from_signup',true,'account_type',v_type))
    RETURNING id INTO v_org;

    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data,'{}'::jsonb)
      || jsonb_build_object('organization_id',v_org,'account_type',v_type);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rg_provision_account_type_after_signup ON auth.users;
CREATE TRIGGER rg_provision_account_type_after_signup
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.rg_provision_account_type();

-- Permet au compte connecté de supprimer son compte depuis Paramètres.
CREATE OR REPLACE FUNCTION public.rg_delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_orgs uuid[];
  v_local_users text[];
  v_local_rests text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.rg_platform_owners WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Le compte propriétaire de la plateforme ne peut pas être supprimé ici.';
  END IF;

  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
    INTO v_orgs
    FROM public.rg_organizations AS o
   WHERE o.owner_id = v_uid;

  SELECT COALESCE(array_agg(u.id), ARRAY[]::text[])
    INTO v_local_users
    FROM public.rg_users AS u
   WHERE u.data->>'portalId' = v_uid::text;

  SELECT COALESCE(array_agg(r.id), ARRAY[]::text[])
    INTO v_local_rests
    FROM public.rg_rests AS r
   WHERE r.data->>'portalOrgId' = ANY(v_orgs::text[]);

  -- Retire les commandes du client, du livreur ou des établissements de ce compte.
  -- Les messages de chat stockés dans rg_orders sont volontairement préservés.
  DELETE FROM public.rg_orders AS o
   WHERE left(o.id, 7) <> '__chat_'
     AND (o.data->>'clientId' = ANY(v_local_users)
       OR o.data->>'driverId' = ANY(v_local_users)
       OR o.data->>'restId' = ANY(v_local_rests));

  DELETE FROM public.rg_rests AS r
   WHERE r.data->>'portalOrgId' = ANY(v_orgs::text[]);

  DELETE FROM public.rg_users AS u
   WHERE u.data->>'portalId' = v_uid::text;

  DELETE FROM public.rg_partner_applications WHERE user_id = v_uid;
  DELETE FROM public.rg_organizations WHERE owner_id = v_uid;

  -- Les profils et données reliés par ON DELETE CASCADE suivent le compte Auth.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.rg_delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rg_delete_my_account() TO authenticated;

