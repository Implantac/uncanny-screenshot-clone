CREATE TABLE public.user_view_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module, name)
);

CREATE INDEX user_view_presets_user_module_idx ON public.user_view_presets(user_id, module);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_view_presets TO authenticated;
GRANT ALL ON public.user_view_presets TO service_role;

ALTER TABLE public.user_view_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own presets select" ON public.user_view_presets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users manage own presets insert" ON public.user_view_presets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users manage own presets update" ON public.user_view_presets
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users manage own presets delete" ON public.user_view_presets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_user_view_presets_updated_at
  BEFORE UPDATE ON public.user_view_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();