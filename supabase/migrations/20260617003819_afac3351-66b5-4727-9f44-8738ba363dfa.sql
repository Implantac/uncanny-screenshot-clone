
-- 7. Almoxarifado
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS supplier_color text,
  ADD COLUMN IF NOT EXISTS internal_color text,
  ADD COLUMN IF NOT EXISTS tech_sheet_pdf_url text;

-- 8. Marketing por peça/coleção
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_shoot numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_photos numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_traffic numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS marketing_campaigns_product_idx ON public.marketing_campaigns(product_id);
CREATE INDEX IF NOT EXISTS marketing_campaigns_collection_idx ON public.marketing_campaigns(collection_id);

-- 4. Lote
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS process text;

-- 2. Moodboard de coleção
CREATE TABLE IF NOT EXISTS public.collection_moodboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  kind text DEFAULT 'inspiracao',
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_moodboard TO authenticated;
GRANT ALL ON public.collection_moodboard TO service_role;

ALTER TABLE public.collection_moodboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moodboard owner select" ON public.collection_moodboard
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "moodboard owner insert" ON public.collection_moodboard
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "moodboard owner update" ON public.collection_moodboard
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "moodboard owner delete" ON public.collection_moodboard
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS collection_moodboard_collection_idx ON public.collection_moodboard(collection_id);

CREATE TRIGGER collection_moodboard_updated_at
  BEFORE UPDATE ON public.collection_moodboard
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Ocorrências de produção
CREATE TABLE IF NOT EXISTS public.production_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  batch_id uuid REFERENCES public.production_batches(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sector text,
  responsible_id uuid,
  affected_qty integer DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta',
  description text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_occurrences TO authenticated;
GRANT ALL ON public.production_occurrences TO service_role;

ALTER TABLE public.production_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occ owner select" ON public.production_occurrences
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "occ owner insert" ON public.production_occurrences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "occ owner update" ON public.production_occurrences
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "occ owner delete" ON public.production_occurrences
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS production_occurrences_batch_idx ON public.production_occurrences(batch_id);
CREATE INDEX IF NOT EXISTS production_occurrences_order_idx ON public.production_occurrences(order_id);
CREATE INDEX IF NOT EXISTS production_occurrences_status_idx ON public.production_occurrences(status);

CREATE TRIGGER production_occurrences_updated_at
  BEFORE UPDATE ON public.production_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
