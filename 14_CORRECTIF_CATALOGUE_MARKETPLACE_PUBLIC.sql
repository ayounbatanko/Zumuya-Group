-- ZUMAYA GROUP — lecture publique des produits Marketplace
-- À exécuter dans le projet Supabase configuré dans config.js.
-- Migration additive et relançable : ne supprime aucune boutique ni aucun produit.

ALTER TABLE public.commerce_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.commerce_stores TO anon, authenticated;
GRANT SELECT ON TABLE public.commerce_products TO anon, authenticated;
GRANT SELECT ON TABLE public.commerce_categories TO anon, authenticated;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='commerce_stores'
      AND policyname='zumaya_public_active_stores_read'
  ) THEN
    CREATE POLICY zumaya_public_active_stores_read
      ON public.commerce_stores
      FOR SELECT TO anon, authenticated
      USING (is_active = true AND verification_status = 'verified');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='commerce_products'
      AND policyname='zumaya_public_active_products_read'
  ) THEN
    CREATE POLICY zumaya_public_active_products_read
      ON public.commerce_products
      FOR SELECT TO anon, authenticated
      USING (
        status = 'active'
        AND stock_quantity > 0
        AND EXISTS (
          SELECT 1
          FROM public.commerce_stores AS s
          WHERE s.id = commerce_products.store_id
            AND s.is_active = true
            AND s.verification_status = 'verified'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='commerce_categories'
      AND policyname='zumaya_public_active_categories_read'
  ) THEN
    CREATE POLICY zumaya_public_active_categories_read
      ON public.commerce_categories
      FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;
END
$migration$;

NOTIFY pgrst, 'reload schema';
