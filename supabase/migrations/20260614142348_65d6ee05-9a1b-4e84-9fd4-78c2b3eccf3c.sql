
-- 1) Extras em production_orders e production_stage_log
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS outsourced boolean NOT NULL DEFAULT false;

ALTER TABLE public.production_stage_log
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false;

-- 2) Tabela service_orders
CREATE TYPE public.service_order_kind AS ENUM ('parcial', 'integral');
CREATE TYPE public.service_order_status AS ENUM ('aberta', 'enviada', 'em_andamento', 'recebida', 'cancelada');

CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  code text NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  kind public.service_order_kind NOT NULL DEFAULT 'integral',
  quantity numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  status public.service_order_status NOT NULL DEFAULT 'aberta',
  sent_at timestamptz,
  due_at date,
  received_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_orders_owner ON public.service_orders(owner_id);
CREATE INDEX idx_service_orders_po ON public.service_orders(production_order_id);
CREATE INDEX idx_service_orders_supplier ON public.service_orders(supplier_id);
CREATE INDEX idx_service_orders_status ON public.service_orders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_orders owner select" ON public.service_orders FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "service_orders owner insert" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "service_orders owner update" ON public.service_orders FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "service_orders owner delete" ON public.service_orders FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Trigger: quando uma O.S. é marcada 'recebida', registra a passagem
--    no production_stage_log e avança o stage da ordem se for integral.
CREATE OR REPLACE FUNCTION public.service_orders_on_received()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  po_record public.production_orders%ROWTYPE;
BEGIN
  IF NEW.status = 'recebida' AND (OLD.status IS DISTINCT FROM 'recebida') THEN
    NEW.received_at := COALESCE(NEW.received_at, now());

    SELECT * INTO po_record FROM public.production_orders WHERE id = NEW.production_order_id;

    INSERT INTO public.production_stage_log(order_id, owner_id, from_stage, to_stage, quantity, is_partial)
    VALUES (NEW.production_order_id, NEW.owner_id, NEW.from_stage, NEW.to_stage, COALESCE(NEW.qty_received, NEW.quantity), NEW.kind = 'parcial');

    IF NEW.kind = 'integral' AND po_record.stage IS DISTINCT FROM NEW.to_stage THEN
      UPDATE public.production_orders
        SET stage = NEW.to_stage, stage_updated_at = now()
        WHERE id = NEW.production_order_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_service_orders_on_received
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.service_orders_on_received();
