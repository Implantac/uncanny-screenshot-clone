ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS cover_path text;

CREATE POLICY "Authenticated can view collection covers"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'collection-covers');

CREATE POLICY "Users can upload their own collection covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'collection-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own collection covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'collection-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own collection covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'collection-covers' AND (storage.foldername(name))[1] = auth.uid()::text);