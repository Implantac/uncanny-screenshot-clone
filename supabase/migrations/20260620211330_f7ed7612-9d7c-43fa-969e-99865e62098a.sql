
-- 1) Prototype comments: align SELECT with team-based INSERT policy
DROP POLICY IF EXISTS "Read prototype comments in own org" ON public.prototype_comments;

CREATE POLICY "Read prototype comments team"
  ON public.prototype_comments FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.prototypes p
      WHERE p.id = prototype_comments.prototype_id
        AND p.owner_id = prototype_comments.owner_id
    )
  );

-- 2) user_roles: explicit RESTRICTIVE policy requiring admin for ALL inserts
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
