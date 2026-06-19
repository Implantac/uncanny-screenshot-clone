
CREATE POLICY "Owners upload supplier uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update supplier uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'supplier-uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'supplier-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete supplier uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'supplier-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
