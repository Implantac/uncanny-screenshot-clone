
CREATE TABLE public.inventory_cycle_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  abc_class TEXT NOT NULL CHECK (abc_class IN ('A','B','C')),
  expected_balance NUMERIC NOT NULL DEFAULT 0,
  counted_balance NUMERIC NOT NULL DEFAULT 0,
  variance NUMERIC GENERATED ALWAYS AS (counted_balance - expected_balance) STORED,
  variance_pct NUMERIC,
  notes TEXT,
  counted_by UUID REFERENCES auth.users(id),
  counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cycle_counts_owner_item ON public.inventory_cycle_counts(owner_id, inventory_item_id, counted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_cycle_counts TO authenticated;
GRANT ALL ON public.inventory_cycle_counts TO service_role;

ALTER TABLE public.inventory_cycle_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cycle_counts_owner_all" ON public.inventory_cycle_counts
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_cycle_counts_updated
  BEFORE UPDATE ON public.inventory_cycle_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
