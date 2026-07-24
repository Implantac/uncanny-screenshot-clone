
-- Storage policies for materials and fit-photos buckets: each user manages their own folder.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='materials owner rw') THEN
    CREATE POLICY "materials owner rw" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='fit-photos owner rw') THEN
    CREATE POLICY "fit-photos owner rw" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'fit-photos' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'fit-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
