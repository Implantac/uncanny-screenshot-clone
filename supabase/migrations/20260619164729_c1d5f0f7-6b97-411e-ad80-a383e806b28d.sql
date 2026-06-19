
ALTER TABLE public.mobile_devices
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_provider TEXT,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.mobile_devices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  kind TEXT NOT NULL DEFAULT 'control_tower',
  severity TEXT NOT NULL DEFAULT 'media',
  payload JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notifications TO authenticated;
GRANT ALL ON public.push_notifications TO service_role;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select push_notifications" ON public.push_notifications
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner insert push_notifications" ON public.push_notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update push_notifications" ON public.push_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete push_notifications" ON public.push_notifications
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_push_notifications_owner_sent
  ON public.push_notifications(owner_id, sent_at DESC);

DROP TRIGGER IF EXISTS update_push_notifications_updated_at ON public.push_notifications;
CREATE TRIGGER update_push_notifications_updated_at BEFORE UPDATE ON public.push_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
