-- ZUMAYA GROUP — autoriser le pôle Réseau social dans les modules utilisateur.
-- Migration additive : aucun compte ni contenu n'est supprimé.

alter table public.rg_user_modules
  drop constraint if exists rg_user_modules_module_code_check;

alter table public.rg_user_modules
  add constraint rg_user_modules_module_code_check
  check (module_code = any (array[
    'social',
    'restauration',
    'hotel',
    'agro',
    'marketplace',
    'livraison',
    'transport',
    'prestations',
    'evenements',
    'commerce',
    'voyage',
    'paiement',
    'entreprise'
  ]::text[]));
