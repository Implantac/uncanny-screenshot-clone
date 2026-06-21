-- Frente 3: BOP - Roteiro produtivo por produto/familia
CREATE TABLE public.product_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  family_id uuid REFERENCES public.product_families(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  sla_days integer NOT NULL DEFAULT 2,
  required boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_routing_scope_chk CHECK (
    (product_id IS NOT NULL AND family_id IS NULL) OR
    (product_id IS NULL AND family_id IS NOT NULL)
  )
);

CREATE INDEX product_routing_product_idx ON public.product_routing(product_id, sequence);
CREATE INDEX product_routing_family_idx ON public.product_routing(family_id, sequence);
CREATE INDEX product_routing_owner_idx ON public.product_routing(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_routing TO authenticated;
GRANT ALL ON public.product_routing TO service_role;

ALTER TABLE public.product_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages product_routing"
  ON public.product_routing
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_routing_updated_at
  BEFORE UPDATE ON public.product_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();