
CREATE TABLE IF NOT EXISTS public.supplier_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  window_days integer NOT NULL DEFAULT 90,
  otif_pct numeric,
  lead_time_days numeric,
  orders_count integer NOT NULL DEFAULT 0,
  occurrences_count integer NOT NULL DEFAULT 0,
  capa_reopened_count integer NOT NULL DEFAULT 0,
  fpy_pct numeric,
  score numeric NOT NULL DEFAULT 0,
  prev_score numeric,
  delta numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_scorecards TO authenticated;
GRANT ALL ON public.supplier_scorecards TO service_role;

ALTER TABLE public.supplier_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_scorecards_owner_all"
  ON public.supplier_scorecards
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_owner_supplier_time
  ON public.supplier_scorecards (owner_id, supplier_id, computed_at DESC);
