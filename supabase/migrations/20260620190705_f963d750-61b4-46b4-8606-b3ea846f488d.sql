DROP POLICY IF EXISTS "prototype_comments_insert" ON public.prototype_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.prototype_comments;
DROP POLICY IF EXISTS "Owners insert comments" ON public.prototype_comments;

CREATE POLICY "prototype_comments_insert_team"
  ON public.prototype_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prototypes p
      WHERE p.id = prototype_comments.prototype_id
        AND p.owner_id = prototype_comments.owner_id
    )
  );