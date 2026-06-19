CREATE POLICY "Owners update supplier portal attachments"
  ON public.supplier_portal_attachments
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
