
-- 1) Índices ausentes (revisão da auditoria)
CREATE INDEX IF NOT EXISTS idx_quality_inspections_owner_created
  ON public.quality_inspections(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_supplier_created
  ON public.quality_inspections(supplier_id, created_at DESC) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quality_inspections_order
  ON public.quality_inspections(production_order_id) WHERE production_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_owner_due
  ON public.production_orders(owner_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_owner_stage_updated
  ON public.production_orders(owner_id, stage, stage_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_scraps_owner_created
  ON public.inventory_scraps(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_scraps_order
  ON public.inventory_scraps(production_order_id) WHERE production_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_stage_log_order_created
  ON public.production_stage_log(order_id, created_at DESC);

-- 2) Preferências de notificação (mute por categoria + canal)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  muted boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
