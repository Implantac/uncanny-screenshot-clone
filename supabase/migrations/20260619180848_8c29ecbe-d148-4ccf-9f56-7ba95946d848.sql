-- Defensive RESTRICTIVE INSERT policy on dpp_views: ensures only service_role can ever write,
-- even if a permissive policy for anon/authenticated is accidentally added later.
CREATE POLICY "dpp_views_block_client_inserts"
ON public.dpp_views
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);