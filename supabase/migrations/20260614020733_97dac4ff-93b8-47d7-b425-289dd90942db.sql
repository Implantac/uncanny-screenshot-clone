ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_group text,
  ADD COLUMN IF NOT EXISTS subgroup text,
  ADD COLUMN IF NOT EXISTS product_class text,
  ADD COLUMN IF NOT EXISTS grade text;