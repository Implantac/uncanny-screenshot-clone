
-- 1) supplier_portal_tokens: revoke column-level SELECT on token_hash
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM PUBLIC;

-- 2) user_roles: tighten policies to eliminate cross-account self-grant
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny self role grants" ON public.user_roles;
DROP POLICY IF EXISTS "Deny self role updates" ON public.user_roles;
DROP POLICY IF EXISTS "Deny self role deletes" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;

-- Admin-only write policies (permissive). SELECT policy "Users can view their own roles" remains.
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Restrictive backstop: even admins cannot modify their OWN role rows
CREATE POLICY "No self role insert" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() <> user_id);

CREATE POLICY "No self role update" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (auth.uid() <> user_id)
  WITH CHECK (auth.uid() <> user_id);

CREATE POLICY "No self role delete" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (auth.uid() <> user_id);
