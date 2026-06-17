ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS color_internal text,
  ADD COLUMN IF NOT EXISTS color_supplier text,
  ADD COLUMN IF NOT EXISTS tech_sheet_pdf_url text;