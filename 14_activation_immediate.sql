-- Activation immédiate des pôles : plus aucune validation par un tiers.
-- À exécuter une fois dans Supabase > SQL Editor (facultatif : le site insère désormais directement en 'verified').
update public.rg_organizations
   set verification_status = 'verified'
 where verification_status = 'pending';
alter table public.rg_organizations alter column verification_status set default 'verified';
