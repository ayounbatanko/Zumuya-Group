-- ZUMAYA GROUP — correctifs appliqués au projet Supabase « Gestion resto » le 2026-11-20 (migration fix_account_deletion_fks_and_rpc).
-- Idempotent : peut être rejoué sans risque.
-- 1) FK vers auth.users qui bloquaient la suppression d'un compte
ALTER TABLE public.rg_agro_groups DROP CONSTRAINT IF EXISTS rg_agro_groups_created_by_fkey, ADD CONSTRAINT rg_agro_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.rg_agro_group_offers DROP CONSTRAINT IF EXISTS rg_agro_group_offers_seller_id_fkey, ADD CONSTRAINT rg_agro_group_offers_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.rg_agro_group_orders DROP CONSTRAINT IF EXISTS rg_agro_group_orders_created_by_fkey, ADD CONSTRAINT rg_agro_group_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.rg_agro_group_order_members DROP CONSTRAINT IF EXISTS rg_agro_group_order_members_user_id_fkey, ADD CONSTRAINT rg_agro_group_order_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.rg_organizations ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.rg_organizations DROP CONSTRAINT IF EXISTS rg_organizations_created_by_fkey, ADD CONSTRAINT rg_organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.rg_partners ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.rg_partners DROP CONSTRAINT IF EXISTS rg_partners_created_by_fkey, ADD CONSTRAINT rg_partners_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.rg_payment_transactions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.rg_payment_transactions DROP CONSTRAINT IF EXISTS rg_payment_transactions_created_by_fkey, ADD CONSTRAINT rg_payment_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.rg_service_records DROP CONSTRAINT IF EXISTS rg_service_records_created_by_fkey, ADD CONSTRAINT rg_service_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
-- 2) Fonction rg_delete_my_account : voir 05_suppression_compte.sql (version à jour installée sur le serveur ci-dessous)
DROP INDEX IF EXISTS public.rg_organizations_creator_idx;
