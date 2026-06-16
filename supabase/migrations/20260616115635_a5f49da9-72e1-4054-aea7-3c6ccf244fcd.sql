
CREATE TABLE public.prototype_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prototype_id UUID NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX prototype_comments_prototype_idx ON public.prototype_comments(prototype_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_comments TO authenticated;
GRANT ALL ON public.prototype_comments TO service_role;

ALTER TABLE public.prototype_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read prototype comments in own org"
  ON public.prototype_comments FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Insert prototype comments as author"
  ON public.prototype_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() AND owner_id = auth.uid());

CREATE POLICY "Author updates own comment"
  ON public.prototype_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Author deletes own comment"
  ON public.prototype_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER update_prototype_comments_updated_at
  BEFORE UPDATE ON public.prototype_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
