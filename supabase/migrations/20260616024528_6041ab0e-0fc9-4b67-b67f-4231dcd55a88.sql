DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['production_batches','service_orders','stock_movements','fit_sessions','fit_session_comments','rfq_requests','rfq_quotes','material_library','product_target_costs','product_sustainability','erp_sync_log','quality_inspections','purchase_orders']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;