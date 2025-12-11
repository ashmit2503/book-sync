-- Storage buckets are created via Supabase Dashboard or CLI
-- This file documents the required storage configuration

/*
1. Create 'ebooks' bucket (Private):
   - Name: ebooks
   - Public: false
   - File size limit: 524288000 (500 MB)
   - Allowed MIME types: ['application/pdf', 'application/epub+zip']

2. Create 'covers' bucket (Public with CDN):
   - Name: covers
   - Public: true
   - File size limit: 5242880 (5 MB)
   - Allowed MIME types: ['image/jpeg', 'image/png', 'image/webp']
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own covers" ON storage.objects;

-- Storage policies for ebooks bucket
CREATE POLICY "Users can upload own ebooks"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ebooks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own ebooks"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ebooks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own ebooks"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'ebooks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own ebooks"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ebooks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for covers bucket (public)
CREATE POLICY "Anyone can view covers"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'covers');

CREATE POLICY "Authenticated users can upload covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'covers');

CREATE POLICY "Authenticated users can update covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'covers');

CREATE POLICY "Users can delete own covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'covers' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
