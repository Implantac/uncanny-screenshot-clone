
-- AI Agents
CREATE TYPE public.ai_agent_status AS ENUM ('ativo', 'pausado', 'erro');

CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.ai_agent_status NOT NULL DEFAULT 'ativo',
  executions INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read ai_agents" ON public.ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert ai_agents" ON public.ai_agents FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update ai_agents" ON public.ai_agents FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete ai_agents" ON public.ai_agents FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mobile Devices
CREATE TABLE public.mobile_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_version TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_devices TO authenticated;
GRANT ALL ON public.mobile_devices TO service_role;
ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read mobile_devices" ON public.mobile_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert mobile_devices" ON public.mobile_devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update mobile_devices" ON public.mobile_devices FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete mobile_devices" ON public.mobile_devices FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_mobile_devices_updated_at BEFORE UPDATE ON public.mobile_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
