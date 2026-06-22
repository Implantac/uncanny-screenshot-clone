ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS target_revenue numeric,
  ADD COLUMN IF NOT EXISTS target_pieces integer,
  ADD COLUMN IF NOT EXISTS target_margin_pct numeric;

COMMENT ON COLUMN public.collections.target_revenue IS 'Meta de receita (R$) da coleção. NULL = sem meta definida.';
COMMENT ON COLUMN public.collections.target_pieces IS 'Meta de peças vendidas da coleção.';
COMMENT ON COLUMN public.collections.target_margin_pct IS 'Meta de margem (%) da coleção.';