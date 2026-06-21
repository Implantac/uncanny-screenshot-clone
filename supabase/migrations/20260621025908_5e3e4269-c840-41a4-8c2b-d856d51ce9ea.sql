DROP POLICY IF EXISTS "Read prototype comments team" ON public.prototype_comments;

CREATE POLICY "Read prototype comments team"
ON public.prototype_comments
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.prototypes p
    WHERE p.id = prototype_comments.prototype_id
      AND p.owner_id = prototype_comments.owner_id
  )
);