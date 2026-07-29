DROP POLICY IF EXISTS "Mentioned users can read comment" ON public.product_timeline_comments;
CREATE POLICY "Mentioned users can read comment"
ON public.product_timeline_comments
FOR SELECT
TO authenticated
USING (auth.uid() = ANY (mentioned_user_ids) AND owner_id = auth.uid());