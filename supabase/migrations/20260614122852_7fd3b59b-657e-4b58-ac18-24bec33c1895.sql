
-- Restrict suppliers SELECT policy to authenticated role only
DROP POLICY IF EXISTS "Owners can view their suppliers" ON public.suppliers;
CREATE POLICY "Owners can view their suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Drop platform-wide admin audit log access; restrict admins to their own tenant logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
