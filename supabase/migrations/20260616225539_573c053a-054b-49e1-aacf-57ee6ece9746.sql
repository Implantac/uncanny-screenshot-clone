DROP POLICY IF EXISTS "auth insert po comments as author" ON public.production_order_comments;
CREATE POLICY "auth insert po comments as author" ON public.production_order_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND owner_id = auth.uid());