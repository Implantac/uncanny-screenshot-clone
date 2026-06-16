
CREATE POLICY "Deny self role updates"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (user_id <> auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id <> auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deny self role deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (user_id <> auth.uid() OR public.has_role(auth.uid(), 'admin'));
