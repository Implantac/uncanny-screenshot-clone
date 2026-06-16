
-- 1) production_order_comments: restrict read to author or order owner
DROP POLICY IF EXISTS "auth read po comments" ON public.production_order_comments;
CREATE POLICY "po comments read author or owner"
ON public.production_order_comments
FOR SELECT TO authenticated
USING (author_id = auth.uid() OR owner_id = auth.uid());

-- 2) audit_logs: admins can read all; block client UPDATE/DELETE explicitly
CREATE POLICY "Admins can read all audit logs"
ON public.audit_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No client updates of audit logs"
ON public.audit_logs
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes of audit logs"
ON public.audit_logs
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (false);

-- 3) supplier_portal_tokens: remove broad ALL, expose only INSERT/UPDATE/DELETE for owner; no client SELECT of raw tokens
DROP POLICY IF EXISTS "owner manages supplier_portal_tokens" ON public.supplier_portal_tokens;
CREATE POLICY "owner inserts supplier portal tokens"
ON public.supplier_portal_tokens
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates supplier portal tokens"
ON public.supplier_portal_tokens
FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner deletes supplier portal tokens"
ON public.supplier_portal_tokens
FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- 4) dpp_records: remove direct public/anon SELECT; public passport page reads via server fn with service role
DROP POLICY IF EXISTS "public reads published dpp" ON public.dpp_records;

-- 5) has_sector: remove anon execute
REVOKE EXECUTE ON FUNCTION public.has_sector(uuid, app_sector) FROM PUBLIC, anon;
