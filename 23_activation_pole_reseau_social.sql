-- ZUMAYA GROUP — activation du pôle Réseau social
-- Migration additive : conserve les données et les tables existantes.

alter table public.rg_module_catalog
  drop constraint if exists rg_module_catalog_module_code_check;

alter table public.rg_module_catalog
  add constraint rg_module_catalog_module_code_check
  check (module_code = any (array[
    'social','restauration','hotel','agro','marketplace','livraison',
    'transport','prestations','evenements','commerce','voyage','paiement','entreprise'
  ]::text[]));

insert into public.rg_module_catalog
  (module_code,label,description,rollout_status,requires_organization,sort_order,configuration_schema,updated_at)
values
  ('social','Réseau social','Communauté ZUMAYA : profils, publications texte/photo/vidéo, abonnements, mentions J’aime et commentaires.','available',false,0,
   '{"type":"object","properties":{"visibility":{"type":"string","enum":["public","followers","private"]}}}'::jsonb,now())
on conflict (module_code) do update
set label=excluded.label,
    description=excluded.description,
    rollout_status='available',
    requires_organization=false,
    sort_order=0,
    configuration_schema=excluded.configuration_schema,
    updated_at=now();

grant select,insert,update,delete on public.zg_social_profiles to authenticated;
grant select,insert,delete on public.zg_social_posts to authenticated;
grant select,insert,delete on public.zg_social_follows to authenticated;
grant select,insert,delete on public.zg_social_likes to authenticated;
grant select,insert,delete on public.zg_social_comments to authenticated;
