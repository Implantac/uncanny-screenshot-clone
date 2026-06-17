
-- inventory-attachments (privado, scoped por usuário)
CREATE POLICY "inventory_attachments_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inventory-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "inventory_attachments_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventory-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "inventory_attachments_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inventory-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "inventory_attachments_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inventory-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- collection-covers (privado, scoped por usuário)
CREATE POLICY "collection_covers_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'collection-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "collection_covers_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'collection-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "collection_covers_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'collection-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "collection_covers_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'collection-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
