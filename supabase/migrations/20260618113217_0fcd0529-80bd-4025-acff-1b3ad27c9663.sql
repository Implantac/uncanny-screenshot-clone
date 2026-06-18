
ALTER TABLE public.pcp_stages
  ADD COLUMN IF NOT EXISTS sla_stuck_days integer NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.alert_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  dismissed_until timestamptz,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_dismissals TO authenticated;
GRANT ALL ON public.alert_dismissals TO service_role;

ALTER TABLE public.alert_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own dismissals" ON public.alert_dismissals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alert_dismissals_user ON public.alert_dismissals(user_id, alert_key);
