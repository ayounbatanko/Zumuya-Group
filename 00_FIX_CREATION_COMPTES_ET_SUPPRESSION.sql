
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
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_orgs uuid[];
  v_loc text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Vous devez être connecté.'; END IF;
  IF EXISTS (SELECT 1 FROM public.rg_platform_owners WHERE user_id=v_uid) THEN
    RAISE EXCEPTION 'Le compte propriétaire de la plateforme ne peut pas être supprimé ici.';
  END IF;

  SELECT COALESCE(array_agg(id),ARRAY[]::uuid[])
    INTO v_orgs FROM public.rg_organizations WHERE owner_id=v_uid;

  SELECT COALESCE(array_agg(id::text),ARRAY[]::text[])
    INTO v_loc FROM public.rg_users WHERE data->>'portalId'=v_uid::text;

  -- Données du module restauration associées à ce compte
  DELETE FROM public.rg_orders
   WHERE data->>'clientId'=ANY(v_loc) AND id NOT LIKE '__chat_%';
  DELETE FROM public.rg_rests WHERE data->>'portalOrgId'=ANY(v_orgs::text[]);
  DELETE FROM public.rg_users WHERE id::text=ANY(v_loc);

  DELETE FROM public.rg_partner_applications WHERE user_id=v_uid;
  DELETE FROM public.rg_organizations WHERE owner_id=v_uid;

  -- Supprimer le compte auth à la fin (cascades prévues dans le schéma).
  DELETE FROM auth.users WHERE id=v_uid;
END $$;

REVOKE ALL ON FUNCTION public.rg_delete_my_account() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.rg_delete_my_account() TO authenticated;

