
-- =========================
-- Onda 1: integração de fluxo
-- =========================

-- 1) tech_sheets.cost_price + propagação para products.cost_price
ALTER TABLE public.tech_sheets
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2);

CREATE OR REPLACE FUNCTION public.tech_sheets_propagate_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL
     AND NEW.cost_price IS NOT NULL
     AND NEW.status = 'aprovada'
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.cost_price IS DISTINCT FROM NEW.cost_price
       OR OLD.product_id IS DISTINCT FROM NEW.product_id
     )
  THEN
    UPDATE public.products
       SET cost_price = NEW.cost_price,
           updated_at = now()
     WHERE id = NEW.product_id
       AND owner_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_sheets_propagate_cost ON public.tech_sheets;
CREATE TRIGGER trg_tech_sheets_propagate_cost
AFTER INSERT OR UPDATE ON public.tech_sheets
FOR EACH ROW EXECUTE FUNCTION public.tech_sheets_propagate_cost();


-- 2) prototypes aprovado -> production_orders (idempotente via notes marker)
CREATE OR REPLACE FUNCTION public.prototypes_to_production_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marker text;
  next_code text;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.stage <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage = 'aprovado' THEN RETURN NEW; END IF;

  marker := '[proto:' || NEW.id::text || ']';

  IF EXISTS (
    SELECT 1 FROM public.production_orders
     WHERE owner_id = NEW.owner_id
       AND notes LIKE '%' || marker || '%'
  ) THEN
    RETURN NEW;
  END IF;

  next_code := 'OP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(NEW.id::text,'-',''),1,6);

  INSERT INTO public.production_orders(
    owner_id, product_id, supplier_id, code, quantity, status, stage, notes
  ) VALUES (
    NEW.owner_id, NEW.product_id, NEW.supplier_id, next_code, 0,
    'aguardando', 'cad',
    'Gerada automaticamente do protótipo ' || NEW.code || ' ' || marker
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prototypes_to_po ON public.prototypes;
CREATE TRIGGER trg_prototypes_to_po
AFTER INSERT OR UPDATE OF stage ON public.prototypes
FOR EACH ROW EXECUTE FUNCTION public.prototypes_to_production_order();


-- 3) b2b_orders aprovado -> financial_accounts (idempotente via notes marker)
CREATE OR REPLACE FUNCTION public.b2b_orders_to_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marker text;
BEGIN
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;

  marker := '[b2b:' || NEW.id::text || ']';

  IF EXISTS (
    SELECT 1 FROM public.financial_accounts
     WHERE owner_id = NEW.owner_id
       AND notes LIKE '%' || marker || '%'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.financial_accounts(
    owner_id, type, description, due_date, value, status, notes
  ) VALUES (
    NEW.owner_id, 'receber',
    'Pedido B2B ' || NEW.code || ' - ' || NEW.customer_name,
    COALESCE(NEW.order_date, CURRENT_DATE) + INTERVAL '30 days',
    NEW.total_value,
    'pendente',
    'Gerada automaticamente do pedido B2B ' || NEW.code || ' ' || marker
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_b2b_to_financial ON public.b2b_orders;
CREATE TRIGGER trg_b2b_to_financial
AFTER INSERT OR UPDATE OF status ON public.b2b_orders
FOR EACH ROW EXECUTE FUNCTION public.b2b_orders_to_financial_account();
