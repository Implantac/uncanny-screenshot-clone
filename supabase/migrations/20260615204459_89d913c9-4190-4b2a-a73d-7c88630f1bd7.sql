
CREATE TABLE public.pcp_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, key)
);

CREATE INDEX idx_pcp_stages_owner_pos ON public.pcp_stages(owner_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_stages TO authenticated;
GRANT ALL ON public.pcp_stages TO service_role;

ALTER TABLE public.pcp_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcp_stages select own" ON public.pcp_stages FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "pcp_stages insert own" ON public.pcp_stages FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pcp_stages update own" ON public.pcp_stages FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pcp_stages delete own" ON public.pcp_stages FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_pcp_stages_updated_at BEFORE UPDATE ON public.pcp_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
