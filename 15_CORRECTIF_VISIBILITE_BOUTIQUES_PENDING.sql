-- ZUMAYA GROUP — correction de visibilité publique Marketplace
-- À exécuter dans le SQL Editor du projet Supabase azfunhfjmybekzakhtbu.
-- Les boutiques pending peuvent être utilisées immédiatement ; la vérification
-- administrative reste indépendante et ne bloque pas le catalogue.
-- Migration additive et relançable : aucune donnée n’est supprimée.

BEGIN;

ALTER TABLE public.commerce_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.commerce_stores, public.commerce_products TO anon, authenticated;

DROP POLICY IF EXISTS zumaya_public_active_stores_read ON public.commerce_stores;
CREATE POLICY zumaya_public_active_stores_read
ON public.commerce_stores FOR SELECT TO anon, authenticated
USING (is_active = true AND verification_status IN ('pending','verified'));

DROP POLICY IF EXISTS zumaya_public_active_products_read ON public.commerce_products;
CREATE POLICY zumaya_public_active_products_read
ON public.commerce_products FOR SELECT TO anon, authenticated
USING (
  status = 'active'
  AND stock_quantity > 0
  AND EXISTS (
    SELECT 1 FROM public.commerce_stores s
    WHERE s.id = commerce_products.store_id
      AND s.is_active = true
      AND s.verification_status IN ('pending','verified')
  )
);

NOTIFY pgrst, 'reload schema';
COMMIT;
