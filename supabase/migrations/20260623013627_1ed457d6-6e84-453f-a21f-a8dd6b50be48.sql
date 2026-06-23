CREATE OR REPLACE FUNCTION public.recompute_abc_class(_owner uuid)
 RETURNS TABLE(a_count integer, b_count integer, c_count integer, total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                        AND (esm.sku = p.sku OR esm.product_ref = p.sku)), 0)
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
END $function$;