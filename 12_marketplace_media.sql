-- ZUMUYA GROUP : marketplace medias et activation automatique des boutiques
-- Script relançable sans supprimer les données

ALTER TABLE public.commerce_products
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Bucket public : photos et vidéos (50 Mo par fichier)
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('commerce-media','commerce-media',true,52428800,
 ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=52428800,
 allowed_mime_types=EXCLUDED.allowed_mime_types;

-- Règles de stockage : accès public en lecture, écriture limitée au dossier UID
DROP POLICY IF EXISTS "commerce media upload own folder" ON storage.objects;
CREATE POLICY "commerce media upload own folder" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS "commerce media owner update" ON storage.objects;
CREATE POLICY "commerce media owner update" ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text)
 WITH CHECK (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS "commerce media owner delete" ON storage.objects;
CREATE POLICY "commerce media owner delete" ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id='commerce-media' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS "commerce media public read" ON storage.objects;
CREATE POLICY "commerce media public read" ON storage.objects FOR SELECT TO anon,authenticated
 USING (bucket_id='commerce-media');

-- Active automatiquement les boutiques existantes qui sont en attente
UPDATE public.commerce_stores SET verification_status='verified',is_active=true
 WHERE verification_status IS DISTINCT FROM 'verified' OR is_active IS DISTINCT FROM true;

NOTIFY pgrst, 'reload schema';
