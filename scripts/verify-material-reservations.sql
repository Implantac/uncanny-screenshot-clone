-- ============================================================
-- VERIFICAÇÃO: material_reservations × inventory_items_available
--
-- Executa cenários reais em BEGIN/ROLLBACK (não persiste nada).
-- Falha com RAISE EXCEPTION se qualquer invariante quebrar.
--
-- Uso: psql -f scripts/verify-material-reservations.sql
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

-- Helper de asserção (vive só dentro da transação)
CREATE OR REPLACE FUNCTION pg_temp.assert_eq(_actual numeric, _expected numeric, _label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _actual IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION 'ASSERT FAIL [%]: esperado=%, atual=%', _label, _expected, _actual;
  END IF;
  RAISE NOTICE '  ✓ % = %', _label, _actual;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert_text(_actual text, _expected text, _label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _actual IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION 'ASSERT FAIL [%]: esperado=%, atual=%', _label, _expected, _actual;
  END IF;
  RAISE NOTICE '  ✓ % = %', _label, _actual;
END $$;

DO $verify$
DECLARE
  v_owner        uuid;
  v_product      uuid := gen_random_uuid();
  v_item_a       uuid := gen_random_uuid();
  v_item_b       uuid := gen_random_uuid();
  v_sheet        uuid := gen_random_uuid();
  v_order1       uuid := gen_random_uuid();
  v_order2       uuid := gen_random_uuid();
  v_avail_a      numeric;
  v_avail_b      numeric;
  v_committed_a  numeric;
  v_committed_b  numeric;
  v_res_count    integer;
  v_res_qty      numeric;
  v_res_consumed numeric;
  v_status       public.material_reservation_status;
BEGIN
  SELECT owner_id INTO v_owner FROM public.products LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Nenhum owner_id disponível (popular products primeiro).';
  END IF;
  RAISE NOTICE '== owner_id de teste: %', v_owner;

  -- ---------- FIXTURES ----------
  INSERT INTO public.products(id, owner_id, sku, name, status)
    VALUES (v_product, v_owner, 'TEST-MRSV-' || substr(v_product::text,1,8), 'TEST MRSV produto', 'rascunho');

  INSERT INTO public.inventory_items(id, owner_id, sku, name, unit, balance)
    VALUES
      (v_item_a, v_owner, 'TEST-A-' || substr(v_item_a::text,1,6), 'TEST Tecido A', 'm', 100),
      (v_item_b, v_owner, 'TEST-B-' || substr(v_item_b::text,1,6), 'TEST Aviam B',  'un', 50);

  INSERT INTO public.tech_sheets(id, owner_id, product_id, code, version, status, overhead_pct)
    VALUES (v_sheet, v_owner, v_product, 'TS-TEST-' || substr(v_sheet::text,1,6), 'v1.0', 'rascunho', 0);
  UPDATE public.tech_sheets SET status = 'aprovada' WHERE id = v_sheet;


  -- BOM: A → 2 m × (1+10%) por peça | B → 4 un × (1+0%) por peça
  INSERT INTO public.tech_sheet_materials(owner_id, tech_sheet_id, inventory_item_id, name, consumption, unit, loss_pct, unit_cost)
    VALUES
      (v_owner, v_sheet, v_item_a, 'Tecido A', 2, 'm', 10, 25),
      (v_owner, v_sheet, v_item_b, 'Aviamento B', 4, 'un', 0, 1.5);

  RAISE NOTICE '== Fixtures criadas';

  -- ---------- CENÁRIO 1: aprovar OP gera reservas (consumo × perda × qtd) ----------
  RAISE NOTICE '-- Cenário 1: aprovação da OP gera reservas (qty=10)';
  INSERT INTO public.production_orders(id, owner_id, product_id, code, quantity, status, stage)
    VALUES (v_order1, v_owner, v_product, 'OP-TEST-1', 10, 'em_producao', 'cad');

  SELECT COUNT(*) INTO v_res_count
    FROM public.material_reservations WHERE production_order_id = v_order1;
  PERFORM pg_temp.assert_eq(v_res_count, 2, 'reservas criadas');

  SELECT qty_reserved INTO v_res_qty
    FROM public.material_reservations
   WHERE production_order_id = v_order1 AND inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_res_qty, 22, 'qty_reserved Item A (2×1.10×10)');

  SELECT qty_reserved INTO v_res_qty
    FROM public.material_reservations
   WHERE production_order_id = v_order1 AND inventory_item_id = v_item_b;
  PERFORM pg_temp.assert_eq(v_res_qty, 40, 'qty_reserved Item B (4×10)');

  -- ---------- CENÁRIO 2: view available = balance - committed ----------
  RAISE NOTICE '-- Cenário 2: inventory_items_available bate com cálculo manual';
  SELECT available, committed INTO v_avail_a, v_committed_a
    FROM public.inventory_items_available WHERE inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_committed_a, 22, 'committed Item A');
  PERFORM pg_temp.assert_eq(v_avail_a, 78, 'available Item A (100-22)');

  SELECT available, committed INTO v_avail_b, v_committed_b
    FROM public.inventory_items_available WHERE inventory_item_id = v_item_b;
  PERFORM pg_temp.assert_eq(v_committed_b, 40, 'committed Item B');
  PERFORM pg_temp.assert_eq(v_avail_b, 10, 'available Item B (50-40)');

  -- ---------- CENÁRIO 3: 2ª OP soma committed ----------
  RAISE NOTICE '-- Cenário 3: 2ª OP (qty=5) soma committed';
  INSERT INTO public.production_orders(id, owner_id, product_id, code, quantity, status, stage)
    VALUES (v_order2, v_owner, v_product, 'OP-TEST-2', 5, 'em_producao', 'cad');

  SELECT committed INTO v_committed_a
    FROM public.inventory_items_available WHERE inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_committed_a, 33, 'committed Item A após 2ª OP (22+11)');

  -- ---------- CENÁRIO 4: saída vinculada à OP1 consome reserva (parcial) ----------
  RAISE NOTICE '-- Cenário 4: saída vinculada à OP1 abate reserva';
  INSERT INTO public.stock_movements(owner_id, inventory_item_id, type, quantity, reference_kind, reference_id)
    VALUES (v_owner, v_item_a, 'saida', 10, 'production_order', v_order1);

  SELECT qty_consumed, status INTO v_res_consumed, v_status
    FROM public.material_reservations
   WHERE production_order_id = v_order1 AND inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_res_consumed, 10, 'qty_consumed Item A após saída de 10');
  PERFORM pg_temp.assert_text(v_status::text, 'ativa', 'status permanece ativa (parcial)');

  SELECT available, committed INTO v_avail_a, v_committed_a
    FROM public.inventory_items_available WHERE inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_committed_a, 23, 'committed Item A (12 restante + 11 OP2)');
  PERFORM pg_temp.assert_eq(v_avail_a, 67, 'available Item A (balance 90 - 23)');

  -- ---------- CENÁRIO 5: saída completa marca como consumida ----------
  RAISE NOTICE '-- Cenário 5: saída do saldo restante zera a reserva';
  INSERT INTO public.stock_movements(owner_id, inventory_item_id, type, quantity, reference_kind, reference_id)
    VALUES (v_owner, v_item_a, 'saida', 12, 'production_order', v_order1);

  SELECT status INTO v_status
    FROM public.material_reservations
   WHERE production_order_id = v_order1 AND inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_text(v_status::text, 'consumida', 'reserva marcada consumida');

  SELECT committed INTO v_committed_a
    FROM public.inventory_items_available WHERE inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_committed_a, 11, 'committed Item A só OP2 (11)');

  -- ---------- CENÁRIO 6: cancelar OP2 libera reserva ----------
  RAISE NOTICE '-- Cenário 6: cancelar OP2 libera reservas restantes';
  UPDATE public.production_orders SET status = 'cancelada' WHERE id = v_order2;

  SELECT status INTO v_status
    FROM public.material_reservations
   WHERE production_order_id = v_order2 AND inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_text(v_status::text, 'liberada', 'reserva da OP2 liberada');

  SELECT committed INTO v_committed_a
    FROM public.inventory_items_available WHERE inventory_item_id = v_item_a;
  PERFORM pg_temp.assert_eq(v_committed_a, 0, 'committed Item A zerado');

  -- ---------- CENÁRIO 7: invariante final ----------
  RAISE NOTICE '-- Cenário 7: invariante committed = SUM ativas';
  SELECT COALESCE(SUM(GREATEST(0, qty_reserved - qty_consumed)), 0)
    INTO v_committed_a
    FROM public.material_reservations
   WHERE inventory_item_id = v_item_a AND status = 'ativa' AND owner_id = v_owner;
  PERFORM pg_temp.assert_eq(v_committed_a, 0, 'soma manual de ATIVAS = view');

  -- ---------- CENÁRIO 8: saída sem reference_kind=production_order não mexe na reserva ----------
  RAISE NOTICE '-- Cenário 8: saída avulsa não abate reserva';
  INSERT INTO public.production_orders(owner_id, product_id, code, quantity, status, stage)
    VALUES (v_owner, v_product, 'OP-TEST-3', 2, 'em_producao', 'cad');

  SELECT qty_consumed INTO v_res_consumed
    FROM public.material_reservations mr
    JOIN public.production_orders po ON po.id = mr.production_order_id
   WHERE po.code = 'OP-TEST-3' AND mr.inventory_item_id = v_item_b;
  PERFORM pg_temp.assert_eq(v_res_consumed, 0, 'qty_consumed inicial OP3');

  INSERT INTO public.stock_movements(owner_id, inventory_item_id, type, quantity, reference_kind)
    VALUES (v_owner, v_item_b, 'saida', 3, 'ajuste');

  SELECT qty_consumed INTO v_res_consumed
    FROM public.material_reservations mr
    JOIN public.production_orders po ON po.id = mr.production_order_id
   WHERE po.code = 'OP-TEST-3' AND mr.inventory_item_id = v_item_b;
  PERFORM pg_temp.assert_eq(v_res_consumed, 0, 'reserva intacta após saída avulsa');

  -- ---------- CENÁRIO 9: balance real bate com soma de movimentos ----------
  RAISE NOTICE '-- Cenário 9: balance final consistente com stock_movements';
  SELECT balance INTO v_avail_a
    FROM public.inventory_items WHERE id = v_item_a;
  -- inicial 100, saídas 10 + 12 = 22 → balance 78
  PERFORM pg_temp.assert_eq(v_avail_a, 78, 'balance Item A = 100 - 10 - 12');

  SELECT balance INTO v_avail_b
    FROM public.inventory_items WHERE id = v_item_b;
  -- inicial 50, saída avulsa 3 → 47
  PERFORM pg_temp.assert_eq(v_avail_b, 47, 'balance Item B = 50 - 3');

  RAISE NOTICE '== ✅ Todos os cenários passaram';
END $verify$;

ROLLBACK;
