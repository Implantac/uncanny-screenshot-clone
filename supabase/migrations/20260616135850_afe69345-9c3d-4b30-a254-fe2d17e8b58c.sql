CREATE TABLE public.production_order_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_order_comments TO authenticated;
GRANT ALL ON public.production_order_comments TO service_role;

ALTER TABLE public.production_order_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read po comments" ON public.production_order_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert po comments as author" ON public.production_order_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "author or owner update po comments" ON public.production_order_comments
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR owner_id = auth.uid())
  WITH CHECK (author_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "author or owner delete po comments" ON public.production_order_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR owner_id = auth.uid());

CREATE INDEX idx_po_comments_order ON public.production_order_comments(production_order_id, created_at);

CREATE TRIGGER update_po_comments_updated_at
  BEFORE UPDATE ON public.production_order_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();