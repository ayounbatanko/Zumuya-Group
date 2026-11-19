-- ZUMUYA GROUP — Suppression de compte par l'utilisateur (tous types de comptes)
-- À exécuter UNE FOIS dans Supabase > SQL Editor (après le schéma principal).
-- La page parametres.html appelle cette fonction (bouton « Supprimer mon compte »).

create or replace function public.rg_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_orgs text[];
  v_loc  text[];
begin
  if v_uid is null then
    raise exception 'Vous devez être connecté.';
  end if;
  if exists (select 1 from public.rg_platform_owners where user_id = v_uid) then
    raise exception 'Le compte propriétaire de la plateforme ne peut pas être supprimé ici.';
  end if;

  -- Organisations (restaurant, hôtel, livreur, commerce…) appartenant à l'utilisateur
  select coalesce(array_agg(id::text), '{}') into v_orgs from public.rg_organizations where owner_id = v_uid;

  -- Comptes locaux du Service de Restauration reliés à ce compte portail
  select coalesce(array_agg(id), '{}') into v_loc from public.rg_users where data->>'portalId' = v_uid::text;

  -- Commandes passées par ce client / ce livreur
  delete from public.rg_orders where data->>'clientId' = any(v_loc) and id not like '\_\_chat\_%';
  -- Fiches restaurant / hôtel (disparaissent du catalogue public)
  delete from public.rg_rests where data->>'portalOrgId' = any(v_orgs);
  delete from public.rg_users where id = any(v_loc);

  delete from public.rg_partner_applications where user_id = v_uid;
  delete from public.rg_organizations where owner_id = v_uid;
  -- rg_profiles, rg_agro_profiles, rg_agro_products… sont supprimés en cascade avec le compte
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.rg_delete_my_account() from public, anon;
grant execute on function public.rg_delete_my_account() to authenticated;
