-- ============================================================
-- Sprint 3 — Collection Lifecycle State Machine
-- ============================================================

-- 1) Extend collection_status enum
DO $$ BEGIN
  ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'aprovacao' BEFORE 'desenvolvimento';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'lancamento' AFTER 'entregue';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'markdown' AFTER 'lancamento';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'descontinuada' AFTER 'markdown';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Audit columns on collections
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_changed_by uuid,
  ADD COLUMN IF NOT EXISTS status_change_reason text;

-- 3) Lifecycle automation trigger
CREATE OR REPLACE FUNCTION public.collections_lifecycle_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prod RECORD;
  marker text;
  next_code text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  NEW.status_changed_at := now();

  -- aprovacao -> producao: create draft production orders for non-NOS products
  IF NEW.status = 'producao' THEN
    FOR prod IN
      SELECT cp.product_id, p.sku, p.name
        FROM public.collection_products cp
        JOIN public.products p ON p.id = cp.product_id
       WHERE cp.collection_id = NEW.id
         AND cp.owner_id = NEW.owner_id
         AND cp.role <> 'nos'
    LOOP
      marker := '[col:' || NEW.id::text || ':' || prod.product_id::text || ']';
      IF NOT EXISTS (
        SELECT 1 FROM public.production_orders
         WHERE owner_id = NEW.owner_id
           AND notes LIKE '%' || marker || '%'
      ) THEN
        next_code := 'OP-' || to_char(now(), 'YYYYMMDD') || '-' ||
                     substr(replace(prod.product_id::text,'-',''),1,6);
        INSERT INTO public.production_orders(
          owner_id, product_id, code, quantity, status, stage, notes
        ) VALUES (
          NEW.owner_id, prod.product_id, next_code, 0,
          'aguardando', 'cad',
          'Gerada automaticamente da coleção ' || NEW.name || ' ' || marker
        );
      END IF;
    END LOOP;
  END IF;

  -- lancamento / entregue: mark products as active in lifecycle
  IF NEW.status IN ('lancamento', 'entregue') THEN
    UPDATE public.product_lifecycle
       SET state = 'active'
     WHERE collection_id = NEW.id
       AND state IN ('planned', 'markdown')
       AND owner_id = NEW.owner_id;
  END IF;

  -- markdown: mark non-NOS products as markdown
  IF NEW.status = 'markdown' THEN
    UPDATE public.product_lifecycle pl
       SET state = 'markdown'
      FROM public.collection_products cp
     WHERE pl.collection_id = NEW.id
       AND pl.product_id = cp.product_id
       AND cp.collection_id = NEW.id
       AND cp.role <> 'nos'
       AND pl.state <> 'nos_permanent'
       AND pl.owner_id = NEW.owner_id;
  END IF;

  -- descontinuada: remove non-NOS from mix (preserve basics)
  IF NEW.status = 'descontinuada' THEN
    UPDATE public.product_lifecycle pl
       SET state = 'discontinued'
      FROM public.collection_products cp
     WHERE pl.collection_id = NEW.id
       AND pl.product_id = cp.product_id
       AND cp.collection_id = NEW.id
       AND cp.role <> 'nos'
       AND pl.state <> 'nos_permanent'
       AND pl.owner_id = NEW.owner_id;

    DELETE FROM public.collection_products
     WHERE collection_id = NEW.id
       AND role <> 'nos'
       AND owner_id = NEW.owner_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_collections_lifecycle ON public.collections;
CREATE TRIGGER trg_collections_lifecycle
  BEFORE UPDATE OF status ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.collections_lifecycle_transition();
