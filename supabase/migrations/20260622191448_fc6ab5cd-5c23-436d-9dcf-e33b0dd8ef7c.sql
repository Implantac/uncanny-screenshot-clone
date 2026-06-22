-- 1) Revoke SELECT on supplier_portal_tokens.token_hash from non-service roles
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM PUBLIC;

-- 2) Tighten prototype_comments SELECT policy: remove broad EXISTS clause that
--    granted comment readers cross-tenant visibility based only on prototype/owner match.
DROP POLICY IF EXISTS "Read prototype comments team" ON public.prototype_comments;

CREATE POLICY "Read prototype comments team"
ON public.prototype_comments
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);