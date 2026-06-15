
CREATE INDEX IF NOT EXISTS idx_ai_agents_owner ON public.ai_agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_owner ON public.b2b_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_owner ON public.mobile_devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_owner ON public.production_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_product ON public.production_orders(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_supplier ON public.production_orders(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_collection ON public.products(collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_owner ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_prototypes_owner ON public.prototypes(owner_id);
CREATE INDEX IF NOT EXISTS idx_prototypes_product ON public.prototypes(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prototypes_supplier ON public.prototypes(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poi_inventory_item ON public.purchase_order_items(inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poi_owner ON public.purchase_order_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_owner ON public.suppliers(owner_id);
CREATE INDEX IF NOT EXISTS idx_tech_sheets_owner ON public.tech_sheets(owner_id);
CREATE INDEX IF NOT EXISTS idx_tech_sheets_product ON public.tech_sheets(product_id) WHERE product_id IS NOT NULL;
