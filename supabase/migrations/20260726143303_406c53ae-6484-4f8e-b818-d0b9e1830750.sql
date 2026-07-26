DROP POLICY IF EXISTS cc_select ON public.collection_colors;
CREATE POLICY cc_select ON public.collection_colors FOR SELECT TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS pa_select ON public.print_artworks;
CREATE POLICY pa_select ON public.print_artworks FOR SELECT TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS pp_select ON public.print_proofs;
CREATE POLICY pp_select ON public.print_proofs FOR SELECT TO authenticated USING (auth.uid() = owner_id);