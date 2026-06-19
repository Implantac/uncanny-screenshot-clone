CREATE TABLE public.supplier_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  pieces_per_day integer NOT NULL DEFAULT 0 CHECK (pieces_per_day >= 0),
  working_days_per_week integer NOT NULL DEFAULT 5 CHECK (working_days_per_week BETWEEN 1 AND 7),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, supplier_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_capacity TO authenticated;
GRANT ALL ON public.supplier_capacity TO service_role;

ALTER TABLE public.supplier_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage supplier_capacity"
  ON public.supplier_capacity FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER update_supplier_capacity_updated_at
  BEFORE UPDATE ON public.supplier_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_supplier_capacity_owner ON public.supplier_capacity(owner_id);
CREATE INDEX idx_supplier_capacity_supplier ON public.supplier_capacity(supplier_id);