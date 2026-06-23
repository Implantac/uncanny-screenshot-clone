
-- 1) audit_logs: bloquear INSERT do cliente (apenas service_role grava)
DROP POLICY IF EXISTS "No client inserts on audit_logs" ON public.audit_logs;
CREATE POLICY "No client inserts on audit_logs"
ON public.audit_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 2) supplier_portal_tokens: garantir que coluna token_hash não seja legível por authenticated/anon
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;

-- 3) prototype_handoff_events e prototype_gates: admin precisa também ser do mesmo tenant
DROP POLICY IF EXISTS "prototype_handoff_select_owner" ON public.prototype_handoff_events;
CREATE POLICY "prototype_handoff_select_owner"
ON public.prototype_handoff_events
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "prototype_gates_select_owner" ON public.prototype_gates;
CREATE POLICY "prototype_gates_select_owner"
ON public.prototype_gates
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid()));

-- 4) user_roles: garantir que admins só possam atribuir papéis a si próprios (tenant único = um auth user por tenant)
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
CREATE POLICY "Admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
CREATE POLICY "Admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());
