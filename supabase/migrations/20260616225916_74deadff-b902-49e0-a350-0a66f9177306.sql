REVOKE EXECUTE ON FUNCTION public.inventory_items_update_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_items_update_metrics() TO service_role;