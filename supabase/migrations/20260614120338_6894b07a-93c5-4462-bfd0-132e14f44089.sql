
DROP POLICY IF EXISTS "Authenticated can insert their audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert their audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
