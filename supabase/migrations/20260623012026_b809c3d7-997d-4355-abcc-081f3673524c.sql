
-- 1) Enum + colunas em products
DO $$ BEGIN
  CREATE TYPE public.product_abc_class AS ENUM ('A','B','C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS abc_class public.product_abc_class,
  ADD COLUMN IF NOT EXISTS abc_revenue_12m numeric(14,2),
  ADD COLUMN IF NOT EXISTS abc_updated_at timestamptz;

-- 2) size_grids
CREATE TABLE IF NOT EXISTS public.size_grids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('category','product_group','product')),
  scope_value text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS size_grids_uniq
  ON public.size_grids(owner_id, scope, scope_value, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.size_grids TO authenticated;
GRANT ALL ON public.size_grids TO service_role;

ALTER TABLE public.size_grids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own size_grids" ON public.size_grids
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER size_grids_updated_at BEFORE UPDATE ON public.size_grids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) seasonality_curves
CREATE TABLE IF NOT EXISTS public.seasonality_curves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('category','product_group','product')),
  scope_value text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  multipliers jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seasonality_curves_uniq
  ON public.seasonality_curves(owner_id, scope, scope_value, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasonality_curves TO authenticated;
GRANT ALL ON public.seasonality_curves TO service_role;

ALTER TABLE public.seasonality_curves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own seasonality" ON public.seasonality_curves
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER seasonality_curves_updated_at BEFORE UPDATE ON public.seasonality_curves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Função recompute_abc_class (top 20% A, próximos 30% B, 50% C, por faturamento 365d)
CREATE OR REPLACE FUNCTION public.recompute_abc_class(_owner uuid)
RETURNS TABLE(a_count int, b_count int, c_count int, total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - interval '365 days';
  _a int := 0; _b int := 0; _c int := 0; _t int := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _owner THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH revs AS (
    SELECT p.id AS product_id,
           COALESCE((SELECT SUM(s.total) FROM public.sales s
                      WHERE s.product_id = p.id
                        AND s.user_id = _owner
                        AND s.sold_at >= _since), 0)
         + COALESCE((SELECT SUM(esm.total_value) FROM public.erp_sales_mirror esm
                      WHERE esm.owner_id = _owner
                        AND esm.sold_at >= _since
                        AND (esm.sku = p.sku OR esm.product_name = p.name)), 0)
           AS revenue
      FROM public.products p
     WHERE p.owner_id = _owner
  ),
  ranked AS (
    SELECT product_id, revenue,
           ROW_NUMBER() OVER (ORDER BY revenue DESC, product_id) AS rn,
           COUNT(*) OVER () AS n
      FROM revs
  ),
  classified AS (
    SELECT product_id, revenue,
           CASE
             WHEN n = 0 THEN NULL
             WHEN rn <= GREATEST(1, CEIL(n * 0.20)) THEN 'A'::public.product_abc_class
             WHEN rn <= GREATEST(1, CEIL(n * 0.50)) THEN 'B'::public.product_abc_class
             ELSE 'C'::public.product_abc_class
           END AS klass
      FROM ranked
  )
  UPDATE public.products p
     SET abc_class = c.klass,
         abc_revenue_12m = c.revenue,
         abc_updated_at = now()
    FROM classified c
   WHERE p.id = c.product_id
     AND (p.abc_class IS DISTINCT FROM c.klass
       OR p.abc_revenue_12m IS DISTINCT FROM c.revenue
       OR p.abc_updated_at IS NULL);

  SELECT COUNT(*) FILTER (WHERE abc_class = 'A'),
         COUNT(*) FILTER (WHERE abc_class = 'B'),
         COUNT(*) FILTER (WHERE abc_class = 'C'),
         COUNT(*)
    INTO _a, _b, _c, _t
    FROM public.products WHERE owner_id = _owner;

  a_count := _a; b_count := _b; c_count := _c; total := _t;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_abc_class(uuid) TO authenticated;
