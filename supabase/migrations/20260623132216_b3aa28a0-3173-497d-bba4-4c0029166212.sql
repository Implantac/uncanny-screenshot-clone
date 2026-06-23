
DROP POLICY IF EXISTS "Read prototype comments team" ON public.prototype_comments;
CREATE POLICY "Read prototype comments team"
  ON public.prototype_comments
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;
