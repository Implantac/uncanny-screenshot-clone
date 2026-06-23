
-- ============================================================
-- MATERIAL RESERVATIONS por Ordem de Produção
-- Reserva insumos da BOM quando a OP é aprovada (entra em produção)
-- Mantém "disponível" = balance - reservado_pendente
-- ============================================================

CREATE TYPE public.material_reservation_status AS ENUM ('ativa','consumida','liberada');

CREATE TABLE public.material_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  tech_sheet_material_id uuid REFERENCES public.tech_sheet_materials(id) ON DELETE SET NULL,
  qty_required numeric NOT NULL DEFAULT 0,
  qty_reserved numeric NOT NULL DEFAULT 0,
  qty_consumed numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'un',
  status public.material_reservation_status NOT NULL DEFAULT 'ativa',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, inventory_item_id)
);

CREATE INDEX idx_material_reservations_owner ON public.material_reservations(owner_id);
CREATE INDEX idx_material_reservations_po ON public.material_reservations(production_order_id);
CREATE INDEX idx_material_reservations_item_active
  ON public.material_reservations(inventory_item_id) WHERE status = 'ativa';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_reservations TO authenticated;
GRANT ALL ON public.material_reservations TO service_role;

ALTER TABLE public.material_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select material_reservations" ON public.material_reservations
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner insert material_reservations" ON public.material_reservations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update material_reservations" ON public.material_reservations
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete material_reservations" ON public.material_reservations
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_material_reservations_updated
  BEFORE UPDATE ON public.material_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- View: saldo disponível considerando reservas pendentes
-- disponivel = balance - SUM(qty_reserved - qty_consumed) [ativas]
-- ============================================================
CREATE OR REPLACE VIEW public.inventory_items_available AS
SELECT
  ii.id AS inventory_item_id,
  ii.owner_id,
  ii.balance,
  COALESCE(r.committed, 0) AS committed,
  GREATEST(0, ii.balance - COALESCE(r.committed, 0)) AS available
FROM public.inventory_items ii
LEFT JOIN LATERAL (
  SELECT SUM(GREATEST(0, mr.qty_reserved - mr.qty_consumed)) AS committed
    FROM public.material_reservations mr
   WHERE mr.inventory_item_id = ii.id
     AND mr.status = 'ativa'
) r ON true;

GRANT SELECT ON public.inventory_items_available TO authenticated;
GRANT ALL  ON public.inventory_items_available TO service_role;

-- ============================================================
-- Função: gerar reservas a partir da BOM (tech_sheet aprovada)
-- Usada pelo trigger de aprovação da OP e pode ser chamada via RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.production_orders_generate_reservations(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po RECORD;
  m  RECORD;
  ts_id uuid;
  qty_req numeric;
  inserted_count integer := 0;
BEGIN
  SELECT * INTO po FROM public.production_orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF po.product_id IS NULL OR COALESCE(po.quantity,0) <= 0 THEN RETURN 0; END IF;

  -- Ficha técnica aprovada vigente do produto
  SELECT id INTO ts_id
    FROM public.tech_sheets
   WHERE owner_id = po.owner_id
     AND product_id = po.product_id
     AND status = 'aprovada'
   ORDER BY approved_at DESC NULLS LAST, updated_at DESC
   LIMIT 1;

  IF ts_id IS NULL THEN RETURN 0; END IF;

  FOR m IN
    SELECT id, inventory_item_id, consumption, loss_pct, unit
      FROM public.tech_sheet_materials
     WHERE tech_sheet_id = ts_id
       AND inventory_item_id IS NOT NULL
       AND consumption > 0
  LOOP
    qty_req := m.consumption * (1 + COALESCE(m.loss_pct,0)/100.0) * po.quantity;

    INSERT INTO public.material_reservations(
      owner_id, production_order_id, inventory_item_id, tech_sheet_material_id,
      qty_required, qty_reserved, unit, status
    ) VALUES (
      po.owner_id, po.id, m.inventory_item_id, m.id,
      qty_req, qty_req, COALESCE(m.unit,'un'), 'ativa'
    )
    ON CONFLICT (production_order_id, inventory_item_id) DO UPDATE
      SET qty_required = EXCLUDED.qty_required,
          qty_reserved = EXCLUDED.qty_reserved,
          tech_sheet_material_id = EXCLUDED.tech_sheet_material_id,
          unit = EXCLUDED.unit,
          status = 'ativa',
          updated_at = now();

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END $$;

GRANT EXECUTE ON FUNCTION public.production_orders_generate_reservations(uuid) TO authenticated;

-- ============================================================
-- Trigger: ao aprovar (em_producao) gera reservas; ao cancelar libera
-- ============================================================
CREATE OR REPLACE FUNCTION public.production_orders_reserve_materials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- entrou em produção (aprovada) → reserva
  IF NEW.status = 'em_producao'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'em_producao') THEN
    PERFORM public.production_orders_generate_reservations(NEW.id);
  END IF;

  -- cancelada → libera o que restar
  IF NEW.status = 'cancelada'
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'cancelada') THEN
    UPDATE public.material_reservations
       SET status = 'liberada', updated_at = now()
     WHERE production_order_id = NEW.id
       AND status = 'ativa';
  END IF;

  -- concluída → marca o saldo restante como consumido (efetivado em estoque)
  IF NEW.status = 'concluida'
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'concluida') THEN
    UPDATE public.material_reservations
       SET qty_consumed = qty_reserved,
           status = 'consumida',
           updated_at = now()
     WHERE production_order_id = NEW.id
       AND status = 'ativa';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_production_orders_reserve_materials
  AFTER INSERT OR UPDATE OF status ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.production_orders_reserve_materials();

-- ============================================================
-- Trigger: cada saída de estoque referenciando uma OP abate a reserva
-- ============================================================
CREATE OR REPLACE FUNCTION public.stock_movements_consume_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po_id uuid;
BEGIN
  IF NEW.type <> 'saida' THEN RETURN NEW; END IF;
  IF NEW.reference_kind = 'production_order' AND NEW.reference_id IS NOT NULL THEN
    po_id := NEW.reference_id;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.material_reservations
     SET qty_consumed = LEAST(qty_reserved, qty_consumed + NEW.quantity),
         status = CASE
           WHEN qty_consumed + NEW.quantity >= qty_reserved THEN 'consumida'
           ELSE status
         END,
         updated_at = now()
   WHERE production_order_id = po_id
     AND inventory_item_id = NEW.inventory_item_id
     AND status = 'ativa';

  RETURN NEW;
END $$;

CREATE TRIGGER trg_stock_movements_consume_reservation
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movements_consume_reservation();
