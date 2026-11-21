-- ZUMUYA MARKET : médias produits (images et vidéos)
-- À exécuter dans Supabase SQL Editor. Ne supprime aucune donnée existante.
ALTER TABLE public.commerce_products
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Bucket public pour afficher les médias du catalogue.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('commerce-media','commerce-media',true,52428800,
 ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public=true, file_size_limit=52428800;

-- Autoriser les utilisateurs authentifiés à téléverser uniquement dans leur dossier UID.
DROP POLICY IF EXISTS "commerce media upload own folder" ON storage.objects;
CREATE POLICY "commerce media upload own folder" ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text);

DROP POLICY IF EXISTS "commerce media owner update" ON storage.objects;
CREATE POLICY "commerce media owner update" ON storage.objects
 FOR UPDATE TO authenticated
 USING (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text)
 WITH CHECK (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text);

DROP POLICY IF EXISTS "commerce media owner delete" ON storage.objects;
CREATE POLICY "commerce media owner delete" ON storage.objects
 FOR DELETE TO authenticated
 USING (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text);

-- Les fichiers du bucket public peuvent être affichés au catalogue.
DROP POLICY IF EXISTS "commerce media public read" ON storage.objects;
CREATE POLICY "commerce media public read" ON storage.objects
 FOR SELECT TO anon, authenticated USING (bucket_id='commerce-media');
